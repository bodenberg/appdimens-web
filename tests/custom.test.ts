import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import postcss, { type AcceptedPlugin } from 'postcss';
import { afterEach, describe, expect, it } from 'vitest';
import { DimenMetrics, dimen, dimenCss, dimensPx, setMetrics, sdp, UiModeType } from '../src/index';
import {
  BuiltInStrategies,
  cdp,
  cdpCss,
  csp,
  customCssDeclarations,
  CustomPresets,
  defineScalingStrategy,
  exportScalingStrategies,
  getDefaultScalingStrategy,
  getScalingStrategy,
  loadScalingStrategies,
  parseStrategiesDocument,
  requireScalingStrategy,
  resetScalingStrategiesForTest,
  ScalingStrategy,
  screenSnapshot,
  setDefaultScalingStrategy,
  setDeviceClassResolver,
  toScreenSnapshot,
  type DeviceClass,
  type ScreenSnapshot,
} from '../src/custom';
import webdimens from '../src/postcss';

const phone = screenSnapshot({ widthDp: 411, heightDp: 891, smallestWidthDp: 411, density: 2.625 });
const tablet = screenSnapshot({ widthDp: 1280, heightDp: 800, smallestWidthDp: 800, density: 2 });
const small = screenSnapshot({ widthDp: 240, heightDp: 320 });

afterEach(() => {
  resetScalingStrategiesForTest();
  setMetrics(null);
});

describe('custom engine', () => {
  it('built-ins match the built-in module formulas', () => {
    for (const s of [phone, tablet, small]) {
      const sw = s.smallestWidthDp;
      expect(BuiltInStrategies.SCALED.resolveScreen(s).factor).toBeCloseTo(sw / 300, 10);
      expect(BuiltInStrategies.POWER.resolveScreen(s).factor).toBeCloseTo(Math.pow(sw / 300, 0.75), 10);
      expect(BuiltInStrategies.LOGARITHMIC.resolveScreen(s).factor).toBeCloseTo(1 + 0.4 * Math.log(sw / 300), 10);
      expect(BuiltInStrategies.INTERPOLATED.resolveScreen(s).factor).toBeCloseTo(1 + (sw / 300 - 1) * 0.5, 10);
      const min = Math.min(s.widthDp, s.heightDp);
      const max = Math.max(s.widthDp, s.heightDp);
      expect(BuiltInStrategies.DIAGONAL.resolveScreen(s).factor).toBeCloseTo(Math.hypot(min, max) / 611.6305, 4);
      expect(BuiltInStrategies.PERIMETER.resolveScreen(s).factor).toBeCloseTo((min + max) / 833, 10);
    }
  });

  it('applies rules in order, later wins, and reports names', () => {
    const s = defineScalingStrategy({
      id: 'rules',
      rules: [
        { name: 'tablet', when: { device: 'tablet' }, set: { curve: { type: 'power', exponent: 0.5 }, multiplier: 0.9 } },
        { name: 'landscape', when: { orientation: 'landscape' }, set: { multiplier: 0.8 } },
      ],
    }, { register: false });
    expect(s.resolveScreen(phone).factor).toBeCloseTo(411 / 300, 10);
    const r = s.resolveScreen(tablet);
    expect(r.factor).toBeCloseTo(Math.pow(800 / 300, 0.5) * 0.8, 10);
    expect(r.appliedRules).toEqual(['tablet', 'landscape']);
  });

  it('clamps factor and value (magnitude, zero stays zero), crossed bounds → max wins', () => {
    const s = defineScalingStrategy({ id: 'c', clamp: { min: 0.9, max: 1.2 }, valueClamp: { min: 4, max: 20 } }, { register: false });
    expect(s.resolveScreen(phone).factor).toBe(1.2);
    expect(s.resolveScreen(small).factor).toBe(0.9);
    expect(s.resolveScreen(phone).scale(100)).toBe(20);
    expect(s.resolveScreen(phone).scale(-100)).toBe(-20);
    expect(s.resolveScreen(phone).scale(1)).toBe(4);
    expect(s.resolveScreen(phone).scale(0)).toBe(0);
    const crossed = defineScalingStrategy({
      id: 'x',
      rules: [{ when: { device: 'tablet' }, set: { clamp: { min: 2 } } }, { when: { orientation: 'landscape' }, set: { clamp: { max: 1.2 } } }],
    }, { register: false });
    expect(crossed.resolveScreen(tablet).factor).toBe(1.2);
  });

  it('font-scale policies', () => {
    const big = { ...phone, fontScale: 2 };
    const f = 411 / 300;
    expect(defineScalingStrategy({ id: 'a' }, { register: false }).resolveScreen(big).scaleSpDp(14)).toBeCloseTo(14 * f * 2, 8);
    expect(defineScalingStrategy({ id: 'b', fontScale: 'ignore' }, { register: false }).resolveScreen(big).scaleSpDp(14)).toBeCloseTo(14 * f, 8);
    expect(defineScalingStrategy({ id: 'c', fontScale: { max: 1.3 } }, { register: false }).resolveScreen(big).scaleSpDp(14)).toBeCloseTo(14 * f * 1.3, 8);
  });

  it('custom curve functions and transforms', () => {
    const s = defineScalingStrategy({
      id: 'fn',
      curve: { type: 'custom', fn: (ratio, screen) => (screen.isLandscape ? 1 : ratio * 2) },
      transform: (_b, scaled) => Math.round(scaled),
    }, { register: false });
    expect(s.resolveScreen(phone).factor).toBeCloseTo((411 / 300) * 2, 10);
    expect(s.resolveScreen(phone).scale(16)).toBe(Math.round(16 * (411 / 300) * 2));
    expect(s.valueDependent).toBe(true);
    expect(() => s.toJSON()).toThrow(/cannot be encoded/);
  });

  it('rejects invalid configs with paths', () => {
    expect(() => defineScalingStrategy({ id: 'x', clamp: { min: 2, max: 1 } })).toThrow(/minFactor/);
    expect(() => defineScalingStrategy({ id: 'x', reference: { width: 0 } })).toThrow(/reference/);
    expect(() => defineScalingStrategy({ id: 'x', curve: { type: 'wave' } as never })).toThrow(/type 'wave'/);
    expect(() => defineScalingStrategy({ id: 'x', rules: [{ when: { device: 'fridge' as DeviceClass }, set: {} }] })).toThrow(/Unknown device/);
  });
});

describe('custom JSON', () => {
  const doc = {
    version: 1,
    default: 'brand',
    strategies: [
      {
        id: 'brand',
        extends: 'power',
        reference: { width: 360, height: 640 },
        curve: { type: 'power', exponent: 0.8 },
        clamp: { min: 0.85, max: 1.6 },
        rules: [{ name: 'tablet', when: { device: ['tablet', 'desktop'] }, set: { curve: { type: 'logarithmic', k: 0.4 } } }],
      },
      { id: 'brandText', extends: 'brand', valueClamp: { min: 10, max: 32 } },
    ],
  } as const;

  it('loads, registers, sets default and round-trips', () => {
    const loaded = loadScalingStrategies(JSON.stringify(doc));
    expect([...loaded.keys()]).toEqual(['brand', 'brandText']);
    expect(getDefaultScalingStrategy().id).toBe('brand');
    expect(getScalingStrategy('brandText')!.config.rules).toHaveLength(1);
    const again = parseStrategiesDocument(exportScalingStrategies(), () => undefined).configs;
    expect(again.get('brand')!.curve).toEqual(loaded.get('brand')!.config.curve);
    for (const p of [...Object.values(CustomPresets), ...Object.values(BuiltInStrategies)]) {
      const back = parseStrategiesDocument(p.toJSON(), () => undefined).configs.get(p.id)!;
      expect(back.rules.length, p.id).toBe(p.config.rules.length);
      expect(new ScalingStrategy(p.id, back).resolveScreen(tablet).factor, p.id).toBe(p.resolveScreen(tablet).factor);
    }
  });

  it('errors are descriptive', () => {
    const none = (): undefined => undefined;
    expect(() => parseStrategiesDocument([{ id: 'a', extends: 'b' }, { id: 'b', extends: 'a' }], none)).toThrow(/Cyclic/);
    expect(() => parseStrategiesDocument({ id: 'a', extends: 'nope' }, none)).toThrow(/unknown strategy 'nope'/);
    expect(() => parseStrategiesDocument([{ id: 'a' }, { id: 'a' }], none)).toThrow(/Duplicate/);
    expect(() => parseStrategiesDocument('{"id":"a",}', none)).toThrow(/Invalid JSON/);
    expect(() => parseStrategiesDocument({ version: 2, strategies: [] }, none)).toThrow(/version/);
    expect(() => requireScalingStrategy('missing')).toThrow(/No scaling strategy/);
  });

  it('rejects a range condition that is not an object', () => {
    const none = (): undefined => undefined;
    const json = '{"strategies":[{"id":"x","rules":[{"when":{"width":600},"set":{"multiplier":2}}]}]}';
    expect(() => parseStrategiesDocument(json, none)).toThrow(/rules\[0\]\.when\.width must be an object with min\/max/);
  });

  it('ignoreMultiWindow skips the formula in multi-window', () => {
    const s = defineScalingStrategy({ id: 'mw', ignoreMultiWindow: true, formula: 'base * 3' });
    const mw = screenSnapshot({ widthDp: 411, heightDp: 891, isMultiWindow: true });
    expect(s.resolveScreen(mw).scale(16)).toBe(16);
    expect(s.resolveScreen(phone).scale(16)).toBe(48);
  });
});

describe('cross-platform fixture', () => {
  const fixture = JSON.parse(readFileSync(resolve(process.cwd(), 'tests/fixtures/custom-strategy-fixture.json'), 'utf8')) as {
    tolerance: number;
    document: unknown;
    screens: Record<string, { width: number; height: number; smallestWidth: number; density: number; fontScale: number; landscape: boolean; multiWindow: boolean; device: DeviceClass }>;
    cases: Array<{ strategy: string; screen: string; base: number; factor: number; dp: number; spDp: number; rules: string[] }>;
  };

  it('reproduces the Kotlin reference engine', () => {
    const configs = parseStrategiesDocument(fixture.document as never, (id) => getScalingStrategy(id)?.config).configs;
    const screens = new Map<string, ScreenSnapshot>(
      Object.entries(fixture.screens).map(([k, s]) => [k, screenSnapshot({
        widthDp: s.width, heightDp: s.height, smallestWidthDp: s.smallestWidth, density: s.density,
        fontScale: s.fontScale, isLandscape: s.landscape, isMultiWindow: s.multiWindow, device: s.device,
      })]),
    );
    expect(fixture.cases.length).toBeGreaterThan(100);
    const close = (label: string, expected: number, actual: number): void => {
      expect(Math.abs(expected - actual), `${label}: expected ${expected} got ${actual}`).toBeLessThanOrEqual(fixture.tolerance * Math.max(1, Math.abs(expected)));
    };
    for (const c of fixture.cases) {
      const r = new ScalingStrategy(c.strategy, configs.get(c.strategy)!).resolveScreen(screens.get(c.screen)!);
      const label = `${c.strategy}@${c.screen}×${c.base}`;
      close(label, c.factor, r.factor);
      close(label, c.dp, r.scale(c.base));
      close(label, c.spDp, r.scaleSpDp(c.base));
      expect(r.appliedRules, label).toEqual(c.rules);
    }
  });
});

describe('web runtime binding', () => {
  it('cdp / csp follow the viewport and the default strategy', () => {
    setMetrics({ screenWidthDp: 411, screenHeightDp: 891, fontScale: 1.5 });
    expect(cdp(16)).toBeCloseTo(sdp(16), 10); // default = scaled
    const brand = defineScalingStrategy({ id: 'brand', curve: { type: 'power', exponent: 0.8 }, fontScale: { max: 1.2 } });
    expect(cdp(16, brand)).toBeCloseTo(16 * Math.pow(411 / 300, 0.8), 10);
    expect(cdp(16, 'brand')).toBe(cdp(16, brand));
    expect(csp(14, brand)).toBeCloseTo(14 * Math.pow(411 / 300, 0.8) * 1.2, 10);
    setDefaultScalingStrategy('brand');
    expect(cdp(16)).toBe(cdp(16, brand));
    setMetrics({ screenWidthDp: 800, screenHeightDp: 1280 });
    expect(cdp(16)).toBeCloseTo(16 * Math.pow(800 / 300, 0.8), 10);
  });

  it('maps UI mode to device class and honours a custom resolver', () => {
    const tv = new DimenMetrics({ screenWidthDp: 960, screenHeightDp: 540, uiModeType: UiModeType.TELEVISION });
    expect(toScreenSnapshot(tv).device).toBe('tv');
    expect(toScreenSnapshot(new DimenMetrics({ screenWidthDp: 800, screenHeightDp: 1280 })).device).toBe('tablet');
    setDeviceClassResolver(() => 'car');
    expect(toScreenSnapshot(tv).device).toBe('car');
    const s = CustomPresets.TV_SAFE;
    setDeviceClassResolver(null);
    expect(s.factor(tv)).toBeCloseTo(540 / 540, 10);
  });

  it('publishes CSS custom properties and compiles cdp literals', () => {
    setMetrics({ screenWidthDp: 411, screenHeightDp: 891 });
    const brand = defineScalingStrategy({ id: 'brand', curve: { type: 'power', exponent: 0.8 } });
    expect(brand.css(16)).toBe('calc(16 * var(--cdp-brand))');
    expect(cdpCss(16)).toBe('calc(16 * var(--cdp))');
    const decl = customCssDeclarations();
    expect(decl).toContain('--cdp-brand:');
    expect(decl).toContain('--csp-brand:');
    expect(document.getElementById('webdimens-custom-vars')?.textContent).toContain('--cdp-brand:');
    expect(dimenCss('8cdp-brand 16sdp')).toBe('calc(8 * var(--cdp-brand)) calc(16 * var(--sdp))');
    expect(dimen('16cdp-brand')).toBeCloseTo(brand.dp(16), 10);
    expect(dimensPx({ padding: '16cdp-brand' }).padding).toBeCloseTo(brand.dp(16), 10);
    expect(dimenCss('calc(8sdp-2px)')).toBe('calc(8sdp-2px)'); // unchanged, not a literal boundary
  });

  it('value-dependent strategies emit px literals instead of a var()', () => {
    setMetrics({ screenWidthDp: 411, screenHeightDp: 891 });
    const s = defineScalingStrategy({ id: 'bounded', valueClamp: { max: 10 } });
    expect(s.css(100)).toBe('10px');
  });

  it('PostCSS compiles cdp / csp literals', () => {
    const out = postcss([webdimens() as unknown as AcceptedPlugin]).process('.a{padding:8cdp-brand 16cdp;font-size:14csp-brand}', { from: undefined }).css;
    expect(out).toBe('.a{padding:calc(8 * var(--cdp-brand)) calc(16 * var(--cdp));font-size:calc(14 * var(--csp-brand))}');
  });

  it('extend / withAxis', () => {
    const soft = BuiltInStrategies.POWER.extend('soft', { curve: { type: 'power', exponent: 0.6 } });
    expect(getScalingStrategy('soft')).toBe(soft);
    expect(soft.withAxis('height')).toBe(soft.withAxis('height'));
    expect(soft.withAxis('height').id).toBe('soft@height');
  });
});
