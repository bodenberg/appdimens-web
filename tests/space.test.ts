import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setMetrics } from '../src/index';
import {
  space,
  spaceH,
  spaceHi,
  spaceHPx,
  spaceHPxi,
  spaceHSp,
  spaceHSpi,
  spaceHSpiPx,
  spaceHSpPx,
  spaceI,
  spacePx,
  spacePxi,
  spaceSp,
  spaceSpi,
  spaceSpiPx,
  spaceSpPx,
  spaceSw,
  spaceSwi,
  spaceSwPx,
  spaceSwPxi,
  spaceSwSp,
  spaceSwSpi,
  spaceSwSpiPx,
  spaceSwSpPx,
  spaceW,
  spaceWi,
  spaceWPx,
  spaceWPxi,
  spaceWSp,
  spaceWSpi,
  spaceWSpiPx,
  spaceWSpPx,
} from '../src/percent';

interface Pin {
  width: number;
  height: number;
  density?: number;
  fontScale?: number;
  multiWindow?: boolean;
}

function pin({ width, height, density = 1, fontScale = 1, multiWindow = false }: Pin): void {
  setMetrics({
    screenWidthDp: width,
    screenHeightDp: height,
    density,
    fontScale,
    isInMultiWindowMode: multiWindow,
  });
}

beforeEach(() => pin({ width: 400, height: 300 }));

afterEach(() => {
  setMetrics(null);
});

describe('percent of the viewport axes', () => {
  it('spaceW, spaceH and spaceSw are percent of width, height and the smallest side', () => {
    expect(spaceW(50)).toBeCloseTo(200, 9);
    expect(spaceH(50)).toBeCloseTo(150, 9);
    expect(spaceSw(50)).toBeCloseTo(150, 9);
    expect(spaceW(15)).toBeCloseTo(60, 9);
    expect(spaceSw(10)).toBeCloseTo(30, 9);
  });

  it('spaceSw uses the smaller side in portrait too', () => {
    pin({ width: 300, height: 700 });
    expect(spaceSw(10)).toBeCloseTo(30, 9);
    expect(spaceW(10)).toBeCloseTo(30, 9);
    expect(spaceH(10)).toBeCloseTo(70, 9);
  });

  it('values follow viewport changes', () => {
    expect(spaceW(50)).toBeCloseTo(200, 9);
    pin({ width: 800, height: 600 });
    expect(spaceW(50)).toBeCloseTo(400, 9);
    expect(spaceH(50)).toBeCloseTo(300, 9);
  });
});

describe('space(percent, reference)', () => {
  it('is percent of a reference length: space(25, 200) = 50', () => {
    expect(space(25, 200)).toBe(50);
    expect(space(100, 37)).toBe(37);
    expect(space(0, 200)).toBe(0);
  });

  it('does not depend on the viewport', () => {
    pin({ width: 1000, height: 1000 });
    expect(space(25, 200)).toBe(50);
  });
});

describe('Px variants multiply by the device density', () => {
  beforeEach(() => pin({ width: 400, height: 300, density: 2 }));

  it('spaceWPx, spaceHPx and spaceSwPx', () => {
    expect(spaceWPx(15)).toBeCloseTo(120, 9);
    expect(spaceHPx(50)).toBeCloseTo(300, 9);
    expect(spaceSwPx(50)).toBeCloseTo(300, 9);
  });

  it('spacePx multiplies the reference by density', () => {
    expect(spacePx(25, 200)).toBe(100);
  });
});

describe('non-finite percent yields 0', () => {
  it('returns 0 for NaN and infinite percents across the API', () => {
    expect(spaceW(Number.NaN)).toBe(0);
    expect(spaceH(Number.POSITIVE_INFINITY)).toBe(0);
    expect(spaceSw(Number.NEGATIVE_INFINITY)).toBe(0);
    expect(spaceWi(Number.NaN)).toBe(0);
    expect(spaceWPx(Number.NaN)).toBe(0);
    expect(spaceWSp(Number.NaN)).toBe(0);
    expect(spaceSp(Number.NaN, 200)).toBe(0);
    expect(space(Number.NaN, 200)).toBe(0);
    expect(space(Number.POSITIVE_INFINITY, 200)).toBe(0);
    expect(spacePx(Number.NaN, 200)).toBe(0);
  });
});

describe('i variants return the raw receiver in multi-window mode', () => {
  it('outside multi-window the i variant is the normal percent', () => {
    expect(spaceWi(50)).toBeCloseTo(200, 9);
    expect(spaceSwi(50)).toBeCloseTo(150, 9);
    expect(spaceHi(50)).toBeCloseTo(150, 9);
  });

  it('in multi-window spaceWi(50) returns 50 while spaceW(50) stays the percent of width', () => {
    pin({ width: 400, height: 300, multiWindow: true });
    expect(spaceWi(50)).toBe(50);
    expect(spaceSwi(50)).toBe(50);
    expect(spaceHi(50)).toBe(50);
    expect(spaceW(50)).toBeCloseTo(200, 9);
    expect(spaceH(50)).toBeCloseTo(150, 9);
  });

  it('in multi-window the Px i variants multiply the raw receiver by density', () => {
    pin({ width: 400, height: 300, density: 2, multiWindow: true });
    expect(spaceWPxi(50)).toBe(100);
    expect(spaceHPxi(50)).toBe(100);
    expect(spaceSwPxi(50)).toBe(100);
    expect(spaceWPx(50)).toBeCloseTo(400, 9);
  });

  it('in multi-window the Sp i variants return the raw percent times font scale', () => {
    pin({ width: 400, height: 300, fontScale: 1.5, multiWindow: true });
    expect(spaceWSpi(50)).toBe(75);
    expect(spaceWSpi(50, false)).toBe(50);
    expect(spaceSwSpi(50)).toBe(75);
    expect(spaceHSpi(50)).toBe(75);
    expect(spaceWSp(50)).toBeCloseTo(300, 9);
  });

  it('in multi-window the Sp Px i variant multiplies by density and font scale', () => {
    pin({ width: 400, height: 300, density: 2, fontScale: 1.5, multiWindow: true });
    expect(spaceWSpiPx(50)).toBe(150);
    expect(spaceHSpiPx(50, false)).toBe(100);
    expect(spaceSwSpiPx(50)).toBe(150);
    expect(spaceWSpPx(50)).toBeCloseTo(600, 9);
  });
});

describe('Sp variants scale by font scale unless fontScale is false', () => {
  beforeEach(() => pin({ width: 400, height: 300, fontScale: 1.5 }));

  it('spaceWSp, spaceSwSp and spaceHSp multiply by font scale by default', () => {
    expect(spaceWSp(50)).toBeCloseTo(300, 9);
    expect(spaceSwSp(50)).toBeCloseTo(225, 9);
    expect(spaceHSp(50)).toBeCloseTo(225, 9);
  });

  it('they do not multiply by font scale when fontScale is false', () => {
    expect(spaceWSp(50, false)).toBeCloseTo(200, 9);
    expect(spaceSwSp(50, false)).toBeCloseTo(150, 9);
    expect(spaceHSp(50, false)).toBeCloseTo(150, 9);
  });

  it('spaceSp scales the reference by font scale unless fontScale is false', () => {
    expect(spaceSp(25, 200)).toBe(75);
    expect(spaceSp(25, 200, false)).toBe(50);
  });

  it('Sp Px variants multiply by density as well', () => {
    pin({ width: 400, height: 300, density: 2, fontScale: 1.5 });
    expect(spaceWSpPx(50)).toBeCloseTo(600, 9);
    expect(spaceWSpPx(50, false)).toBeCloseTo(400, 9);
    expect(spaceHSpPx(50)).toBeCloseTo(450, 9); // 150 × 1.5 × 2
    expect(spaceSwSpPx(50)).toBeCloseTo(450, 9); // 150 × 1.5 × 2
    expect(spaceSpPx(25, 200)).toBe(150);
    expect(spaceSpPx(25, 200, false)).toBe(100);
  });
});

describe('aliases', () => {
  it('spaceI, spacePxi, spaceSpi and spaceSpiPx are the base functions', () => {
    expect(spaceI).toBe(space);
    expect(spacePxi).toBe(spacePx);
    expect(spaceSpi).toBe(spaceSp);
    expect(spaceSpiPx).toBe(spaceSpPx);
  });
});
