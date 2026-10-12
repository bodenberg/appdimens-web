/**
 * Runtime — the web counterpart of Android `DimenCache`.
 *
 * - Holds the current immutable {@link DimenMetrics} snapshot of the viewport.
 * - Keeps one precomputed `Float64Array` factor table per registered strategy, so every
 *   generated accessor (`sdp`, `pwhdpa`, …) is one branch + one multiply.
 * - Invalidation is event driven: `resize` / orientation / DPR / posture events only flip a
 *   dirty flag. The next read (or the next animation frame, whichever comes first)
 *   rebuilds the snapshot; CSS custom properties and subscribers are flushed once per frame.
 */
import { DENSITY_DPI_BASE } from './constants';
import { UiModeType } from './enums';
import { DimenMetrics, type DimenMetricsInit } from './metrics';
import { fillFactorTable, FLAG_SUFFIXES, SLOT_COUNT, VARIANTS, type StrategyDef } from './strategy';

export interface WebDimensConfig {
  /**
   * Publish CSS custom properties (`--sdp`, `--ssp`, `--pwsdp`, …) for every registered
   * strategy. Default `true` once {@link install} runs.
   */
  cssVariables?: boolean;
  /** CSP nonce for the fallback `<style>` element (constructable stylesheets need none). */
  cssNonce?: string;
  /** Force a UI mode, or provide a resolver. Default: user-agent / posture heuristics. */
  uiModeType?: UiModeType | ((size: { width: number; height: number }) => UiModeType);
  /** Force the font scale. Default: browser default font size / 16. */
  fontScale?: number;
  /** Force multi-window detection (drives the `i` variants). Default: window vs screen heuristic. */
  multiWindow?: boolean | ((size: { width: number; height: number }) => boolean);
  /** Custom viewport measure (CSS px). Default: `innerWidth` × layout-viewport height. */
  measure?: () => { width: number; height: number };
}

/** Hot-path state shared with the generated accessors. Read-only for consumers. */
export const S = {
  /** A snapshot rebuild is pending. */
  dirty: true,
  /** Device pixels per CSS px (density). */
  dpr: 1,
  /** User font scale. */
  fs: 1,
  /** Increments every time the snapshot actually changes. */
  version: 0,
  metrics: DimenMetrics.DEFAULT,
};

interface Registered {
  readonly def: StrategyDef;
  readonly table: Float64Array;
}

const registry: Registered[] = [];
const byDef = new Map<StrategyDef, Registered>();
const listeners = new Set<(m: DimenMetrics) => void>();
let config: WebDimensConfig = {};
let pinned: DimenMetrics | null = null;
let listening = false;
let installed = false;
let cssEnabled = false;
let frame = 0;
let pendingFlush = false;
let cssDirty = false;
let measuredFontScale = 0;

const hasWindow = (): boolean => typeof window !== 'undefined' && typeof document !== 'undefined';

/** Registers a strategy and returns its live factor table (stable reference). Idempotent. */
export function register(def: StrategyDef): Float64Array {
  let r = byDef.get(def);
  if (!r) {
    r = { def, table: new Float64Array(SLOT_COUNT) };
    fillFactorTable(def, S.metrics, r.table);
    registry.push(r);
    byDef.set(def, r);
    if (cssEnabled) {
      cssDirty = true;
      schedule();
    }
  }
  return r.table;
}

/** Strategies registered so far (scaled is always first once the core is imported). */
export function registeredStrategies(): readonly StrategyDef[] {
  return registry.map((r) => r.def);
}

/** Rebuilds the snapshot if invalidated. Called by every accessor when `S.dirty` is set. */
export function sync(): void {
  S.dirty = false;
  if (!listening && hasWindow() && !pinned) startListening();
  const next = pinned ?? (hasWindow() ? new DimenMetrics(readEnvironment()) : DimenMetrics.DEFAULT);
  if (!next.equals(S.metrics)) apply(next);
}

function apply(next: DimenMetrics): void {
  S.metrics = next;
  S.dpr = next.density;
  S.fs = next.fontScale;
  S.version++;
  for (let i = 0; i < registry.length; i++) fillFactorTable(registry[i]!.def, next, registry[i]!.table);
  cssDirty = true;
  pendingFlush = true;
  schedule();
}

/** Current snapshot (rebuilt first if a resize is pending). */
export function getMetrics(): DimenMetrics {
  if (S.dirty) sync();
  return S.metrics;
}

/** Snapshot version — changes whenever any dimension may have changed. */
export function getVersion(): number {
  if (S.dirty) sync();
  return S.version;
}

/**
 * Subscribes to snapshot changes (called at most once per animation frame).
 * Returns an unsubscribe function.
 */
export function subscribe(listener: (m: DimenMetrics) => void): () => void {
  listeners.add(listener);
  if (S.dirty) sync();
  return () => {
    listeners.delete(listener);
  };
}

/** Marks the snapshot stale (e.g. after changing the root font size). Re-measures the font scale. */
export function refresh(): void {
  measuredFontScale = 0;
  invalidate();
}

function invalidate(): void {
  S.dirty = true;
  schedule();
}

/**
 * Pins an explicit snapshot (SSR with client hints, tests, previews, embedded webviews).
 * Pass `null` to return to live viewport tracking.
 */
export function setMetrics(metrics: DimenMetrics | DimenMetricsInit | null): void {
  pinned = metrics == null ? null : metrics instanceof DimenMetrics ? metrics : new DimenMetrics(metrics);
  S.dirty = false;
  if (pinned) apply(pinned);
  else invalidate();
}

/** Updates runtime options. Unspecified keys keep their value. */
export function configure(next: WebDimensConfig): void {
  config = { ...config, ...next };
  if (next.cssVariables !== undefined) {
    cssEnabled = next.cssVariables;
    if (!cssEnabled) removeCss();
    cssDirty = true;
  }
  if (next.fontScale !== undefined) measuredFontScale = 0;
  invalidate();
}

/**
 * Starts the runtime: viewport tracking + CSS custom properties. Idempotent.
 * Equivalent to `DimenCache.init(context)` on Android. Accessors work without it
 * (they start tracking lazily); call it when you rely on the CSS variables.
 */
export function install(options: WebDimensConfig = {}): void {
  if (!installed) {
    installed = true;
    if (options.cssVariables === undefined) options = { ...options, cssVariables: true };
  }
  configure(options);
  if (hasWindow()) {
    sync();
    flush();
  }
}

/** Stops listening and removes the CSS variables (tests, micro-frontend teardown). */
export function uninstall(): void {
  stopListening();
  removeCss();
  installed = false;
  cssEnabled = false;
  pinned = null;
  config = {};
  measuredFontScale = 0;
  if (frame && hasWindow()) (window.cancelAnimationFrame || clearTimeout)(frame);
  frame = 0;
  S.dirty = true;
}

// ─────────────────────────────────────────────────────────────────────────────
// Scheduling: at most one flush (CSS write + listener notification) per frame.
// ─────────────────────────────────────────────────────────────────────────────

function schedule(): void {
  if (frame || !hasWindow()) return;
  const raf = window.requestAnimationFrame?.bind(window) ?? ((cb: () => void) => window.setTimeout(cb, 16));
  frame = raf(() => {
    frame = 0;
    flush();
  }) as unknown as number;
}

/** Applies a pending snapshot immediately (CSS + listeners). Normally runs once per frame. */
export function flush(): void {
  if (S.dirty) sync();
  if (cssDirty) {
    cssDirty = false;
    if (cssEnabled) writeCss();
  }
  if (pendingFlush) {
    pendingFlush = false;
    const m = S.metrics;
    listeners.forEach((l) => l(m));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Environment
// ─────────────────────────────────────────────────────────────────────────────

const onChange = (): void => invalidate();
let dprQuery: MediaQueryList | null = null;

function watchDpr(): void {
  dprQuery?.removeEventListener?.('change', onDprChange);
  dprQuery = window.matchMedia?.(`(resolution: ${window.devicePixelRatio || 1}dppx)`) ?? null;
  dprQuery?.addEventListener?.('change', onDprChange);
}

function onDprChange(): void {
  watchDpr();
  invalidate();
}

function startListening(): void {
  listening = true;
  const opts: AddEventListenerOptions = { passive: true };
  window.addEventListener('resize', onChange, opts);
  window.addEventListener('orientationchange', onChange, opts);
  window.addEventListener('pageshow', onChange, opts);
  (navigator as NavigatorWithPosture).devicePosture?.addEventListener?.('change', onChange);
  watchDpr();
}

function stopListening(): void {
  if (!listening) return;
  listening = false;
  window.removeEventListener('resize', onChange);
  window.removeEventListener('orientationchange', onChange);
  window.removeEventListener('pageshow', onChange);
  (navigator as NavigatorWithPosture).devicePosture?.removeEventListener?.('change', onChange);
  dprQuery?.removeEventListener?.('change', onDprChange);
  dprQuery = null;
}

interface NavigatorWithPosture extends Navigator {
  devicePosture?: { type?: string } & Partial<EventTarget>;
}

/** Reads the window into snapshot inputs. Exported for scoped snapshots and tests. */
export function readEnvironment(size?: { width: number; height: number }): DimenMetricsInit {
  const s = size ?? config.measure?.() ?? viewportSize();
  return {
    screenWidthDp: s.width,
    screenHeightDp: s.height,
    density: window.devicePixelRatio || 1,
    fontScale: config.fontScale ?? fontScale(),
    uiModeType: uiMode(s),
    isInMultiWindowMode: multiWindow(s),
  };
}

/**
 * Width: `innerWidth` (same basis as `vw`). Height: the layout viewport
 * (`documentElement.clientHeight` in standards mode), which — unlike `innerHeight` —
 * does not change while mobile URL bars show/hide, so `hdp` stays stable while scrolling.
 */
function viewportSize(): { width: number; height: number } {
  const root = document.documentElement;
  const layoutHeight = document.compatMode === 'CSS1Compat' ? root.clientHeight : 0;
  return { width: window.innerWidth, height: layoutHeight > 0 ? layoutHeight : window.innerHeight };
}

function fontScale(): number {
  if (measuredFontScale > 0) return measuredFontScale;
  let fs = 1;
  try {
    const probe = document.createElement('div');
    probe.style.cssText = 'position:absolute;visibility:hidden;pointer-events:none;font-size:medium';
    document.documentElement.appendChild(probe);
    const px = parseFloat(getComputedStyle(probe).fontSize);
    probe.remove();
    if (Number.isFinite(px) && px > 0) fs = px / 16;
  } catch {
    /* non-DOM environment */
  }
  measuredFontScale = fs;
  return fs;
}

const TV = /SmartTV|SMART-TV|Tizen.+TV|Web0S|WebOS|HbbTV|AppleTV|GoogleTV|Android TV|BRAVIA|NetCast|Roku|CrKey|AFT[A-Z]/i;
const VR = /OculusBrowser|PicoBrowser|Quest \d|Mobile VR/i;
const WATCH = /\bWatch\b|Wear ?OS/i;
const CAR = /Android Automotive|\bAAOS\b/i;

function uiMode(size: { width: number; height: number }): UiModeType {
  const forced = config.uiModeType;
  if (forced !== undefined) return typeof forced === 'function' ? forced(size) : forced;
  return detectUiModeType(size);
}

/** Heuristic UI-mode detection (user agent + Device Posture / Viewport Segments APIs). */
export function detectUiModeType(size: { width: number; height: number }): UiModeType {
  if (typeof navigator === 'undefined') return UiModeType.NORMAL;
  const ua = navigator.userAgent || '';
  if (TV.test(ua)) return UiModeType.TELEVISION;
  if (VR.test(ua)) return UiModeType.VR_HEADSET;
  if (WATCH.test(ua)) return UiModeType.WATCH;
  if (CAR.test(ua)) return UiModeType.CAR;
  const segments = (window as Window & { viewportSegments?: ArrayLike<DOMRectReadOnly> | null }).viewportSegments;
  if (segments && segments.length > 1) {
    const a = segments[0]!;
    const b = segments[1]!;
    const sideBySide = Math.abs(a.top - b.top) < 1;
    const folded = (navigator as NavigatorWithPosture).devicePosture?.type === 'folded';
    if (sideBySide) return folded ? UiModeType.FOLD_HALF_OPENED : UiModeType.FOLD_OPEN;
    return folded ? UiModeType.FLIP_HALF_OPENED : UiModeType.FLIP_OPEN;
  }
  void size;
  return UiModeType.NORMAL;
}

function multiWindow(size: { width: number; height: number }): boolean {
  const forced = config.multiWindow;
  if (forced !== undefined) return typeof forced === 'function' ? forced(size) : forced;
  // Android fallback heuristic: the window is ≥ 10 % narrower than the display.
  // outerWidth/availWidth are both unaffected by page zoom in Chromium.
  const avail = window.screen?.availWidth ?? 0;
  const outer = window.outerWidth || size.width;
  return avail > 0 && avail - outer >= avail * 0.1;
}

// ─────────────────────────────────────────────────────────────────────────────
// CSS custom properties
// ─────────────────────────────────────────────────────────────────────────────

const STYLE_ID = 'webdimens-vars';
let sheet: CSSStyleSheet | null = null;
let styleEl: HTMLStyleElement | null = null;
let lastCss = '';

const px = (n: number): string => `${Math.round(n * 1e4) / 1e4}px`;

/** CSS declarations for a snapshot (`--sdp:1.2px;…`). Shared by the global sheet and scoped elements. */
export function cssDeclarations(m: DimenMetrics, strategies: readonly StrategyDef[] = registeredStrategies()): string {
  let out =
    `--ad-w:${px(m.screenWidthDp)};--ad-h:${px(m.screenHeightDp)};--ad-sw:${px(m.smallestScreenWidthDp)};` +
    `--ad-density:${m.density};--ad-dpi:${m.density * DENSITY_DPI_BASE};--ad-font-scale:${m.fontScale};` +
    `--ad-landscape:${m.isLandscape ? 1 : 0};--ad-multi-window:${m.isInMultiWindowMode ? 1 : 0};`;
  const table = new Float64Array(SLOT_COUNT);
  for (const def of strategies) {
    const r = byDef.get(def);
    const t = r && m === S.metrics ? r.table : (fillFactorTable(def, m, table), table);
    out += strategyDeclarations(def.prefix, t, m.fontScale);
  }
  return out;
}

function strategyDeclarations(prefix: string, t: Float64Array, fs: number): string {
  let out = '';
  for (let v = 0; v < VARIANTS.length; v++) {
    const { axis, token } = VARIANTS[v]!;
    for (let f = 0; f < 4; f++) {
      const factor = t[v * 4 + f]!;
      const flag = FLAG_SUFFIXES[f];
      out += `--${prefix}${axis}dp${token}${flag}:${px(factor)};`;
      if (token === '') {
        out += `--${prefix}${axis}sp${flag}:${px(factor * fs)};--${prefix}${axis}em${flag}:${px(factor)};`;
      }
    }
  }
  return out;
}

function writeCss(): void {
  if (!hasWindow()) return;
  const text = `:root:root{${cssDeclarations(S.metrics)}}`;
  if (text === lastCss) return;
  lastCss = text;
  const doc = document as Document & { adoptedStyleSheets?: CSSStyleSheet[] };
  if (!styleEl && typeof CSSStyleSheet !== 'undefined' && Array.isArray(doc.adoptedStyleSheets)) {
    try {
      if (!sheet) {
        sheet = new CSSStyleSheet();
        doc.adoptedStyleSheets = [...doc.adoptedStyleSheets, sheet];
      }
      sheet.replaceSync(text);
      return;
    } catch {
      sheet = null;
    }
  }
  if (!styleEl) {
    styleEl = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = STYLE_ID;
      if (config.cssNonce) styleEl.nonce = config.cssNonce;
      document.head.appendChild(styleEl);
    }
  }
  styleEl.textContent = text;
}

function removeCss(): void {
  lastCss = '';
  if (!hasWindow()) return;
  const doc = document as Document & { adoptedStyleSheets?: CSSStyleSheet[] };
  if (sheet && doc.adoptedStyleSheets) doc.adoptedStyleSheets = doc.adoptedStyleSheets.filter((s) => s !== sheet);
  sheet = null;
  styleEl?.remove();
  styleEl = null;
}
