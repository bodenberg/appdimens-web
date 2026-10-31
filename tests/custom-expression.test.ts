import { afterEach, describe, expect, it } from 'vitest';
import {
  BuiltInStrategies,
  defineScalingStrategy,
  expressionVariables,
  loadScalingStrategies,
  parseStrategiesDocument,
  resetScalingStrategiesForTest,
  CURVE_VARIABLES,
  ScalingExpression,
  ScalingStrategy,
  screenSnapshot,
} from '../src/custom';

const phone = screenSnapshot({ widthDp: 411, heightDp: 891, smallestWidthDp: 411, density: 2.625 });
const tablet = screenSnapshot({ widthDp: 1280, heightDp: 800, smallestWidthDp: 800, density: 2 });

afterEach(() => resetScalingStrategiesForTest());

const ev = (src: string, screen = phone): number =>
  ScalingExpression.parse(src).evaluate(expressionVariables(screen, 1.5, 411, 300, { width: 300, height: 533 }, 16, 20, 1.25));

describe('free-form expressions', () => {
  it.each([
    ['1 + 2 * 3', 7], ['(1 + 2) * 3', 9], ['2 ^ 3 ^ 2', 512], ['-2 ^ 2', -4], ['-7 % 3', -1],
    ['1 < 2 && 2 <= 2 && !(3 == 4) && 3 != 4', 1], ['0 || 5', 1], ['0 ? 2 : 1 ? 3 : 4', 3],
    ['true && !false', 1], ['1.5e3', 1500], ['min(3, 1, 2) + max(3, 1, 2)', 4], ['clamp(5, 0, 2)', 2],
    ['round(2.5) + round(-2.5)', 1], ['smoothstep(0, 10, 5)', 0.5], ['step(1, 1) + lerp(10, 20, 0.5)', 16],
    ['sw', 411], ['phone && portrait && !landscape && !tablet', 1], ['base + scaled + ratio', 37.5],
  ])('%s = %d', (src, expected) => {
    expect(ev(src)).toBeCloseTo(expected, 9);
  });

  it.each([
    ['sw +', 'unexpected end'], ['foo * 2', "unknown variable 'foo'"], ['wave(1)', "unknown function 'wave'"],
    ['clamp(1, 2)', "'clamp' takes 3"], ['(1 + 2', "expected ')'"], ['1 ? 2', "expected ':'"], ['', 'empty'],
  ])('rejects %j', (src, message) => {
    expect(() => ScalingExpression.parse(src)).toThrow(message);
  });

  it('curve expressions are factor-only; formulas are value-dependent', () => {
    const curve = defineScalingStrategy({ id: 'e', curve: { type: 'expression', expression: 'pow(ratio, 0.75)' } }, { register: false });
    expect(curve.valueDependent).toBe(false);
    expect(curve.resolveScreen(tablet).factor).toBeCloseTo(BuiltInStrategies.POWER.resolveScreen(tablet).factor, 9);
    expect(() => ScalingExpression.parse('base', CURVE_VARIABLES)).toThrow("unknown variable 'base'");
    const free = defineScalingStrategy({ id: 'f', formula: 'base * pow(sw / 360, 0.7) + 2' }, { register: false });
    expect(free.valueDependent).toBe(true);
    expect(free.resolveScreen(tablet).scale(16)).toBeCloseTo(16 * Math.pow(800 / 360, 0.7) + 2, 9);
    const bad = defineScalingStrategy({ id: 'b', curve: { type: 'expression', expression: '1 / (sw - sw)' } }, { register: false });
    expect(() => bad.resolveScreen(phone)).toThrow('non-finite');
  });

  it('JSON round trip, null clears, errors carry the path', () => {
    const loaded = loadScalingStrategies(JSON.stringify([
      { id: 'a', curve: { type: 'expression', expression: 'ratio * (tablet ? 0.9 : 1)' }, formula: 'max(scaled, 12)' },
      { id: 'b', extends: 'a', formula: null },
    ]));
    const a = loaded.get('a')!;
    const back = new ScalingStrategy('a', parseStrategiesDocument(JSON.stringify(a.toJSON()), () => undefined).configs.get('a')!);
    expect(back.resolveScreen(tablet).scale(4)).toBeCloseTo(a.resolveScreen(tablet).scale(4), 9);
    expect(a.resolveScreen(phone).scale(1)).toBe(12);
    expect(loaded.get('b')!.valueDependent).toBe(false);
    expect(() => parseStrategiesDocument('{"id":"x","curve":{"type":"expression","expression":"base"}}', () => undefined)).toThrow(/x\.curve\.expression: .*unknown variable 'base'/);
  });
});
