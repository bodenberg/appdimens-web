/**
 * webdimens/resize — constraint-based auto-fit (Android `appdimens-dynamic-resize`).
 *
 * Not a global scaling curve: picks the LARGEST size in `[min, max]` (with `step`
 * granularity) that still fits the available space, by binary search over a step table.
 *
 * - Pure math: `buildResizeStepsPx`, `findLargestFittingResizePx`, `ResizeRangePx`.
 * - Bounds: `resizeFixedDp`, `resizeFixedSp`, `resizePercentSw/W/H`, `resizePercentBox`.
 * - Text: `fittingTextSize` / `autoResizeText` (DOM, exact) and `fittingTextPx` (canvas, no reflow).
 * - Boxes: `fittingBoxPx`.
 */
import { AutoResizePercentBasis, DpQualifier } from './core/enums';
import type { DimenMetrics } from './core/metrics';
import { getMetrics } from './core/runtime';
import { readScreenDp } from './core/strategy';

export { AutoResizePercentBasis };

const MAX_RESIZE_STEPS = 4096;

/** Ascending samples from `min` to `max` inclusive every `step` (single sample when step ≤ 0). */
export function buildResizeStepsPx(minPx: number, maxPx: number, stepPx: number): Float64Array {
  const lo = Math.min(minPx, maxPx);
  const hi = Math.max(minPx, maxPx);
  if (!(stepPx > 0)) return Float64Array.of(lo);
  const capacity = Math.min(Math.max(Math.floor((hi - lo) / stepPx) + 2, 1), MAX_RESIZE_STEPS);
  const buf = new Float64Array(capacity);
  const epsilon = stepPx * 1e-4;
  let count = 0;
  for (let x = lo; x <= hi + epsilon && count < capacity; x += stepPx) buf[count++] = Math.min(x, hi);
  if (count === 0) buf[count++] = lo;
  if (buf[count - 1]! < hi - epsilon && count < capacity) buf[count++] = hi;
  return count === capacity ? buf : buf.slice(0, count);
}

/** Largest step for which `fits` is true (binary search, O(log n)); `0` when none fits. */
export function findLargestFittingResizePx(sortedStepsPx: ArrayLike<number>, fits: (candidatePx: number) => boolean): number {
  const n = sortedStepsPx.length;
  if (n === 0) return 0;
  if (n === 1) return fits(sortedStepsPx[0]!) ? sortedStepsPx[0]! : 0;
  let left = 0;
  let right = n - 1;
  let best = 0;
  while (left <= right) {
    const mid = (left + right) >>> 1;
    const v = sortedStepsPx[mid]!;
    if (fits(v)) {
      best = v;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }
  return best;
}

/** Normalized `[low, high]` range with its precomputed step table. */
export class ResizeRangePx {
  readonly lowPx: number;
  readonly highPx: number;
  readonly steps: Float64Array;
  constructor(
    readonly minPx: number,
    readonly maxPx: number,
    readonly stepPx: number,
  ) {
    this.lowPx = Math.min(minPx, maxPx);
    this.highPx = Math.max(minPx, maxPx);
    this.steps = buildResizeStepsPx(this.lowPx, this.highPx, stepPx);
  }
  resolveFitting(fits: (candidatePx: number) => boolean): number {
    return findLargestFittingResizePx(this.steps, fits);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Bounds
// ─────────────────────────────────────────────────────────────────────────────

export type ResizeBound =
  | { readonly kind: 'dp'; readonly dp: number }
  | { readonly kind: 'sp'; readonly sp: number }
  | { readonly kind: 'percent'; readonly value: number; readonly axis: DpQualifier }
  | { readonly kind: 'box'; readonly value: number; readonly basis: AutoResizePercentBasis };

/** Fixed logical length (dp == CSS px). */
export const resizeFixedDp = (dp: number): ResizeBound => ({ kind: 'dp', dp });
/** Text size in sp (× user font scale). */
export const resizeFixedSp = (sp: number): ResizeBound => ({ kind: 'sp', sp });
/** 0–100 % of the smallest viewport side. */
export const resizePercentSw = (percent: number): ResizeBound => ({ kind: 'percent', value: percent, axis: DpQualifier.SMALL_WIDTH });
/** 0–100 % of the viewport width. */
export const resizePercentW = (percent: number): ResizeBound => ({ kind: 'percent', value: percent, axis: DpQualifier.WIDTH });
/** 0–100 % of the viewport height. */
export const resizePercentH = (percent: number): ResizeBound => ({ kind: 'percent', value: percent, axis: DpQualifier.HEIGHT });
/** 0–100 % of the measured box (inner width / height / min side). */
export const resizePercentBox = (
  percent: number,
  basis: AutoResizePercentBasis = AutoResizePercentBasis.MIN_SIDE,
): ResizeBound => ({ kind: 'box', value: percent, basis });

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);

/**
 * Resolves a bound to CSS px. `box` bounds need the inner box size.
 * (Android `ResizeBound.resolveToPx`; multiply by `devicePixelRatio` for device px.)
 */
export function resolveBound(
  bound: ResizeBound | number,
  box?: { width: number; height: number },
  metrics: DimenMetrics = getMetrics(),
): number {
  if (typeof bound === 'number') return Math.max(bound, 0) * metrics.fontScale;
  switch (bound.kind) {
    case 'dp':
      return Math.max(bound.dp, 0);
    case 'sp':
      return Math.max(bound.sp, 0) * metrics.fontScale;
    case 'percent':
      return (clamp(bound.value, 0, 100) / 100) * readScreenDp(metrics, bound.axis);
    case 'box': {
      const w = box?.width ?? 0;
      const h = box?.height ?? 0;
      const edge =
        bound.basis === AutoResizePercentBasis.WIDTH ? w : bound.basis === AutoResizePercentBasis.HEIGHT ? h : Math.min(w, h);
      return (clamp(bound.value, 0, 100) / 100) * edge;
    }
  }
}

/**
 * Largest step of `[min, max]` not exceeding `availablePx` — square/width/height boxes.
 * Plain numbers are dp (CSS px) here, as Android box resize; the text fitters read plain numbers as sp.
 */
export function fittingBoxPx(
  min: ResizeBound | number,
  max: ResizeBound | number,
  step: ResizeBound | number,
  availablePx: number,
  box?: { width: number; height: number },
): number {
  const m = getMetrics();
  const asDp = (b: ResizeBound | number): number => (typeof b === 'number' ? b : resolveBound(b, box, m));
  const range = new ResizeRangePx(asDp(min), asDp(max), asDp(step));
  return range.resolveFitting((px) => px <= availablePx + 0.01);
}

// ─────────────────────────────────────────────────────────────────────────────
// Text — DOM (exact, uses the element's own CSS) and canvas (no reflow) variants.
// ─────────────────────────────────────────────────────────────────────────────

export interface TextFitOptions {
  /** Minimum size: number = sp (× font scale) or a ResizeBound. Default 8. */
  min?: ResizeBound | number;
  /** Maximum size: number = sp or a ResizeBound. Default 96. */
  max?: ResizeBound | number;
  /** Step: number = sp or a ResizeBound. Default 1 (sp). */
  step?: ResizeBound | number;
  /** Maximum number of lines (default: unlimited, only the box constrains). */
  maxLines?: number;
}

/** Inner (padding excluded) size of an element. */
function innerBox(el: HTMLElement): { width: number; height: number } {
  const cs = getComputedStyle(el);
  const px = (v: string): number => parseFloat(v) || 0;
  return {
    width: el.clientWidth - px(cs.paddingLeft) - px(cs.paddingRight),
    height: el.clientHeight - px(cs.paddingTop) - px(cs.paddingBottom),
  };
}

/**
 * Rendered line count of `el`'s content. Uses the line boxes of the text (distinct
 * `Range.getClientRects()` tops) when layout is available; otherwise measures the
 * unclamped content height at `height: auto` and divides by the line height.
 */
function countRenderedLines(el: HTMLElement, fontPx: number, paddingY: number): number {
  if (typeof document !== 'undefined' && typeof document.createRange === 'function') {
    const range = document.createRange();
    range.selectNodeContents(el);
    const rects = typeof range.getClientRects === 'function' ? range.getClientRects() : null;
    if (rects && rects.length > 0) {
      const tops: number[] = [];
      const tolerance = fontPx * 0.5;
      for (let i = 0; i < rects.length; i++) {
        const r = rects[i]!;
        if (r.width === 0 && r.height === 0) continue;
        if (!tops.some((t) => Math.abs(t - r.top) < tolerance)) tops.push(r.top);
      }
      if (tops.length > 0) return tops.length;
    }
  }
  const style = el.style;
  const height = style.height;
  const minHeight = style.minHeight;
  const maxHeight = style.maxHeight;
  style.height = 'auto';
  style.minHeight = '0';
  style.maxHeight = 'none';
  const content = el.scrollHeight - paddingY;
  style.height = height;
  style.minHeight = minHeight;
  style.maxHeight = maxHeight;
  return Math.max(1, Math.round(content / lineHeightPx(el, fontPx)));
}

function lineHeightPx(el: HTMLElement, fontPx: number): number {
  const lh = getComputedStyle(el).lineHeight;
  if (lh.endsWith('px')) return parseFloat(lh);
  const n = parseFloat(lh);
  return Number.isFinite(n) ? n * fontPx : fontPx * 1.2;
}

/**
 * Finds the largest font size (CSS px) at which `element`'s content fits its own box
 * (and `maxLines`). Applies the result to `element.style.fontSize` and returns it.
 * The element needs a constrained width (and height, unless `maxLines` is set).
 */
export function fittingTextSize(element: HTMLElement, options: TextFitOptions = {}): number {
  const m = getMetrics();
  const box = innerBox(element);
  const range = new ResizeRangePx(
    resolveBound(options.min ?? 8, box, m),
    resolveBound(options.max ?? 96, box, m),
    resolveBound(options.step ?? 1, box, m),
  );
  const style = element.style;
  const previous = style.fontSize;
  const cs = getComputedStyle(element);
  const paddingY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
  const fits = (px: number): boolean => {
    style.fontSize = `${px}px`;
    if (element.scrollWidth > element.clientWidth + 0.5) return false;
    if (element.scrollHeight > element.clientHeight + 0.5) return false;
    return options.maxLines === undefined || countRenderedLines(element, px, paddingY) <= options.maxLines;
  };
  const best = range.resolveFitting(fits) || range.lowPx;
  style.fontSize = best > 0 ? `${best}px` : previous;
  return best;
}

export interface AutoResizeTextController {
  /** Last applied font size (CSS px). */
  readonly fontSize: number;
  /** Re-fits now. */
  refit(): number;
  /** Stops observing size and content changes. */
  disconnect(): void;
}

/**
 * Keeps `element`'s font size fitted while its box, text or the viewport snapshot change
 * (ResizeObserver + MutationObserver, coalesced to one fit per animation frame).
 */
export function autoResizeText(element: HTMLElement, options: TextFitOptions = {}): AutoResizeTextController {
  let size = fittingTextSize(element, options);
  let frame = 0;
  let width = element.clientWidth;
  let height = element.clientHeight;
  const raf: (cb: () => void) => number =
    typeof requestAnimationFrame === 'function' ? requestAnimationFrame : (cb) => setTimeout(cb, 16) as unknown as number;
  const caf: (id: number) => void = typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame : clearTimeout;
  const schedule = (): void => {
    if (frame) return;
    frame = raf(() => {
      frame = 0;
      size = fittingTextSize(element, options);
      width = element.clientWidth;
      height = element.clientHeight;
    });
  };
  const ro =
    typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver(() => {
          // Ignore the resize caused by our own font-size write.
          if (element.clientWidth !== width || element.clientHeight !== height) schedule();
        })
      : null;
  ro?.observe(element);
  const mo =
    typeof MutationObserver !== 'undefined' ? new MutationObserver(() => schedule()) : null;
  mo?.observe(element, { childList: true, characterData: true, subtree: true });
  const onWindow = (): void => schedule();
  if (typeof window !== 'undefined') window.addEventListener('resize', onWindow, { passive: true });
  return {
    get fontSize() {
      return size;
    },
    refit() {
      size = fittingTextSize(element, options);
      return size;
    },
    disconnect() {
      ro?.disconnect();
      mo?.disconnect();
      if (typeof window !== 'undefined') window.removeEventListener('resize', onWindow);
      if (frame) caf(frame);
      frame = 0;
    },
  };
}

export interface CanvasTextFitOptions extends TextFitOptions {
  text: string;
  /** Available width in CSS px. */
  maxWidth: number;
  /** Available height in CSS px (optional when `maxLines` is set). */
  maxHeight?: number;
  /** CSS font; the size is replaced per candidate, e.g. `"600 system-ui, sans-serif"`. Default `sans-serif`. */
  font?: string;
  /** Line height multiplier. Default 1.2. */
  lineHeight?: number;
  /** Letter spacing in CSS px applied per character. Default 0. */
  letterSpacing?: number;
}

let measureCtx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null | undefined;

function ctx2d(): CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D | null {
  if (measureCtx !== undefined) return measureCtx;
  try {
    measureCtx =
      typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(1, 1).getContext('2d')
        : typeof document !== 'undefined'
          ? document.createElement('canvas').getContext('2d')
          : null;
  } catch {
    measureCtx = null;
  }
  return measureCtx;
}

/** Greedy word wrap → number of lines needed at the current context font. */
function countLines(
  c: { measureText(t: string): { width: number } },
  text: string,
  maxWidth: number,
  spacing: number,
  limit: number,
): number {
  const width = (t: string): number => c.measureText(t).width + spacing * t.length;
  const limitWidth = maxWidth + 0.01; // tolerate float noise at the exact boundary
  let lines = 0;
  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = '';
    lines++;
    for (const word of words) {
      if (width(word) > limitWidth) return Infinity; // a single word cannot fit
      const candidate = line ? `${line} ${word}` : word;
      if (width(candidate) <= limitWidth) {
        line = candidate;
      } else {
        lines++;
        line = word;
      }
      if (lines > limit) return lines;
    }
  }
  return lines;
}

const FONT_PREFIX = /^(?:normal|italic|oblique|small-caps|bold|bolder|lighter|condensed|expanded|ultra-condensed|extra-condensed|semi-condensed|semi-expanded|extra-expanded|ultra-expanded|\d{1,4})$/i;

/** `"600 italic Inter, sans-serif"` + 20 → `"600 italic 20px Inter, sans-serif"`. Strips any size already present. */
export function canvasFont(font: string, px: number): string {
  const tokens = font.trim().split(/\s+/);
  const prefix: string[] = [];
  while (tokens.length > 1 && FONT_PREFIX.test(tokens[0]!)) prefix.push(tokens.shift()!);
  if (tokens.length > 1 && /^[\d.]+(px|pt|em|rem|%)?(\/[^\s]+)?$/i.test(tokens[0]!)) tokens.shift();
  return [...prefix, `${px}px`, ...tokens].join(' ');
}

/**
 * Canvas-based text fitting (no DOM reflow — ideal for many labels or canvas/WebGL UIs).
 * Returns the largest font size in CSS px, or 0 when nothing fits.
 */
export function fittingTextPx(options: CanvasTextFitOptions): number {
  const c = ctx2d();
  const m = getMetrics();
  const range = new ResizeRangePx(
    resolveBound(options.min ?? 8, undefined, m),
    resolveBound(options.max ?? 96, undefined, m),
    resolveBound(options.step ?? 1, undefined, m),
  );
  const family = options.font ?? 'sans-serif';
  const lh = options.lineHeight ?? 1.2;
  const maxLines = options.maxLines ?? Infinity;
  const spacing = options.letterSpacing ?? 0;
  return range.resolveFitting((px) => {
    let lines: number;
    if (c) {
      c.font = canvasFont(family, px);
      lines = countLines(c, options.text, options.maxWidth, spacing, maxLines);
    } else {
      // Headless fallback: average glyph ≈ 0.55em.
      lines = countLines({ measureText: (t) => ({ width: t.length * px * 0.55 }) }, options.text, options.maxWidth, spacing, maxLines);
    }
    if (!Number.isFinite(lines) || lines > maxLines) return false;
    return options.maxHeight === undefined || lines * px * lh <= options.maxHeight + 0.01;
  });
}
