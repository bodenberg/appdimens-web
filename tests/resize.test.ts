import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setMetrics } from '../src/index';
import {
  AutoResizePercentBasis,
  ResizeRangePx,
  autoResizeText,
  buildResizeStepsPx,
  findLargestFittingResizePx,
  fittingBoxPx,
  fittingTextPx,
  fittingTextSize,
  resizeFixedDp,
  resizeFixedSp,
  resizePercentBox,
  resizePercentH,
  resizePercentSw,
  resizePercentW,
  resolveBound,
} from '../src/resize';

interface Viewport {
  width: number;
  height: number;
  density?: number;
  fontScale?: number;
  multiWindow?: boolean;
}

/** Pins the viewport snapshot so every expectation is deterministic. */
function pin(v: Viewport = { width: 400, height: 300 }): void {
  setMetrics({
    screenWidthDp: v.width,
    screenHeightDp: v.height,
    density: v.density ?? 1,
    fontScale: v.fontScale ?? 1,
    isInMultiWindowMode: v.multiWindow ?? false,
  });
}

/** `font` shorthand as a browser parses it: optional style/weight keywords, a size, then a family that is not a number. */
const CSS_FONT_SHORTHAND = /^(?:(?:italic|oblique|normal|bold|\d{3})\s+)*\d+(?:\.\d+)?px\s+(?!\d)\S/;

/** Greedy word wrap at a font size: how many lines `text` needs in `width` (0.55em glyphs). */
function wrapLines(text: string, px: number, width: number, glyphEm: number): number {
  let lines = 0;
  for (const paragraph of text.split('\n')) {
    let line = '';
    lines++;
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const candidate = line ? `${line} ${word}` : word;
      if (!line || candidate.length * px * glyphEm <= width) {
        line = candidate;
      } else {
        lines++;
        line = word;
      }
    }
  }
  return lines;
}

interface LayoutModel {
  /** clientWidth (padding box). Mutable so tests can simulate a resize. */
  width: number;
  /** clientHeight; `'auto'` grows with the content. */
  height: number | 'auto';
  /** Default true. When false the text never wraps. */
  wrap?: boolean;
}

/**
 * jsdom does not lay out text, so the element's size metrics are stubbed. The model reads
 * the live `textContent` and `style.fontSize` on every access, like a real layout would.
 */
function stubLayout(el: HTMLElement, model: LayoutModel): void {
  const glyphEm = 0.55;
  const lineHeightEm = 1.2;
  const wrap = model.wrap !== false;
  const fontPx = (): number => parseFloat(el.style.fontSize) || 16;
  const text = (): string => el.textContent ?? '';
  const lines = (): number => (wrap ? wrapLines(text(), fontPx(), model.width, glyphEm) : 1);
  const contentHeight = (): number => lines() * fontPx() * lineHeightEm;
  const widestLine = (): number => {
    const longest = wrap ? Math.max(0, ...text().split(/\s+/).map((w) => w.length)) : text().length;
    return longest * fontPx() * glyphEm;
  };
  Object.defineProperty(el, 'clientWidth', { configurable: true, get: () => model.width });
  Object.defineProperty(el, 'clientHeight', {
    configurable: true,
    get: () => (model.height === 'auto' || el.style.height === 'auto' ? contentHeight() : model.height),
  });
  Object.defineProperty(el, 'scrollWidth', { configurable: true, get: () => Math.max(model.width, widestLine()) });
  Object.defineProperty(el, 'scrollHeight', {
    configurable: true,
    get: () => Math.max(el.clientHeight, contentHeight()),
  });
}

function mount(): HTMLDivElement {
  const el = document.createElement('div');
  document.body.append(el);
  return el;
}

beforeEach(() => pin());

afterEach(() => {
  setMetrics(null);
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

// ─────────────────────────────────────────────────────────────────────────────

describe('buildResizeStepsPx', () => {
  it('returns ascending samples from min to max inclusive every step', () => {
    const steps = buildResizeStepsPx(10, 20, 2);
    expect(steps).toBeInstanceOf(Float64Array);
    expect(Array.from(steps)).toEqual([10, 12, 14, 16, 18, 20]);
  });

  it('normalizes swapped min and max', () => {
    expect(Array.from(buildResizeStepsPx(20, 10, 2))).toEqual([10, 12, 14, 16, 18, 20]);
  });

  it('appends max when the range is not a multiple of the step', () => {
    expect(Array.from(buildResizeStepsPx(10, 15, 2))).toEqual([10, 12, 14, 15]);
  });

  it('returns a single sample at min when the step is zero, negative or NaN', () => {
    expect(Array.from(buildResizeStepsPx(10, 20, 0))).toEqual([10]);
    expect(Array.from(buildResizeStepsPx(10, 20, -3))).toEqual([10]);
    expect(Array.from(buildResizeStepsPx(10, 20, Number.NaN))).toEqual([10]);
    expect(Array.from(buildResizeStepsPx(20, 10, 0))).toEqual([10]);
  });

  it('returns a single sample when min equals max', () => {
    expect(Array.from(buildResizeStepsPx(7, 7, 1))).toEqual([7]);
  });

  it('keeps only max as the extra sample when the step overshoots the range', () => {
    expect(Array.from(buildResizeStepsPx(10, 11, 5))).toEqual([10, 11]);
  });

  it('does not drift with fractional steps', () => {
    expect(Array.from(buildResizeStepsPx(0, 1, 0.25))).toEqual([0, 0.25, 0.5, 0.75, 1]);
    const tenth = buildResizeStepsPx(0, 1, 0.1);
    expect(tenth.length).toBe(11);
    expect(tenth[tenth.length - 1]).toBeCloseTo(1, 12);
  });

  it('caps the table at 4096 ascending samples', () => {
    const steps = buildResizeStepsPx(0, 100000, 1);
    expect(steps.length).toBe(4096);
    expect(steps[0]).toBe(0);
    expect(steps[4095]).toBe(4095);
    for (let i = 1; i < steps.length; i++) expect(steps[i]).toBeGreaterThan(steps[i - 1]);
  });
});

describe('findLargestFittingResizePx', () => {
  const steps8to96 = buildResizeStepsPx(8, 96, 1);

  it('returns the largest step that fits', () => {
    expect(findLargestFittingResizePx(steps8to96, (px) => px <= 40)).toBe(40);
  });

  it('returns the last step when everything fits', () => {
    expect(findLargestFittingResizePx(steps8to96, () => true)).toBe(96);
  });

  it('returns 0 when nothing fits', () => {
    expect(findLargestFittingResizePx(steps8to96, () => false)).toBe(0);
  });

  it('returns 0 for an empty table without calling fits', () => {
    const fits = vi.fn(() => true);
    expect(findLargestFittingResizePx([], fits)).toBe(0);
    expect(fits).not.toHaveBeenCalled();
  });

  it('handles a single-step table', () => {
    const fits = vi.fn((px: number) => px <= 10);
    expect(findLargestFittingResizePx([10], fits)).toBe(10);
    expect(findLargestFittingResizePx([12], () => false)).toBe(0);
    expect(fits).toHaveBeenCalledTimes(1);
  });

  it('accepts plain arrays', () => {
    expect(findLargestFittingResizePx([1, 2, 3, 4], (v) => v < 3)).toBe(2);
  });

  it('probes the table in O(log n) calls', () => {
    const steps = buildResizeStepsPx(1, 1000, 1);
    const fits = vi.fn((px: number) => px <= 437);
    expect(findLargestFittingResizePx(steps, fits)).toBe(437);
    expect(fits.mock.calls.length).toBeLessThanOrEqual(11);
  });
});

describe('ResizeRangePx', () => {
  it('normalizes the bounds and precomputes the step table', () => {
    const r = new ResizeRangePx(96, 8, 1);
    expect(r.minPx).toBe(96);
    expect(r.maxPx).toBe(8);
    expect(r.lowPx).toBe(8);
    expect(r.highPx).toBe(96);
    expect(r.steps.length).toBe(89);
    expect(r.steps[0]).toBe(8);
    expect(r.steps[88]).toBe(96);
  });

  it('resolveFitting returns the largest fitting step', () => {
    expect(new ResizeRangePx(8, 96, 1).resolveFitting((px) => px <= 50.5)).toBe(50);
  });

  it('resolveFitting returns 0 when nothing fits', () => {
    expect(new ResizeRangePx(8, 96, 1).resolveFitting(() => false)).toBe(0);
  });

  it('a zero step collapses the table to the lower bound', () => {
    const r = new ResizeRangePx(10, 20, 0);
    expect(Array.from(r.steps)).toEqual([10]);
    expect(r.resolveFitting(() => true)).toBe(10);
  });
});

describe('bounds (resolveBound)', () => {
  it('resizeFixedDp resolves to the dp value, ignores font scale and clamps negatives to 0', () => {
    pin({ width: 400, height: 300, fontScale: 1.5 });
    expect(resolveBound(resizeFixedDp(24))).toBe(24);
    expect(resolveBound(resizeFixedDp(-5))).toBe(0);
  });

  it('resizeFixedSp multiplies by the font scale and clamps negatives to 0', () => {
    pin({ width: 400, height: 300, fontScale: 1.5 });
    expect(resolveBound(resizeFixedSp(16))).toBe(24);
    expect(resolveBound(resizeFixedSp(-16))).toBe(0);
  });

  it('a plain number is treated as sp', () => {
    pin({ width: 400, height: 300, fontScale: 1.5 });
    expect(resolveBound(16)).toBe(24);
    expect(resolveBound(-4)).toBe(0);
  });

  it('percent bounds are a share of the matching viewport axis', () => {
    pin({ width: 400, height: 300 });
    expect(resolveBound(resizePercentW(50))).toBeCloseTo(200, 9);
    expect(resolveBound(resizePercentH(50))).toBeCloseTo(150, 9);
    expect(resolveBound(resizePercentSw(50))).toBeCloseTo(150, 9);
  });

  it('SMALL_WIDTH uses the smaller viewport side in both orientations', () => {
    pin({ width: 400, height: 300 });
    expect(resolveBound(resizePercentSw(10))).toBeCloseTo(30, 9);
    pin({ width: 300, height: 700 });
    expect(resolveBound(resizePercentSw(10))).toBeCloseTo(30, 9);
    expect(resolveBound(resizePercentH(10))).toBeCloseTo(70, 9);
  });

  it('clamps percent values to 0..100', () => {
    pin({ width: 400, height: 300 });
    expect(resolveBound(resizePercentW(150))).toBeCloseTo(400, 9);
    expect(resolveBound(resizePercentW(-20))).toBe(0);
  });

  it('box bounds are a share of the given box width, height or min side', () => {
    const box = { width: 200, height: 100 };
    expect(resolveBound(resizePercentBox(50, AutoResizePercentBasis.WIDTH), box)).toBe(100);
    expect(resolveBound(resizePercentBox(50, AutoResizePercentBasis.HEIGHT), box)).toBe(50);
    expect(resolveBound(resizePercentBox(50, AutoResizePercentBasis.MIN_SIDE), box)).toBe(50);
    expect(resolveBound(resizePercentBox(250, AutoResizePercentBasis.WIDTH), box)).toBe(200);
  });

  it('box MIN_SIDE is the smaller box side, and is the default basis', () => {
    expect(resolveBound(resizePercentBox(50), { width: 80, height: 120 })).toBe(40);
  });

  it('a box bound without a box resolves to 0', () => {
    expect(resolveBound(resizePercentBox(50, AutoResizePercentBasis.WIDTH))).toBe(0);
  });
});

describe('fittingBoxPx', () => {
  it('returns the largest step not exceeding the available space', () => {
    expect(fittingBoxPx(8, 96, 1, 40)).toBe(40);
  });

  it('tolerates sub-0.01 px rounding of the available space', () => {
    expect(fittingBoxPx(8, 96, 1, 40.009)).toBe(40);
    expect(fittingBoxPx(8, 96, 1, 39.9)).toBe(39);
  });

  it('returns 0 when even the minimum does not fit', () => {
    expect(fittingBoxPx(8, 96, 1, 5)).toBe(0);
  });

  it('resolves percent-of-box bounds against the box', () => {
    const box = { width: 400, height: 300 };
    const min = resizePercentBox(10, AutoResizePercentBasis.WIDTH); // 40
    const max = resizePercentBox(50, AutoResizePercentBasis.WIDTH); // 200
    expect(fittingBoxPx(min, max, resizeFixedDp(1), 100, box)).toBeCloseTo(100, 9);
  });

  it('scales sp bounds with the font scale', () => {
    pin({ width: 400, height: 300, fontScale: 1.5 });
    // steps 12, 13.5, … 39, 40.5 → 39 is the largest that fits 40px
    expect(fittingBoxPx(resizeFixedSp(8), resizeFixedSp(96), resizeFixedSp(1), 40)).toBe(39);
  });
});

describe('fittingTextPx (headless glyph model, jsdom has no canvas)', () => {
  beforeEach(() => {
    // jsdom logs "not implemented" for getContext; a null context selects the headless fallback silently.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
  });

  it('fits a word within maxWidth using 0.55em glyphs', () => {
    // "Hello": 5 glyphs × px × 0.55 ≤ 100  →  px ≤ 36.4
    expect(fittingTextPx({ text: 'Hello', maxWidth: 100, maxLines: 1 })).toBe(36);
  });

  it('fits a word whose width is just under maxWidth', () => {
    // "Hello" at 40px is 110px wide, which fits maxWidth 110.5 (41px is 112.75px)
    expect(fittingTextPx({ text: 'Hello', maxWidth: 110.5, maxLines: 1 })).toBe(40);
  });

  it('accepts a width that lands exactly on maxWidth despite float noise', () => {
    // 5 * 40 * 0.55 is 110.00000000000001 in IEEE-754; countLines tolerates +0.01 so 40px still fits.
    expect(fittingTextPx({ text: 'Hello', maxWidth: 110, maxLines: 1 })).toBe(40);
  });

  it('honours maxHeight using the line height (default 1.2)', () => {
    // one line of "aaaa bbbb" in a wide box: 1.2 × px ≤ 40 → px ≤ 33.3
    expect(fittingTextPx({ text: 'aaaa bbbb', maxWidth: 1000, maxHeight: 40 })).toBe(33);
  });

  it('honours a custom lineHeight multiplier', () => {
    expect(fittingTextPx({ text: 'aaaa bbbb', maxWidth: 1000, maxHeight: 40, lineHeight: 2 })).toBe(20);
  });

  it('counts wrapped lines against maxHeight', () => {
    // at maxWidth 60 the text wraps to 2 lines from px 13 up; 2 × 1.2 × px ≤ 40 → px ≤ 16.6
    expect(fittingTextPx({ text: 'aaaa bbbb', maxWidth: 60, maxHeight: 40 })).toBe(16);
  });

  it('limits the number of wrapped lines with maxLines', () => {
    // one line: 14 glyphs × 0.55 × px ≤ 100 → px ≤ 12.9
    expect(fittingTextPx({ text: 'aaaa aaaa aaaa', maxWidth: 100, maxLines: 1 })).toBe(12);
    // two lines ("aaaa aaaa" / "aaaa") hold up to px 20 (9 × 0.55 × 20 = 99)
    expect(fittingTextPx({ text: 'aaaa aaaa aaaa', maxWidth: 100, maxLines: 2 })).toBe(20);
  });

  it('returns 0 when a single word is wider than maxWidth even at the minimum size', () => {
    expect(fittingTextPx({ text: 'Supercalifragilistic', maxWidth: 50, maxLines: 1 })).toBe(0);
  });

  it('returns 0 for a too-wide word when the limit is maxHeight rather than maxLines', () => {
    expect(fittingTextPx({ text: 'Supercalifragilistic', maxWidth: 50, maxHeight: 1000 })).toBe(0);
  });

  it('honours custom min, max and step', () => {
    // 'Hello' ≤ 60px wide: 2.75 × px ≤ 60 → px ≤ 21.8; steps are 8, 12, 16, 20, 24 …
    expect(fittingTextPx({ text: 'Hello', maxWidth: 60, maxLines: 1, min: 8, max: 40, step: 4 })).toBe(20);
    // no width pressure: the max bound is returned
    expect(fittingTextPx({ text: 'Hi', maxWidth: 10000, maxLines: 1, min: 10, max: 20, step: 2 })).toBe(20);
  });

  it('resolves sp ResizeBound limits against the font scale', () => {
    pin({ width: 400, height: 300, fontScale: 1.5 });
    expect(fittingTextPx({ text: 'Hi', maxWidth: 10000, min: resizeFixedSp(8), max: resizeFixedSp(96) })).toBe(144);
  });
});

describe('fittingTextPx with a 2d canvas context', () => {
  /** Minimal 2d context: 0.5em per glyph, and it ignores font assignments a browser would reject. */
  function fakeCanvas2d(): { ctx: CanvasRenderingContext2D; fonts: string[] } {
    const fonts: string[] = [];
    let current = '10px sans-serif';
    const ctx = {
      get font(): string {
        return current;
      },
      set font(value: string) {
        fonts.push(value);
        if (CSS_FONT_SHORTHAND.test(value)) current = value;
      },
      measureText(text: string): { width: number } {
        const px = Number(/(\d+(?:\.\d+)?)px/.exec(current)?.[1]);
        return { width: text.length * px * 0.5 };
      },
    };
    return { ctx: ctx as unknown as CanvasRenderingContext2D, fonts };
  }

  it('measures with the canvas context when one is available', async () => {
    // The 2d context is cached per module instance, so load a fresh copy of the module.
    vi.resetModules();
    const { ctx, fonts } = fakeCanvas2d();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => ctx) as never);
    const resize = await import('../src/resize');
    const fresh = await import('../src/index');
    fresh.setMetrics({ screenWidthDp: 400, screenHeightDp: 300 });
    try {
      // 5 glyphs × px × 0.5 ≤ 100 → px ≤ 40 (exact in binary)
      expect(resize.fittingTextPx({ text: 'Hello', maxWidth: 100, maxLines: 1 })).toBe(40);
      expect(fonts).toContain('40px sans-serif');
    } finally {
      fresh.setMetrics(null);
    }
  });

  it('places the size between the weight and the family of a font option', async () => {
    vi.resetModules();
    const { ctx } = fakeCanvas2d();
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation((() => ctx) as never);
    const resize = await import('../src/resize');
    const fresh = await import('../src/index');
    fresh.setMetrics({ screenWidthDp: 400, screenHeightDp: 300 });
    try {
      // "600 system-ui, sans-serif" must become "600 40px system-ui, sans-serif" (valid shorthand);
      // a size placed before the weight would be ignored by the context and never shrink the text.
      expect(
        resize.fittingTextPx({ text: 'Hello', maxWidth: 100, maxLines: 1, font: '600 system-ui, sans-serif' }),
      ).toBe(40);
    } finally {
      fresh.setMetrics(null);
    }
  });
});

describe('fittingTextSize (DOM, layout stubbed)', () => {
  it('picks the largest size whose single line fits the width and applies it', () => {
    const el = mount();
    stubLayout(el, { width: 200, height: 100, wrap: false });
    el.textContent = 'Hello';
    // 5 × px × 0.55 ≤ 200.5 (overflow tolerance 0.5px) → px ≤ 72.9
    expect(fittingTextSize(el)).toBe(72);
    expect(el.style.fontSize).toBe('72px');
  });

  it('is limited by the box height when that is the tighter constraint', () => {
    const el = mount();
    stubLayout(el, { width: 1000, height: 60, wrap: false });
    el.textContent = 'Hello';
    // 1.2 × px ≤ 60.5 → px ≤ 50.4
    expect(fittingTextSize(el)).toBe(50);
  });

  it('returns the largest size when everything fits', () => {
    const el = mount();
    stubLayout(el, { width: 1000, height: 1000, wrap: false });
    el.textContent = 'Hi';
    expect(fittingTextSize(el)).toBe(96);
  });

  it('falls back to the minimum size, and applies it, when nothing fits', () => {
    const el = mount();
    stubLayout(el, { width: 10, height: 10, wrap: false });
    el.textContent = 'Hello';
    expect(fittingTextSize(el)).toBe(8);
    expect(el.style.fontSize).toBe('8px');
  });

  it('honours min, max and step options', () => {
    const el = mount();
    stubLayout(el, { width: 200, height: 1000, wrap: false });
    el.textContent = 'Hello';
    // steps 8, 13, 18 … 68, 73; 73 overflows the 200px width, so 68 wins
    expect(fittingTextSize(el, { step: 5 })).toBe(68);
    // max 60 is appended as the last step, and it fits
    expect(fittingTextSize(el, { min: 8, max: 60, step: 5 })).toBe(60);
  });

  it('resolves sp bounds against the font scale', () => {
    pin({ width: 400, height: 300, fontScale: 1.5 });
    const el = mount();
    stubLayout(el, { width: 1000, height: 1000, wrap: false });
    el.textContent = 'Hi';
    expect(fittingTextSize(el, { max: resizeFixedSp(30) })).toBe(45);
  });

  it('resolves box bounds against the padding-free inner box', () => {
    const el = mount();
    el.style.padding = '10px';
    // clientWidth 220 minus 2 × 10px padding → inner width 200 → 50% = 100
    stubLayout(el, { width: 220, height: 1000, wrap: false });
    el.textContent = 'Hi';
    expect(fittingTextSize(el, { max: resizePercentBox(50, AutoResizePercentBasis.WIDTH) })).toBe(100);
  });

  it('honours maxLines for wrapped text in an auto-height box', () => {
    // Regression: the line count used to subtract a box height measured before the font changed.
    const el = mount();
    stubLayout(el, { width: 100, height: 'auto' });
    el.textContent = 'aaaa aaaa aaaa';
    expect(fittingTextSize(el, { maxLines: 1 })).toBe(12);
    expect(fittingTextSize(el, { maxLines: 2 })).toBe(20);
  });

  it('honours maxLines when the box has a fixed height taller than the text', () => {
    // Regression: scrollHeight is clamped to the taller box, so lines are measured at height:auto.
    const el = mount();
    stubLayout(el, { width: 100, height: 1000 });
    el.textContent = 'aaaa aaaa aaaa';
    expect(fittingTextSize(el, { maxLines: 2 })).toBe(20);
  });
});

describe('autoResizeText', () => {
  let frames: Map<number, FrameRequestCallback>;
  let nextFrameId: number;
  const runFrames = (): void => {
    const pending = [...frames.values()];
    frames.clear();
    for (const cb of pending) cb(0);
  };

  class FakeResizeObserver {
    static instances: FakeResizeObserver[] = [];
    constructor(private readonly callback: ResizeObserverCallback) {
      FakeResizeObserver.instances.push(this);
    }
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
    /** Simulates the browser reporting a size change. */
    trigger(): void {
      this.callback([], this as unknown as ResizeObserver);
    }
  }

  beforeEach(() => {
    frames = new Map();
    nextFrameId = 1;
    FakeResizeObserver.instances = [];
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => {
      const id = nextFrameId++;
      frames.set(id, cb);
      return id;
    });
    vi.stubGlobal('cancelAnimationFrame', (id: number) => {
      frames.delete(id);
    });
  });

  /** A 200px-wide single-line box holding "Hello" (fits 72px), with its layout model. */
  function fittedBox(): { el: HTMLDivElement; model: LayoutModel } {
    const el = mount();
    const model: LayoutModel = { width: 200, height: 100, wrap: false };
    stubLayout(el, model);
    el.textContent = 'Hello';
    return { el, model };
  }

  it('returns a controller with the initially fitted size', () => {
    const { el } = fittedBox();
    const ctl = autoResizeText(el);
    expect(ctl.fontSize).toBe(72);
    expect(el.style.fontSize).toBe('72px');
    ctl.disconnect();
  });

  it('refit() re-measures immediately and returns the new size', () => {
    const { el, model } = fittedBox();
    const ctl = autoResizeText(el);
    model.width = 100; // 5 × px × 0.55 ≤ 100.5 → px ≤ 36.5
    expect(ctl.refit()).toBe(36);
    expect(ctl.fontSize).toBe(36);
    expect(el.style.fontSize).toBe('36px');
    ctl.disconnect();
  });

  it('re-fits on window resize at the next animation frame', () => {
    const { el, model } = fittedBox();
    const ctl = autoResizeText(el);
    model.width = 100;
    window.dispatchEvent(new Event('resize'));
    expect(ctl.fontSize).toBe(72); // not yet: the fit is coalesced to a frame
    runFrames();
    expect(ctl.fontSize).toBe(36);
    expect(el.style.fontSize).toBe('36px');
    ctl.disconnect();
  });

  it('re-fits when a ResizeObserver reports a size change', () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    const { el, model } = fittedBox();
    const ctl = autoResizeText(el);
    model.width = 100;
    FakeResizeObserver.instances[0]!.trigger();
    runFrames();
    expect(ctl.fontSize).toBe(36);
    ctl.disconnect();
  });

  it('ignores ResizeObserver notifications that do not change the box size', () => {
    vi.stubGlobal('ResizeObserver', FakeResizeObserver);
    const { el } = fittedBox();
    const ctl = autoResizeText(el);
    FakeResizeObserver.instances[0]!.trigger();
    runFrames();
    expect(ctl.fontSize).toBe(72);
    ctl.disconnect();
  });

  it('re-fits when the text content changes (MutationObserver)', async () => {
    const { el } = fittedBox();
    const ctl = autoResizeText(el);
    el.textContent = 'Hello Hello Hello'; // 17 glyphs × 0.55 × px ≤ 200.5 → px ≤ 21.4
    await new Promise((resolve) => setTimeout(resolve, 0));
    runFrames();
    expect(ctl.fontSize).toBe(21);
    ctl.disconnect();
  });

  it('disconnect() stops re-fitting on window resize and can be called twice', () => {
    const { el, model } = fittedBox();
    const ctl = autoResizeText(el);
    ctl.disconnect();
    model.width = 100;
    window.dispatchEvent(new Event('resize'));
    runFrames();
    expect(ctl.fontSize).toBe(72);
    expect(() => ctl.disconnect()).not.toThrow();
  });

  it('disconnect() cancels a frame that is already scheduled', () => {
    const { el, model } = fittedBox();
    const ctl = autoResizeText(el);
    model.width = 100;
    window.dispatchEvent(new Event('resize'));
    ctl.disconnect();
    runFrames();
    expect(ctl.fontSize).toBe(72);
  });
});

describe('fittingTextPx regression', () => {
  it('rejects a word wider than maxWidth even without maxLines / maxHeight', () => {
    expect(fittingTextPx({ text: 'Supercalifragilistic', maxWidth: 50 })).toBe(0);
  });
});
