import { afterEach, describe, expect, it } from 'vitest';
import { setMetrics } from '../src/index';
import {
  cdp,
  cdpCss,
  csp,
  customScaleStrategy,
  formulaScope,
  customCssDeclarations,
  defineScalingStrategy,
  getFormulaScalingStrategy,
  getScalingStrategy,
  loadScalingStrategies,
  pickScalingStrategy,
  resetScalingStrategiesForTest,
  ScalingExpression,
  scalingFormula,
  screenScope,
  screenSnapshot,
  setDefaultScalingStrategy,
} from '../src/custom';

const phone = screenSnapshot({ widthDp: 411, heightDp: 891, smallestWidthDp: 411, density: 2.625 });
const tablet = screenSnapshot({ widthDp: 1280, heightDp: 800, smallestWidthDp: 800, density: 2, device: 'tablet' });

afterEach(() => {
  resetScalingStrategiesForTest();
  setMetrics(null);
});

describe('scalingFormula — the formula is the value', () => {
  it('text formula is the final value', () => {
    expect(scalingFormula('base * pow(sw / 360, 0.8)').resolveScreen(phone).scale(16)).toBe(16 * Math.pow(411 / 360, 0.8));
    expect(scalingFormula('base + 2').resolveScreen(phone).scale(16)).toBe(18);
    expect(scalingFormula('base * ratio').resolveScreen(phone).scale(16)).toBeCloseTo((16 * 411) / 300, 10); // ratio = sw / 300, like sdp
    expect(scalingFormula('base * (tablet ? 0.9 : 1)').resolveScreen(tablet).scale(16)).toBeCloseTo(16 * 0.9, 12);
  });

  it('proportional formulas take the fast path and match the slow path bit for bit', () => {
    for (const src of ['base', 'base * pow(sw / 360, 0.8)', '(sw / 360) * base', 'base * (tablet ? 0.9 : 1.1)', 'base * sqrt(diagonal / 734.4)']) {
      const fast = scalingFormula(src);
      expect(fast.valueDependent, src).toBe(false);
      expect(ScalingExpression.parse(src).baseCoefficient, src).not.toBeNull();
      // Same text, but `+ 0` forces the per-value path: identical numbers.
      const slow = scalingFormula(`${src} + 0`);
      expect(slow.valueDependent).toBe(true);
      for (const screen of [phone, tablet]) {
        for (const base of [1, 16, 48, -8, 0.5, 13.37, 1e-7]) {
          expect(Object.is(fast.resolveScreen(screen).scale(base), slow.resolveScreen(screen).scale(base)), `${src} @ ${base}`).toBe(true);
        }
      }
    }
    // Reads the value inside E → not proportional.
    expect(scalingFormula('base * min(base, 20)').valueDependent).toBe(true);
    expect(scalingFormula('max(base * sw / 360, base)').valueDependent).toBe(true);
    expect(scalingFormula('base * scaled').valueDependent).toBe(true);
    // `(base * sw) / 360` is evaluated as written (per value), so it is not on the fast path.
    expect(scalingFormula('base * sw / 360').valueDependent).toBe(true);
    expect(ScalingExpression.parse('base * sw / 360').baseCoefficient).toBeNull();
  });

  it('a proportional formula inside a spec or JSON is screen-only too', () => {
    expect(defineScalingStrategy({ id: 'p', formula: 'base * (sw / 360)' }, { register: false }).valueDependent).toBe(false);
    const json = loadScalingStrategies('{"strategies":[{"id":"j","formula":"base * 1.1"}]}').get('j')!;
    expect(json.valueDependent).toBe(false);
    expect(json.resolveScreen(phone).scale(16)).toBeCloseTo(16 * 1.1, 12);
    expect(defineScalingStrategy({ id: 'v', formula: 'round(scaled)' }, { register: false }).valueDependent).toBe(true);
    // Value bounds still make it value-dependent.
    expect(defineScalingStrategy({ id: 'c', formula: 'base * 2', valueClamp: { max: 10 } }, { register: false }).valueDependent).toBe(true);
  });

  it('text formulas are shared per text unless an id is given', () => {
    expect(scalingFormula('base * 2')).toBe(scalingFormula('base * 2'));
    expect(getFormulaScalingStrategy('base * 2')).toBe(scalingFormula('base * 2'));
    expect(scalingFormula('base * 2').id).toBe('formula:base * 2');
    expect(getScalingStrategy('formula:base * 2')).toBeUndefined(); // not registered
    const named = scalingFormula('base * 2', { id: 'double' });
    expect(named).not.toBe(scalingFormula('base * 2'));
    expect(getScalingStrategy('double')).toBe(named); // an id registers by default
    expect(scalingFormula('base * 3', { id: 'triple', register: false })).not.toBe(getScalingStrategy('triple'));
  });

  it('code formulas have no limits', () => {
    const s = scalingFormula(({ base, sw, pow, landscape }) => base * pow(sw / 360, 0.8) + (landscape ? 2 : 0));
    expect(s.resolveScreen(phone).scale(16)).toBeCloseTo(16 * Math.pow(411 / 360, 0.8), 12);
    expect(s.resolveScreen(tablet).scale(16)).toBeCloseTo(16 * Math.pow(800 / 360, 0.8) + 2, 12);
    expect(s.valueDependent).toBe(true);
    expect(s.id.startsWith('formula#')).toBe(true);
    expect(scalingFormula(({ base }) => base).id).not.toBe(s.id);
    expect(() => s.toJSON()).toThrow('cannot be encoded');
    const named = scalingFormula(({ base }) => base * 3, { id: 'hud' });
    expect(getScalingStrategy('hud')).toBe(named);
    expect(s.resolveScreen(phone).explain(s.id)).toContain(' then transform');
  });

  it('reports formula errors right away', () => {
    expect(() => scalingFormula('base * sww')).toThrow("unknown variable 'sww'");
    expect(() => cdp(16, 'base * sww')).toThrow("unknown variable 'sww'");
    // A bare unknown name still reads as a missing strategy id.
    expect(() => cdp(16, 'brnad')).toThrow("No scaling strategy 'brnad'");
  });

  it('follows the font scale for text', () => {
    const big = screenSnapshot({ widthDp: 411, heightDp: 891, fontScale: 1.5 });
    expect(scalingFormula('base * 2').resolveScreen(big).scaleSpDp(16)).toBe(16 * 2 * 1.5);
  });

  it('explain shows the formula', () => {
    expect(scalingFormula('base * pow(sw / 360, 0.8)').resolveScreen(phone).explain('x')).toContain(' then Formula(base * pow(sw / 360, 0.8))');
  });
});

describe('inline formulas on the web runtime', () => {
  it('cdp / csp / pickScalingStrategy accept a formula; ids win', () => {
    setMetrics({ screenWidthDp: 411, screenHeightDp: 891, fontScale: 1.25 });
    expect(cdp(16, 'base * pow(sw / 360, 0.8)')).toBe(16 * Math.pow(411 / 360, 0.8));
    expect(csp(14, 'base * min(sw / 360, 1.3)')).toBeCloseTo(14 * (411 / 360) * 1.25, 10);
    expect(pickScalingStrategy('base * 2')).toBe(getFormulaScalingStrategy('base * 2'));
    defineScalingStrategy({ id: 'base' }); // an id named like a variable takes precedence
    expect(pickScalingStrategy('base').id).toBe('base');
    setDefaultScalingStrategy('base * 3');
    expect(cdp(10)).toBe(30);
  });

  it('a proportional formula publishes its coefficient as a CSS variable', () => {
    setMetrics({ screenWidthDp: 411, screenHeightDp: 891 });
    const css = cdpCss(16, 'base * (sw / 360)');
    expect(css).toMatch(/^calc\(16 \* var\(--cdp-formula-[0-9a-f]{8}\)\)$/);
    const name = /var\((--cdp-formula-[0-9a-f]{8})\)/.exec(css)![1]!;
    expect(document.getElementById('webdimens-custom-vars')?.textContent).toContain(`${name}:${Math.round((411 / 360) * 1e4) / 1e4}px`);
    expect(cdpCss(16, 'base * (sw / 300)')).not.toBe(css); // distinct texts → distinct variables
    // Registered under an id: --cdp-<id> is E, not the curve factor.
    scalingFormula('base * 2', { id: 'twice' });
    expect(customCssDeclarations()).toContain('--cdp-twice:2px;');
    // Not proportional → px literal.
    expect(cdpCss(16, 'base + 2')).toBe('18px');
  });
});

describe('customScaleStrategy — programmable factor', () => {
  it('is screen-only and multiplies every value', () => {
    const product = customScaleStrategy(({ width, clamp }) => clamp(width / 360, 0.85, 1.8));
    expect(product.valueDependent).toBe(false);
    expect(product.resolveScreen(phone).factor).toBe(411 / 360);
    expect(product.resolveScreen(tablet).factor).toBe(1.8); // 1280 / 360 clamped
    expect(product.resolveScreen(phone).scale(16)).toBe(16 * (411 / 360));
    expect(product.id.startsWith('scale#')).toBe(true);
    expect(customScaleStrategy(() => 1).id).not.toBe(product.id);
    expect(getScalingStrategy(product.id)).toBeUndefined();
    const named = customScaleStrategy(() => 1.25, { id: 'product' });
    expect(getScalingStrategy('product')).toBe(named);
    expect(named.resolveScreen(phone).scale(16)).toBe(20);
    expect(named.css(16)).toBe('calc(16 * var(--cdp-product))');
    expect(() => customScaleStrategy(() => NaN).resolveScreen(phone)).toThrow('non-finite');
  });
});

describe('code scope matches the text language', () => {
  it('same names, same numbers', () => {
    const pairs: [Parameters<typeof scalingFormula>[0], string][] = [
      [({ base, sw, pow }) => base * pow(sw / 360, 0.8), 'base * pow(sw / 360, 0.8)'],
      [({ base, ratio }) => base * ratio, 'base * ratio'],
      [({ base, tablet, clamp, width }) => base * (tablet ? 0.9 : 1) * clamp(width / 360, 0.85, 1.6), 'base * (tablet ? 0.9 : 1) * clamp(width / 360, 0.85, 1.6)'],
      [({ base, round, lerp, aspectRatio }) => round(base * lerp(1, aspectRatio, 0.1)), 'round(base * lerp(1, aspectRatio, 0.1))'],
      [(s) => s.base * s.smoothstep(300, 900, s.diagonal) + s.ln(s.perimeter) - s.sqrt(s.shortSide) + s.max(s.longSide, s.height) * s.min(1, s.fontScale, s.density),
        'base * smoothstep(300, 900, diagonal) + ln(perimeter) - sqrt(shortSide) + max(longSide, height) * min(1, fontScale, density)'],
      [({ base, landscape, portrait, phone, exp, abs, log10 }) => base * (landscape ? 2 : 1) + (portrait && phone ? exp(1) : abs(-3)) + log10(base), 'base * (landscape ? 2 : 1) + (portrait && phone ? exp(1) : abs(-3)) + log10(base)'],
    ];
    for (const [code, text] of pairs) {
      for (const screen of [phone, tablet]) {
        for (const base of [1, 16, 48]) {
          expect(scalingFormula(code).resolveScreen(screen).scale(base), text).toBeCloseTo(scalingFormula(text).resolveScreen(screen).scale(base), 4);
        }
      }
    }
    const tv = screenSnapshot({ widthDp: 960, heightDp: 540, device: 'tv' });
    const factor = customScaleStrategy(({ tv, height, ratio }) => (tv ? height / 540 : ratio));
    expect(factor.resolveScreen(tv).factor).toBe(1);
    expect(factor.resolveScreen(phone).factor).toBeCloseTo(411 / 300, 12);
    // Every scope member is a plain property, so a whole destructuring works.
    expect(Object.keys(screenScope(phone))).toContain('smoothstep');
    expect(formulaScope(phone, 16).base).toBe(16);
  });
});

describe('factor strategies in CSS', () => {
  it('an unregistered factor strategy publishes its variable on first css()', () => {
    setMetrics({ screenWidthDp: 411, screenHeightDp: 891 });
    const p = customScaleStrategy(({ width }) => width / 360);
    expect(p.css(16)).toBe(`calc(16 * var(${p.cssVar}))`);
    expect(document.getElementById('webdimens-custom-vars')?.textContent).toContain(`${p.cssVar}:${Math.round((411 / 360) * 1e4) / 1e4}px`);
  });
});
