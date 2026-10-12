/**
 * Parity with AppDimens Dynamic 3.2.0 (Android).
 *
 * The oracle below is an independent transcription of the Kotlin `calculate*Dp` kernels
 * (DimenSdpExtensions / Dimen<Strategy>DpExtensions + DimenCalculationPlumbing).
 * Every strategy × axis variant × flag is compared on a grid of window sizes.
 */
import { afterEach, describe, expect, it } from 'vitest';
import * as scaled from '../src/index';
import { DpQualifier, Inverter, setMetrics, toDynamicScaledDp } from '../src/index';
import * as percent from '../src/percent';
import * as power from '../src/power';
import * as fluid from '../src/fluid';
import * as auto from '../src/auto';
import * as diagonal from '../src/diagonal';
import * as fill from '../src/fill';
import * as fit from '../src/fit';
import * as interpolated from '../src/interpolated';
import * as logarithmic from '../src/logarithmic';
import * as perimeter from '../src/perimeter';
import * as density from '../src/density';

type Q = 'SMALL_WIDTH' | 'HEIGHT' | 'WIDTH';
interface Cfg {
  w: number;
  h: number;
  dpr: number;
  landscape: boolean;
  portrait: boolean;
  multi: boolean;
}

// ── Oracle (Kotlin transcription) ────────────────────────────────────────────
const INV = 0.0033333334;
const ADJ = 0.1 / 30;
const SENS = 0.08 / 30;

function effective(q: Q, inv: string, c: Cfg): Q {
  const L = c.landscape;
  const P = c.portrait;
  switch (inv) {
    case 'PH_TO_LW': return L && q === 'HEIGHT' ? 'WIDTH' : q;
    case 'PW_TO_LH': return L && q === 'WIDTH' ? 'HEIGHT' : q;
    case 'LH_TO_PW': return P && q === 'HEIGHT' ? 'WIDTH' : q;
    case 'LW_TO_PH': return P && q === 'WIDTH' ? 'HEIGHT' : q;
    case 'SW_TO_LH': return L && q === 'SMALL_WIDTH' ? 'HEIGHT' : q;
    case 'SW_TO_LW': return L && q === 'SMALL_WIDTH' ? 'WIDTH' : q;
    case 'SW_TO_PH': return P && q === 'SMALL_WIDTH' ? 'HEIGHT' : q;
    case 'SW_TO_PW': return P && q === 'SMALL_WIDTH' ? 'WIDTH' : q;
    default: return q;
  }
}
const sw = (c: Cfg): number => Math.min(c.w, c.h);
const readDp = (c: Cfg, q: Q): number => (q === 'HEIGHT' ? c.h : q === 'WIDTH' ? c.w : sw(c));
const logAr = (c: Cfg): number => Math.log(Math.max(c.w, c.h) / Math.min(c.w, c.h) / 1.78);
const arMul = (c: Cfg): number => 1 + SENS * logAr(c);
const linearAr = (b: number, d: number, c: Cfg): number => b * (1 + (d - 300) * (ADJ + SENS * logAr(c)));

const ORACLE: Record<string, (b: number, c: Cfg, q: Q, inv: string, ar: boolean) => number> = {
  scaled: (b, c, q, inv, ar) => {
    const d = readDp(c, effective(q, inv, c));
    return ar ? linearAr(b, d, c) : b * d * INV;
  },
  percent: (b, c, q, inv, ar) => {
    const d = readDp(c, effective(q, inv, c));
    return ar ? linearAr(b, d, c) : b * d * INV;
  },
  power: (b, c, q, inv, ar) => {
    const d = readDp(c, effective(q, inv, c));
    const out = b * Math.pow(d / 300, 0.75);
    return ar ? out * arMul(c) : out;
  },
  fluid: (b, c, q, inv, ar) => {
    const d = readDp(c, effective(q, inv, c));
    const minV = b * 0.8;
    const maxV = b * 1.2;
    const out = d <= 320 ? minV : d >= 768 ? maxV : minV + ((maxV - minV) * (d - 320)) / (768 - 320);
    return ar ? out * arMul(c) : out;
  },
  auto: (b, c, q, inv, ar) => {
    const d = readDp(c, effective(q, inv, c));
    const scale = d <= 480 ? d * INV : 480 * INV + 0.4 * Math.log(1 + (d - 480) * INV);
    return ar ? b * scale * arMul(c) : b * scale;
  },
  diagonal: (b, c, _q, _i, ar) => {
    const out = (b * Math.sqrt(c.w * c.w + c.h * c.h)) / 611.6305;
    return ar ? out * arMul(c) : out;
  },
  fill: (b, c, _q, _i, ar) => {
    const out = b * Math.max(sw(c) / 300, Math.max(c.w, c.h) / 533);
    return ar ? out * arMul(c) : out;
  },
  fit: (b, c, _q, _i, ar) => {
    const out = b * Math.min(sw(c) / 300, Math.max(c.w, c.h) / 533);
    return ar ? out * arMul(c) : out;
  },
  interpolated: (b, c, q, inv, ar) => {
    const d = readDp(c, effective(q, inv, c));
    const linear = b * d * INV;
    const out = b + (linear - b) * 0.5;
    return ar ? out * arMul(c) : out;
  },
  logarithmic: (b, c, q, inv, ar) => {
    const d = readDp(c, effective(q, inv, c));
    const scale = d > 300 ? 1 + 0.4 * Math.log(d * INV) : d > 0 ? 1 - 0.4 * Math.log(300 / d) : 1;
    return ar ? b * scale * arMul(c) : b * scale;
  },
  perimeter: (b, c, _q, _i, ar) => {
    const out = (b * (c.w + c.h)) / 833;
    return ar ? out * arMul(c) : out;
  },
  density: (b, c, _q, _i, ar) => {
    const out = b * c.dpr;
    return ar ? out * arMul(c) : out;
  },
};

const MODULES: [string, string, Record<string, unknown>][] = [
  ['scaled', '', scaled],
  ['percent', 'p', percent],
  ['power', 'pw', power],
  ['fluid', 'f', fluid],
  ['auto', 'a', auto],
  ['diagonal', 'dg', diagonal],
  ['fill', 'fl', fill],
  ['fit', 'ft', fit],
  ['interpolated', 'i', interpolated],
  ['logarithmic', 'log', logarithmic],
  ['perimeter', 'pr', perimeter],
  ['density', 'd', density],
];

const VARIANTS: [string, Q, string, string][] = [
  ['s', 'SMALL_WIDTH', 'DEFAULT', ''],
  ['h', 'HEIGHT', 'DEFAULT', ''],
  ['w', 'WIDTH', 'DEFAULT', ''],
  ['s', 'SMALL_WIDTH', 'SW_TO_PH', 'Ph'],
  ['s', 'SMALL_WIDTH', 'SW_TO_LH', 'Lh'],
  ['s', 'SMALL_WIDTH', 'SW_TO_PW', 'Pw'],
  ['s', 'SMALL_WIDTH', 'SW_TO_LW', 'Lw'],
  ['h', 'HEIGHT', 'PH_TO_LW', 'Lw'],
  ['h', 'HEIGHT', 'LH_TO_PW', 'Pw'],
  ['w', 'WIDTH', 'PW_TO_LH', 'Lh'],
  ['w', 'WIDTH', 'LW_TO_PH', 'Ph'],
];

const SIZES: [number, number][] = [
  [360, 640], [640, 360], [300, 533], [411, 914], [768, 1024], [1024, 768], [1280, 800],
  [1920, 1080], [280, 280], [600, 960], [250, 400], [2560, 1440],
];

const cfgOf = (w: number, h: number, dpr = 2, multi = false): Cfg => ({
  w, h, dpr, multi, landscape: w > h, portrait: !(w > h),
});

const close = (actual: number, expected: number): void => {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(Math.max(1e-6, Math.abs(expected) * 1e-6));
};

afterEach(() => setMetrics(null));

describe('strategy parity with AppDimens Dynamic (Android)', () => {
  for (const [id, prefix, mod] of MODULES) {
    it(`${id}: every axis variant × flag matches the Kotlin kernels`, () => {
      for (const [w, h] of SIZES) {
        for (const multi of [false, true]) {
          const c = cfgOf(w, h, 2, multi);
          setMetrics({ screenWidthDp: w, screenHeightDp: h, density: 2, fontScale: 1.3, isInMultiWindowMode: multi });
          for (const [axis, q, inv, token] of VARIANTS) {
            for (const [flag, ar, ignore] of [['', false, false], ['a', true, false], ['i', false, true], ['ia', true, true]] as const) {
              const base = 16;
              const expected = ignore && multi ? base : ORACLE[id]!(base, c, q, inv, ar);
              const name = `${prefix}${axis}dp${token}${flag}`;
              const fn = mod[name] as (v: number) => number;
              expect(typeof fn, name).toBe('function');
              close(fn(base), expected);
              close((mod[`${name}Px`] as (v: number) => number)(base), expected * 2);
              close((mod[`${prefix}${axis}sp${token}${flag}`] as (v: number) => number)(base), expected * 1.3);
              close((mod[`${prefix}${axis}sp${token}${flag}Px`] as (v: number) => number)(base), expected * 1.3 * 2);
              close((mod[`${prefix}${axis}em${token}${flag}`] as (v: number) => number)(base), expected);
            }
          }
        }
      }
    });
  }
});

describe('Android unit-test vectors', () => {
  it('PowerFormulasTest: 50 · (360/300)^0.75 on sw=360 (800×1200 window → sw 800 on the web)', () => {
    // Android passes smallestScreenWidthDp = 360 explicitly; the web derives sw from the window,
    // so pin it the same way through DimenMetricsInit.
    setMetrics({ screenWidthDp: 800, screenHeightDp: 1200, smallestScreenWidthDp: 360 });
    close(power.pwsdp(50), 50 * Math.pow(360 / 300, 0.75));
    const ar = 1 + SENS * Math.log(1200 / 800 / 1.78);
    close(power.pwsdpa(50), 50 * Math.pow(360 / 300, 0.75) * ar);
  });

  it('scaled sdp at the reference window is identity', () => {
    setMetrics({ screenWidthDp: 300, screenHeightDp: 533 });
    close(scaled.sdp(16), 16);
    close(scaled.sdpa(16), 16);
  });

  it('custom sensitivity k (toDynamicScaledDp)', () => {
    setMetrics({ screenWidthDp: 1024, screenHeightDp: 768 });
    const c = cfgOf(1024, 768);
    const k = 0.01;
    const expected = 10 * (1 + (sw(c) - 300) * (ADJ + k * logAr(c)));
    close(toDynamicScaledDp(10, DpQualifier.SMALL_WIDTH, { applyAspectRatio: true, customSensitivityK: k }), expected);
    const h = 10 * (1 + (768 - 300) * (ADJ + k * logAr(c)));
    close(toDynamicScaledDp(10, DpQualifier.HEIGHT, { applyAspectRatio: true, customSensitivityK: k }), h);
    expect(() => toDynamicScaledDp(10, DpQualifier.SMALL_WIDTH, { applyAspectRatio: true, customSensitivityK: NaN })).toThrow(RangeError);
  });

  it('inverters through the generic resolver match the generated shortcuts', () => {
    setMetrics({ screenWidthDp: 900, screenHeightDp: 400 });
    close(toDynamicScaledDp(20, DpQualifier.HEIGHT, { inverter: Inverter.PH_TO_LW }), scaled.hdpLw(20));
    close(toDynamicScaledDp(20, DpQualifier.SMALL_WIDTH, { inverter: Inverter.SW_TO_LW }), scaled.sdpLw(20));
    close(scaled.sdpLw(20), (20 * 900) / 300);
    close(scaled.sdpPh(20), (20 * 400) / 300); // portrait-only rule: inactive in landscape → sw
  });
});
