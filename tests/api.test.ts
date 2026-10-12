import { afterEach, describe, expect, it } from 'vitest';
import {
  cssDimen,
  DimenBuilder,
  DpQualifier,
  hdp,
  hdpQualifier,
  Inverter,
  Orientation,
  plainMode,
  plainQualifier,
  plainRotate,
  plainScreen,
  scaledDp,
  scaledSp,
  sdp,
  sdpa,
  sdpMode,
  sdpModePx,
  sdpQualifier,
  sdpRotate,
  sdpRotatePx,
  sdpScreen,
  sem,
  setMetrics,
  ssp,
  sspRotate,
  toDynamicScaledDp,
  toDynamicScaledPx,
  toDynamicScaledSp,
  toDynamicScaledSpPx,
  UiModeType,
  wdp,
  wdpRotate,
} from '../src/index';
import { powerDp, pwsdp, pwssp, DimenPower } from '../src/power';
import { buildNamespace } from '../src/core/namespace';
import { SCALED } from '../src/core/scaled';
import { POWER } from '../src/strategies/power';
import { ACCESSOR_COUNT_PER_STRATEGY } from '../src/generated/meta';
import * as scaledModule from '../src/generated/scaled';
import * as powerModule from '../src/generated/power';

const pin = (w: number, h: number, extra: Record<string, unknown> = {}): void =>
  setMetrics({ screenWidthDp: w, screenHeightDp: h, density: 2, fontScale: 1.25, ...extra });

afterEach(() => setMetrics(null));

describe('accessors', () => {
  it('sdp / hdp / wdp scale by smallest width / height / width over 300', () => {
    pin(600, 900);
    expect(sdp(16)).toBeCloseTo(32);
    expect(hdp(16)).toBeCloseTo(48);
    expect(wdp(16)).toBeCloseTo(32);
  });

  it('ssp applies the font scale, sem does not', () => {
    pin(600, 900);
    expect(ssp(10)).toBeCloseTo(25);
    expect(sem(10)).toBeCloseTo(20);
  });

  it('values follow snapshot changes immediately', () => {
    pin(300, 533);
    expect(sdp(10)).toBeCloseTo(10);
    pin(450, 800);
    expect(sdp(10)).toBeCloseTo(15);
  });
});

describe('generic resolvers', () => {
  it('toDynamicScaled{Dp,Px,Sp,SpPx}', () => {
    pin(600, 900);
    expect(toDynamicScaledDp(10)).toBeCloseTo(20);
    expect(toDynamicScaledPx(10, DpQualifier.HEIGHT)).toBeCloseTo(60);
    expect(toDynamicScaledSp(10)).toBeCloseTo(25);
    expect(toDynamicScaledSp(10, DpQualifier.SMALL_WIDTH, { fontScale: false })).toBeCloseTo(20);
    expect(toDynamicScaledSpPx(10)).toBeCloseTo(50);
    expect(toDynamicScaledDp(10, DpQualifier.SMALL_WIDTH, { applyAspectRatio: true })).toBeCloseTo(sdpa(10));
  });

  it('rejects non-finite values', () => {
    expect(() => toDynamicScaledDp(Number.NaN)).toThrow(RangeError);
  });

  it('ignoreMultiWindows returns the base value in multi-window', () => {
    pin(600, 900, { isInMultiWindowMode: true });
    expect(toDynamicScaledDp(10, DpQualifier.SMALL_WIDTH, { ignoreMultiWindows: true })).toBe(10);
    expect(toDynamicScaledDp(10)).toBeCloseTo(20);
  });
});

describe('facilitators', () => {
  it('Rotate picks the rotation value in the target orientation', () => {
    pin(900, 600); // landscape
    expect(sdpRotate(10, 30)).toBeCloseTo(60); // 30 × 600/300
    expect(sdpRotate(10, 30, Orientation.PORTRAIT)).toBeCloseTo(20);
    expect(sdpRotatePx(10, 30)).toBeCloseTo(120);
    expect(wdpRotate(10, 30, Orientation.LANDSCAPE)).toBeCloseTo(90);
    expect(sdpRotate(10, 30, Orientation.LANDSCAPE, { finalQualifierResolver: DpQualifier.WIDTH })).toBeCloseTo(90);
    expect(sspRotate(10, 30)).toBeCloseTo(60 * 1.25);
  });

  it('Mode matches the UI mode', () => {
    pin(900, 600, { uiModeType: UiModeType.TELEVISION });
    expect(sdpMode(10, 40, UiModeType.TELEVISION)).toBeCloseTo(80);
    expect(sdpMode(10, 40, UiModeType.CAR)).toBeCloseTo(20);
    expect(sdpModePx(10, 40, UiModeType.TELEVISION)).toBeCloseTo(160);
  });

  it('Qualifier matches a dp threshold (>=)', () => {
    pin(600, 900);
    expect(sdpQualifier(10, 20, DpQualifier.SMALL_WIDTH, 600)).toBeCloseTo(40);
    expect(sdpQualifier(10, 20, DpQualifier.SMALL_WIDTH, 601)).toBeCloseTo(20);
    expect(hdpQualifier(10, 20, DpQualifier.WIDTH, 500)).toBeCloseTo(60); // alt scaled on height
  });

  it('Screen needs both UI mode and threshold', () => {
    pin(1920, 1080, { uiModeType: UiModeType.TELEVISION });
    expect(sdpScreen(10, 30, UiModeType.TELEVISION, DpQualifier.SMALL_WIDTH, 1000)).toBeCloseTo(108);
    expect(sdpScreen(10, 30, UiModeType.TELEVISION, DpQualifier.SMALL_WIDTH, 1200)).toBeCloseTo(36);
    expect(sdpScreen(10, 30, UiModeType.NORMAL, DpQualifier.SMALL_WIDTH, 100)).toBeCloseTo(36);
  });

  it('plain helpers only branch', () => {
    pin(900, 600, { uiModeType: UiModeType.TELEVISION });
    expect(plainRotate('a', 'b')).toBe('b');
    expect(plainRotate('a', 'b', Orientation.PORTRAIT)).toBe('a');
    expect(plainMode(1, 2, UiModeType.TELEVISION)).toBe(2);
    expect(plainQualifier(1, 2, DpQualifier.WIDTH, 900)).toBe(2);
    expect(plainScreen(1, 2, UiModeType.TELEVISION, DpQualifier.HEIGHT, 700)).toBe(1);
  });
});

describe('builder', () => {
  it('screen() priorities follow Android (uiMode+qualifier > uiMode > qualifier > orientation)', () => {
    pin(1920, 1080, { uiModeType: UiModeType.TELEVISION });
    const b = scaledDp(10)
      .screen(Orientation.LANDSCAPE, 11)
      .screen(DpQualifier.SMALL_WIDTH, 600, 12)
      .screen(UiModeType.TELEVISION, 13)
      .screen(UiModeType.TELEVISION, DpQualifier.SMALL_WIDTH, 1000, 14);
    expect(b.sdp).toBeCloseTo(14 * 3.6);
    pin(1920, 1080);
    expect(b.sdp).toBeCloseTo(12 * 3.6);
    pin(1000, 500);
    expect(b.sdp).toBeCloseTo(11 * (500 / 300));
    pin(400, 700);
    expect(b.sdp).toBeCloseTo(10 * (400 / 300));
  });

  it('larger qualifier thresholds win within the same priority', () => {
    pin(800, 1200);
    const b = scaledDp(10).screen(DpQualifier.SMALL_WIDTH, 600, 20).screen(DpQualifier.SMALL_WIDTH, 720, 30);
    expect(b.sdp).toBeCloseTo(30 * (800 / 300));
  });

  it('object form, finalQualifierResolver, flags and terminals', () => {
    pin(600, 900, { isInMultiWindowMode: true });
    const b = scaledDp(10).screen({ qualifier: [DpQualifier.HEIGHT, 800], value: 20, finalQualifierResolver: DpQualifier.HEIGHT });
    expect(b.sdp).toBeCloseTo(60);
    expect(b.sdpPx).toBeCloseTo(120);
    expect(b.ignoreMultiWindows().sdp).toBe(20);
    expect(scaledSp(10).ssp).toBeCloseTo(25);
    expect(scaledSp(10).sem).toBeCloseTo(20);
    expect(scaledDp(10).aspectRatio(true).sdp).toBeCloseTo(sdpa(10));
    expect(scaledDp(10).all()).toEqual({ sdp: expect.closeTo(20), hdp: expect.closeTo(30), wdp: expect.closeTo(20) });
  });

  it('builders are immutable and memoized per snapshot', () => {
    pin(600, 900);
    const a = scaledDp(10);
    const b = a.screen(Orientation.PORTRAIT, 50);
    expect(a.sdp).toBeCloseTo(20);
    expect(b.sdp).toBeCloseTo(100);
    expect(b).toBeInstanceOf(DimenBuilder);
  });

  it('strategy builders expose prefixed terminals', () => {
    pin(600, 900);
    const b = powerDp(10);
    expect(b).toBeInstanceOf(DimenPower);
    expect(b.pwsdp).toBeCloseTo(pwsdp(10));
    expect(b.pwssp).toBeCloseTo(pwssp(10));
  });

  it('rejects malformed screen() calls', () => {
    // @ts-expect-error invalid first argument
    expect(() => scaledDp(1).screen('NOPE', 2)).toThrow(TypeError);
    expect(() => scaledDp(1).screen(DpQualifier.WIDTH, 600, Number.NaN)).toThrow(TypeError);
  });
});

describe('css helpers', () => {
  it('cssDimen builds a calc() over the published token', () => {
    expect(cssDimen('sdp', 16)).toBe('calc(16 * var(--sdp))');
    expect(cssDimen('pwhdpa', 2.5)).toBe('calc(2.5 * var(--pwhdpa))');
  });
});

describe('runtime namespace (CDN bundle) mirrors the generated ESM API', () => {
  for (const [def, mod] of [[SCALED, scaledModule], [POWER, powerModule]] as const) {
    it(`${def.id}: same names and results`, () => {
      pin(777, 1111, { isInMultiWindowMode: true, uiModeType: UiModeType.TELEVISION });
      const ns = buildNamespace(def);
      const esmNames = Object.keys(mod).sort();
      const nsNames = Object.keys(ns).sort();
      expect(nsNames).toEqual(esmNames);
      for (const name of esmNames) {
        const a = (mod as Record<string, unknown>)[name];
        const b = ns[name];
        if (typeof a !== 'function' || /^[A-Z]/.test(name)) continue;
        if (name.startsWith('toDynamic') || /Rotate|Mode|Qualifier|Screen/.test(name)) continue;
        if (name.endsWith('Dp') || name.endsWith('Sp')) {
          if (name === `${def.id}Dp` || name === `${def.id}Sp`) continue;
        }
        expect((b as (v: number) => number)(7), name).toBeCloseTo((a as (v: number) => number)(7), 10);
      }
      expect(Object.keys(mod).filter((n) => /(dp|sp|em)/.test(n)).length).toBeGreaterThanOrEqual(ACCESSOR_COUNT_PER_STRATEGY);
    });
  }

  it('builder from the namespace exposes prefixed getters', () => {
    pin(600, 900);
    const ns = buildNamespace(POWER) as { powerDp: (v: number) => Record<string, number> };
    expect(ns.powerDp(10).pwhdp).toBeCloseTo(powerDp(10).pwhdp);
  });
});

describe('inverters on the generated shortcuts', () => {
  it('portrait / landscape swaps', () => {
    pin(400, 800); // portrait
    expect(scaledModule.sdpPh(30)).toBeCloseTo(80);
    expect(scaledModule.sdpPw(30)).toBeCloseTo(40);
    expect(scaledModule.sdpLh(30)).toBeCloseTo(40);
    expect(scaledModule.hdpPw(30)).toBeCloseTo(40);
    expect(scaledModule.wdpPh(30)).toBeCloseTo(80);
    pin(800, 400); // landscape
    expect(scaledModule.sdpLh(30)).toBeCloseTo(40);
    expect(scaledModule.sdpLw(30)).toBeCloseTo(80);
    expect(scaledModule.hdpLw(30)).toBeCloseTo(80);
    expect(scaledModule.wdpLh(30)).toBeCloseTo(40);
    expect(toDynamicScaledDp(30, DpQualifier.WIDTH, { inverter: Inverter.PW_TO_LH })).toBeCloseTo(40);
  });
});
