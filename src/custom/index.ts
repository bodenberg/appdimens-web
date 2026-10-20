/**
 * Custom scaling strategies on the web runtime (Android `appdimens-dynamic-custom`).
 *
 *   const brand = defineScalingStrategy({
 *     id: 'brand',
 *     reference: { width: 360, height: 640 },
 *     curve: { type: 'power', exponent: 0.8 },
 *     clamp: { min: 0.85, max: 1.6 },
 *     rules: [{ when: { device: ['tablet', 'desktop'] }, set: { curve: { type: 'logarithmic', k: 0.4 } } }],
 *   });
 *   cdp(16, brand)        // CSS px for the current viewport
 *   csp(14, brand)        // text, font-scale policy applied
 *   brand.css(16)         // "calc(16 * var(--cdp-brand))" — responsive, SSR-safe
 *
 * Every defined strategy publishes `--cdp-<id>` (layout factor, px) and `--csp-<id>`
 * (text factor × effective font scale, px); the default strategy also publishes `--cdp` / `--csp`.
 */
import { UiModeType } from '../core/enums';
import type { DimenMetrics } from '../core/metrics';
import { getMetrics, S, subscribe, sync } from '../core/runtime';
import { setCustomLiteralResolver } from '../core/tokens';
import {
  BUILT_IN_SPECS,
  configFromSpec,
  configToSpec,
  DEFAULT_CONFIG,
  isValueDependent,
  parseStrategiesDocument,
  PRESET_SPECS,
  resolveScaling,
  ResolvedScaling,
  type DeviceClass,
  type ScalingAxis,
  type ScalingConfig,
  type ScalingPatchSpec,
  type ScalingRuleSpec,
  type ScalingStrategiesDocument,
  type ScalingStrategySpec,
  type ScreenSnapshot,
  TABLET_MIN_SMALLEST_WIDTH_DP,
} from './engine';

export * from './engine';

// ─────────────────────────────────────────────────────────────────────────────
// Window snapshot → ScreenSnapshot
// ─────────────────────────────────────────────────────────────────────────────

let deviceResolver: ((m: DimenMetrics) => DeviceClass) | null = null;

/**
 * Overrides how the device class is detected (e.g. from your own user-agent rules).
 * Pass `null` to restore the default: UI mode (TV / car / watch / desk / VR), then a
 * fine pointer with hover → `desktop`, then `sw >= 600` → `tablet`, else `phone`.
 */
export function setDeviceClassResolver(resolver: ((m: DimenMetrics) => DeviceClass) | null): void {
  deviceResolver = resolver;
}

function finePointer(): boolean {
  try {
    return typeof matchMedia === 'function' && matchMedia('(hover: hover) and (pointer: fine)').matches;
  } catch {
    return false;
  }
}

/** Default device classification for a web snapshot. */
export function defaultDeviceClass(m: DimenMetrics): DeviceClass {
  switch (m.uiModeType) {
    case UiModeType.TELEVISION: return 'tv';
    case UiModeType.CAR: return 'car';
    case UiModeType.WATCH: return 'watch';
    case UiModeType.DESK: return 'desktop';
    case UiModeType.VR_HEADSET: return 'vr';
    default:
      if (finePointer()) return 'desktop';
      return m.smallestWidthDp >= TABLET_MIN_SMALLEST_WIDTH_DP ? 'tablet' : 'phone';
  }
}

/** Platform-free snapshot of a web `DimenMetrics` (viewport or element scope). */
export function toScreenSnapshot(m: DimenMetrics): ScreenSnapshot {
  return Object.freeze({
    widthDp: m.screenWidthDp,
    heightDp: m.screenHeightDp,
    smallestWidthDp: m.smallestWidthDp,
    density: m.density,
    fontScale: m.fontScale,
    isLandscape: m.isLandscape,
    isMultiWindow: m.isInMultiWindowMode,
    device: (deviceResolver ?? defaultDeviceClass)(m),
  });
}

function current(): DimenMetrics {
  if (S.dirty) sync();
  return S.metrics;
}

const cssIdent = (id: string): string => id.replace(/[^A-Za-z0-9_-]/g, '_');

// ─────────────────────────────────────────────────────────────────────────────
// Strategy
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A named, immutable custom strategy. The factor is memoized per snapshot, so `dp(16)` is
 * one multiply (plus optional value bounds).
 */
export class ScalingStrategy {
  /** True when results depend on the value itself (value bounds / transform). */
  readonly valueDependent: boolean;
  /** CSS custom property names published for this strategy. */
  readonly cssVar: string;
  readonly cssSpVar: string;
  private memoKey: object | null = null;
  private memo: ResolvedScaling | null = null;

  constructor(readonly id: string, readonly config: ScalingConfig) {
    if (!id || !id.trim()) throw new TypeError('strategy id must not be blank');
    this.valueDependent = isValueDependent(config);
    this.cssVar = `--cdp-${cssIdent(id)}`;
    this.cssSpVar = `--csp-${cssIdent(id)}`;
    Object.freeze(this.config);
  }

  /** Resolution for `metrics` (default: the current viewport) — memoized per snapshot. */
  resolve(metrics: DimenMetrics = current()): ResolvedScaling {
    if (this.memoKey === metrics && this.memo) return this.memo;
    const r = resolveScaling(this.config, toScreenSnapshot(metrics));
    this.memoKey = metrics;
    this.memo = r;
    return r;
  }

  /** Resolution for an explicit platform-free snapshot (tests, previews, SSR). */
  resolveScreen(screen: ScreenSnapshot): ResolvedScaling {
    return resolveScaling(this.config, screen);
  }

  /** Screen-only factor. */
  factor(metrics?: DimenMetrics): number {
    return this.resolve(metrics).factor;
  }

  /** `value` dp → CSS px. */
  dp(value: number, metrics?: DimenMetrics): number {
    return this.resolve(metrics).scale(value);
  }

  /** `value` dp → device px. */
  px(value: number, metrics?: DimenMetrics): number {
    const r = this.resolve(metrics);
    return r.scale(value) * r.screen.density;
  }

  /** Text: `value` sp → CSS px, with the strategy font-scale policy. */
  sp(value: number, metrics?: DimenMetrics): number {
    return this.resolve(metrics).scaleSpDp(value);
  }

  /** Text → device px. */
  spPx(value: number, metrics?: DimenMetrics): number {
    const r = this.resolve(metrics);
    return r.scaleSpDp(value) * r.screen.density;
  }

  /**
   * Responsive CSS for `value`: `calc(16 * var(--cdp-brand))`. Value-dependent strategies
   * (value bounds / transform) cannot be expressed as one factor, so they return the px
   * literal of the current snapshot instead.
   */
  css(value: number): string {
    if (this.valueDependent) return `${round(this.dp(value))}px`;
    ensureCss();
    return `calc(${value} * var(${this.cssVar}))`;
  }

  /** Responsive CSS for text (`var(--csp-<id>)`). */
  cssSp(value: number): string {
    if (this.valueDependent) return `${round(this.sp(value))}px`;
    ensureCss();
    return `calc(${value} * var(${this.cssSpVar}))`;
  }

  /** Debug breakdown. */
  explain(metrics?: DimenMetrics): string {
    return this.resolve(metrics).explain(this.id);
  }

  /** New strategy starting from this one (parent rules first). Registered unless `register: false`. */
  extend(id: string, patch: ScalingPatchSpec & { rules?: readonly ScalingRuleSpec[] } = {}, options: { register?: boolean } = {}): ScalingStrategy {
    const s = new ScalingStrategy(id, configFromSpec(patch, this.config, id));
    return options.register === false ? s : registerScalingStrategy(s);
  }

  /** Same strategy on another axis. Id `"<id>@<axis>"`, cached. */
  withAxis(axis: ScalingAxis): ScalingStrategy {
    if (axis === this.config.axis) return this;
    const id = `${this.id}@${axis}`;
    let s = derived.get(id);
    if (!s || s.config.rules !== this.config.rules) {
      s = new ScalingStrategy(id, Object.freeze({ ...this.config, axis }));
      derived.set(id, s);
    }
    return s;
  }

  /** JSON-ready spec (throws for function curves / transforms). */
  toJSON(): ScalingStrategySpec {
    return configToSpec(this.id, this.config);
  }
}

const round = (n: number): number => Math.round(n * 1e4) / 1e4;

// ─────────────────────────────────────────────────────────────────────────────
// Registry
// ─────────────────────────────────────────────────────────────────────────────

const registry = new Map<string, ScalingStrategy>();
const derived = new Map<string, ScalingStrategy>();
let defaultStrategy: ScalingStrategy | null = null;

const spec = (s: ScalingStrategySpec): ScalingStrategy => new ScalingStrategy(s.id, configFromSpec(s, DEFAULT_CONFIG, s.id));

/** The built-in strategies as custom configs — parents for `extend` / `"extends"`. */
export const BuiltInStrategies = Object.freeze({
  SCALED: spec(BUILT_IN_SPECS.scaled!),
  POWER: spec(BUILT_IN_SPECS.power!),
  LOGARITHMIC: spec(BUILT_IN_SPECS.logarithmic!),
  INTERPOLATED: spec(BUILT_IN_SPECS.interpolated!),
  DIAGONAL: spec(BUILT_IN_SPECS.diagonal!),
  PERIMETER: spec(BUILT_IN_SPECS.perimeter!),
  FIXED: spec(BUILT_IN_SPECS.fixed!),
});

/** Ready-made strategies (not registered; found by id in `getScalingStrategy` / `"extends"`). */
export const CustomPresets = Object.freeze({
  TABLET_FRIENDLY: spec(PRESET_SPECS.tabletFriendly!),
  COMPACT_FIRST: spec(PRESET_SPECS.compactFirst!),
  TV_SAFE: spec(PRESET_SPECS.tvSafe!),
  WEARABLE: spec(PRESET_SPECS.wearable!),
  GAME_HUD: spec(PRESET_SPECS.gameHud!),
  READABLE_TEXT: spec(PRESET_SPECS.readableText!),
});

const builtInById = new Map<string, ScalingStrategy>(
  [...Object.values(BuiltInStrategies), ...Object.values(CustomPresets)].map((s) => [s.id.toLowerCase(), s]),
);

/** Registers (or replaces) a strategy instance under its id. */
export function registerScalingStrategy(strategy: ScalingStrategy): ScalingStrategy {
  registry.set(strategy.id, strategy);
  installResolver();
  if (cssStarted) writeCustomCss();
  else ensureCss();
  return strategy;
}

/** Creates **and registers** a strategy from a spec (same shape as the JSON format). */
export function defineScalingStrategy(definition: ScalingStrategySpec, options: { register?: boolean } = {}): ScalingStrategy {
  let parent = DEFAULT_CONFIG;
  if (definition.extends !== undefined) {
    const p = getScalingStrategy(definition.extends);
    if (!p) throw new TypeError(`'${definition.id}' extends unknown strategy '${definition.extends}'`);
    parent = p.config;
  }
  const s = new ScalingStrategy(definition.id, configFromSpec(definition, parent, definition.id));
  return options.register === false ? s : registerScalingStrategy(s);
}

/** Registered strategy, built-in or preset for `id`. */
export function getScalingStrategy(id: string): ScalingStrategy | undefined {
  return registry.get(id) ?? builtInById.get(id.toLowerCase());
}

/** Like {@link getScalingStrategy} but throws a descriptive error. */
export function requireScalingStrategy(id: string): ScalingStrategy {
  const s = getScalingStrategy(id);
  if (!s) throw new TypeError(`No scaling strategy '${id}'. Registered: ${[...registry.keys()].sort().join(', ')}`);
  return s;
}

export function unregisterScalingStrategy(id: string): void {
  registry.delete(id);
  if (defaultStrategy?.id === id) defaultStrategy = null;
  if (cssStarted) writeCustomCss();
}

/** Strategies registered by the app (built-ins / presets excluded). */
export function registeredScalingStrategies(): readonly ScalingStrategy[] {
  return [...registry.values()];
}

/** Strategy used when none is passed (`cdp(16)`). Default: `BuiltInStrategies.SCALED` (same numbers as `sdp`). */
export function getDefaultScalingStrategy(): ScalingStrategy {
  return defaultStrategy ?? BuiltInStrategies.SCALED;
}

export function setDefaultScalingStrategy(strategy: ScalingStrategy | string | null): void {
  defaultStrategy = typeof strategy === 'string' ? requireScalingStrategy(strategy) : strategy;
  installResolver();
  if (cssStarted) writeCustomCss();
  else ensureCss();
}

/**
 * Parses a strategies document (JSON text or object, see `custom-strategy.schema.json`),
 * registers every strategy and applies its `default`. Returns the strategies by id.
 */
export function loadScalingStrategies(
  input: string | ScalingStrategiesDocument | ScalingStrategySpec | readonly ScalingStrategySpec[],
): Map<string, ScalingStrategy> {
  const { configs, defaultId } = parseStrategiesDocument(input, (id) => getScalingStrategy(id)?.config);
  const out = new Map<string, ScalingStrategy>();
  configs.forEach((cfg, id) => out.set(id, registerScalingStrategy(new ScalingStrategy(id, cfg))));
  if (defaultId !== undefined) setDefaultScalingStrategy(out.get(defaultId) ?? requireScalingStrategy(defaultId));
  return out;
}

/** JSON document for `strategies` (default: every registered strategy). */
export function exportScalingStrategies(strategies: readonly ScalingStrategy[] = registeredScalingStrategies()): ScalingStrategiesDocument {
  return {
    version: 1,
    ...(defaultStrategy ? { default: defaultStrategy.id } : {}),
    strategies: strategies.map((s) => s.toJSON()),
  };
}

/** Test helper — clears registry, default and CSS. */
export function resetScalingStrategiesForTest(): void {
  registry.clear();
  derived.clear();
  defaultStrategy = null;
  deviceResolver = null;
  stopCss();
}

const pick = (s?: ScalingStrategy | string): ScalingStrategy =>
  s === undefined ? getDefaultScalingStrategy() : typeof s === 'string' ? requireScalingStrategy(s) : s;

// ── Short functions (`cdp` / `csp`), mirroring `sdp` / `ssp` ──────────────────
/** `value` dp with `strategy` (default strategy when omitted) → CSS px. */
export const cdp = (value: number, strategy?: ScalingStrategy | string): number => pick(strategy).dp(value);
/** → device px. */
export const cdpPx = (value: number, strategy?: ScalingStrategy | string): number => pick(strategy).px(value);
/** Text → CSS px (font-scale policy applied). */
export const csp = (value: number, strategy?: ScalingStrategy | string): number => pick(strategy).sp(value);
/** Text → device px. */
export const cspPx = (value: number, strategy?: ScalingStrategy | string): number => pick(strategy).spPx(value);
/** Responsive CSS: `calc(16 * var(--cdp-<id>))` (or `var(--cdp)` for the default strategy). */
export const cdpCss = (value: number, strategy?: ScalingStrategy | string): string =>
  strategy === undefined && !getDefaultScalingStrategy().valueDependent ? (ensureCss(), `calc(${value} * var(--cdp))`) : pick(strategy).css(value);
/** Responsive CSS for text. */
export const cspCss = (value: number, strategy?: ScalingStrategy | string): string =>
  strategy === undefined && !getDefaultScalingStrategy().valueDependent ? (ensureCss(), `calc(${value} * var(--csp))`) : pick(strategy).cssSp(value);

/** Strategy helpers bound to one strategy (what the framework adapters hand out). */
export interface BoundScalingStrategy {
  readonly strategy: ScalingStrategy;
  dp(value: number): number;
  px(value: number): number;
  sp(value: number): number;
  spPx(value: number): number;
  css(value: number): string;
  cssSp(value: number): string;
  factor(): number;
  explain(): string;
}

/**
 * Binds helpers to `strategy`; `track` runs before every read so reactive frameworks can record
 * the snapshot dependency (Vue `metrics.value`, Angular signals…).
 */
export function bindScalingStrategy(strategy: ScalingStrategy, track: () => void = () => {}): BoundScalingStrategy {
  return Object.freeze({
    strategy,
    dp: (v: number) => (track(), strategy.dp(v)),
    px: (v: number) => (track(), strategy.px(v)),
    sp: (v: number) => (track(), strategy.sp(v)),
    spPx: (v: number) => (track(), strategy.spPx(v)),
    css: (v: number) => strategy.css(v),
    cssSp: (v: number) => strategy.cssSp(v),
    factor: () => (track(), strategy.factor()),
    explain: () => (track(), strategy.explain()),
  });
}

/** Resolves an optional strategy argument (instance, id, or the default). */
export function pickScalingStrategy(strategy?: ScalingStrategy | string | null): ScalingStrategy {
  return strategy == null ? getDefaultScalingStrategy() : typeof strategy === 'string' ? requireScalingStrategy(strategy) : strategy;
}

// ─────────────────────────────────────────────────────────────────────────────
// CSS custom properties
// ─────────────────────────────────────────────────────────────────────────────

const STYLE_ID = 'webdimens-custom-vars';
let cssStarted = false;
let unsubscribe: (() => void) | null = null;
let styleEl: HTMLStyleElement | null = null;

/** `--cdp-<id>:…px;--csp-<id>:…px;` for `metrics` (viewport by default) — also usable on scoped elements. */
export function customCssDeclarations(
  metrics: DimenMetrics = current(),
  strategies: readonly ScalingStrategy[] = registeredScalingStrategies(),
): string {
  let out = '';
  const d = getDefaultScalingStrategy();
  out += `--cdp:${round(d.factor(metrics))}px;--csp:${round(d.resolve(metrics).scaleSpDp(1))}px;`;
  for (const s of strategies) {
    const r = s.resolve(metrics);
    out += `${s.cssVar}:${round(r.factor)}px;${s.cssSpVar}:${round(r.scaleSpDp(1))}px;`;
  }
  return out;
}

function writeCustomCss(): void {
  if (typeof document === 'undefined') return;
  if (!styleEl) {
    styleEl = document.getElementById(STYLE_ID) as HTMLStyleElement | null;
    if (!styleEl) {
      styleEl = document.createElement('style');
      styleEl.id = STYLE_ID;
      document.head.appendChild(styleEl);
    }
  }
  const text = `:root:root{${customCssDeclarations(getMetrics())}}`;
  if (styleEl.textContent !== text) styleEl.textContent = text;
}

/**
 * Starts publishing the custom CSS properties in the browser. Automatic as soon as a strategy is
 * registered, the default changes, or `css()` / `cdpCss()` runs; call it yourself when your CSS
 * only uses the default `16cdp` / `var(--cdp)` without defining any strategy.
 */
export function installCustomCss(): void {
  installResolver();
  ensureCss();
}

function ensureCss(): void {
  if (cssStarted || typeof document === 'undefined') return;
  cssStarted = true;
  unsubscribe = subscribe(() => writeCustomCss());
  writeCustomCss();
}

function stopCss(): void {
  resolverInstalled = false;
  setCustomLiteralResolver(null);
  cssStarted = false;
  unsubscribe?.();
  unsubscribe = null;
  styleEl?.remove();
  styleEl = null;
}

// Lets the core literal helpers (`dimen('16cdp-brand')`, `dimensPx`) resolve custom literals in JS.
// Installed lazily (on registration / default change / CSS start) so the module has no import-time
// side effects and stays tree-shakable.
let resolverInstalled = false;
function installResolver(): void {
  if (resolverInstalled) return;
  resolverInstalled = true;
  setCustomLiteralResolver((value, kind, id) => {
    const s = id ? requireScalingStrategy(id) : getDefaultScalingStrategy();
    return kind === 'sp' ? s.sp(value) : s.dp(value);
  }, () => ensureCss());
}
