import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setMetrics } from '../src/index';
import {
  UnitType,
  cm,
  convertCmToInch,
  convertCmToMm,
  convertInchToCm,
  convertInchToMm,
  convertMmToCm,
  convertMmToInch,
  displayMeasureDiameter,
  inch,
  measureDiameter,
  mm,
  radius,
  radiusFromCircumference,
  radiusFromDiameter,
  setPhysicalCalibration,
  toDpFromCm,
  toDpFromInch,
  toDpFromMm,
  toPxFromCm,
  toPxFromInch,
  toPxFromMm,
  toSpFromCm,
  toSpFromInch,
  toSpFromMm,
  unitSizeInDp,
} from '../src/units';

const CSS_PX_PER_INCH = 96;

function pin(density = 1, fontScale = 1): void {
  setMetrics({ screenWidthDp: 400, screenHeightDp: 300, density, fontScale, isInMultiWindowMode: false });
}

beforeEach(() => pin());

afterEach(() => {
  setPhysicalCalibration(CSS_PX_PER_INCH);
  setMetrics(null);
});

describe('physical lengths use 96 CSS px per inch', () => {
  it('inch(1) is 96 dp', () => {
    expect(inch(1)).toBe(96);
    expect(inch(2.5)).toBe(240);
  });

  it('cm(2.54) and mm(25.4) are one inch', () => {
    expect(cm(2.54)).toBeCloseTo(96, 9);
    expect(mm(25.4)).toBeCloseTo(96, 9);
  });

  it('mm and cm scale linearly', () => {
    expect(mm(1)).toBeCloseTo(96 / 25.4, 12);
    expect(cm(1)).toBeCloseTo(960 / 25.4, 9);
    expect(mm(10)).toBeCloseTo(cm(1), 9);
  });

  it('the toDpFrom* aliases are the base functions', () => {
    expect(toDpFromMm).toBe(mm);
    expect(toDpFromCm).toBe(cm);
    expect(toDpFromInch).toBe(inch);
  });
});

describe('setPhysicalCalibration', () => {
  it('changes the px per inch and returns the previous value', () => {
    expect(setPhysicalCalibration(160)).toBe(96);
    expect(inch(1)).toBe(160);
    expect(cm(2.54)).toBeCloseTo(160, 9);
    expect(mm(25.4)).toBeCloseTo(160, 9);
    expect(setPhysicalCalibration(96)).toBe(160);
    expect(inch(1)).toBe(96);
  });

  it('rejects non-positive and non-finite values with a RangeError and keeps the calibration', () => {
    for (const bad of [0, -96, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => setPhysicalCalibration(bad)).toThrow(RangeError);
    }
    expect(inch(1)).toBe(96);
  });
});

describe('px and sp conversions', () => {
  beforeEach(() => pin(2, 1.5));

  it('toPxFrom* multiply by the device density', () => {
    expect(toPxFromInch(1)).toBe(192);
    expect(toPxFromMm(25.4)).toBeCloseTo(192, 9);
    expect(toPxFromCm(2.54)).toBeCloseTo(192, 9);
  });

  it('toSpFrom* divide by the font scale and ignore density', () => {
    expect(toSpFromInch(1)).toBe(64);
    expect(toSpFromMm(25.4)).toBeCloseTo(64, 9);
    expect(toSpFromCm(2.54)).toBeCloseTo(64, 9);
  });
});

describe('pure unit-label conversions', () => {
  it('convert between mm, cm and inch', () => {
    expect(convertMmToCm(25.4)).toBeCloseTo(2.54, 12);
    expect(convertMmToInch(25.4)).toBeCloseTo(1, 12);
    expect(convertCmToMm(2.54)).toBeCloseTo(25.4, 12);
    expect(convertCmToInch(2.54)).toBeCloseTo(1, 12);
    expect(convertInchToCm(1)).toBeCloseTo(2.54, 12);
    expect(convertInchToMm(1)).toBeCloseTo(25.4, 12);
  });

  it('do not depend on the physical calibration', () => {
    setPhysicalCalibration(160);
    expect(convertInchToMm(1)).toBeCloseTo(25.4, 12);
    expect(convertMmToInch(25.4)).toBeCloseTo(1, 12);
  });
});

describe('unitSizeInDp', () => {
  beforeEach(() => pin(2, 1.25));

  it('gives the dp size of one unit of each type', () => {
    expect(unitSizeInDp(UnitType.INCH)).toBe(96);
    expect(unitSizeInDp(UnitType.CM)).toBeCloseTo(96 / 2.54, 9);
    expect(unitSizeInDp(UnitType.MM)).toBeCloseTo(96 / 25.4, 9);
    expect(unitSizeInDp(UnitType.SP)).toBe(1.25);
    expect(unitSizeInDp(UnitType.PX)).toBe(0.5);
    expect(unitSizeInDp(UnitType.DP)).toBe(1);
  });

  it('follows the physical calibration for inch, cm and mm', () => {
    setPhysicalCalibration(120);
    expect(unitSizeInDp(UnitType.INCH)).toBe(120);
    expect(unitSizeInDp(UnitType.CM)).toBeCloseTo(120 / 2.54, 9);
  });
});

describe('radius and diameter helpers', () => {
  it('radius(diameter) defaults to dp', () => {
    expect(radius(10)).toBe(5);
  });

  it('radius converts the diameter from the given unit', () => {
    expect(radius(2, UnitType.INCH)).toBe(96);
    expect(radius(10, UnitType.MM)).toBeCloseTo(mm(10) / 2, 9);
    pin(1, 1.5);
    expect(radius(4, UnitType.SP)).toBe(3);
  });

  it('radius uses the device density for PX', () => {
    pin(2);
    expect(radius(8, UnitType.PX)).toBe(2);
  });

  it('radiusFromDiameter is the same function as radius', () => {
    expect(radiusFromDiameter).toBe(radius);
  });

  it('radiusFromCircumference divides the circumference by 2π', () => {
    expect(radiusFromCircumference(10)).toBeCloseTo(10 / (2 * Math.PI), 12);
    expect(radiusFromCircumference(2 * Math.PI * 5)).toBeCloseTo(5, 12);
    expect(radiusFromCircumference(2 * Math.PI, UnitType.INCH)).toBeCloseTo(96, 9);
  });

  it('measureDiameter returns a diameter as-is, or derives it from a circumference', () => {
    expect(measureDiameter(10, false)).toBe(10);
    expect(measureDiameter(7 * Math.PI, true)).toBeCloseTo(7, 12);
    expect(displayMeasureDiameter).toBe(measureDiameter);
  });

  it('a circumference measurement gives the same radius either way', () => {
    const circumference = 2 * Math.PI * 6;
    expect(radius(measureDiameter(circumference, true))).toBeCloseTo(radiusFromCircumference(circumference), 12);
  });
});
