/**
 * webdimens/units — physical units (Android `appdimens-dynamic-units`).
 *
 * The web exposes no reliable physical DPI, so conversions use the CSS absolute-unit
 * definition (1in = 96 CSS px, the same ratio CSS `in` / `cm` / `mm` use). Kiosks or
 * devices with a known panel can calibrate with {@link setPhysicalCalibration}.
 * In stylesheets prefer the native units directly: `width: 10mm`.
 */
import { UnitType } from './core/enums';
import { getMetrics } from './core/runtime';

export { UnitType };

const MM_PER_INCH = 25.4;
let cssPxPerInch = 96;

/** Sets how many CSS px make one real inch (default 96). Returns the previous value. */
export function setPhysicalCalibration(pxPerInch: number): number {
  if (!(Number.isFinite(pxPerInch) && pxPerInch > 0)) throw new RangeError('pxPerInch must be a positive number');
  const previous = cssPxPerInch;
  cssPxPerInch = pxPerInch;
  return previous;
}

/** Millimetres → dp (CSS px). Android `toMm` / `Float.mm`. */
export const mm = (value: number): number => (value * cssPxPerInch) / MM_PER_INCH;
/** Centimetres → dp (CSS px). */
export const cm = (value: number): number => mm(value * 10);
/** Inches → dp (CSS px). */
export const inch = (value: number): number => value * cssPxPerInch;

export const toDpFromMm = mm;
export const toDpFromCm = cm;
export const toDpFromInch = inch;

/** Physical → device px (× devicePixelRatio). */
export const toPxFromMm = (value: number): number => mm(value) * getMetrics().density;
export const toPxFromCm = (value: number): number => cm(value) * getMetrics().density;
export const toPxFromInch = (value: number): number => inch(value) * getMetrics().density;

/** Physical → sp: the text size that renders at that physical size under the current font scale. */
export const toSpFromMm = (value: number): number => mm(value) / getMetrics().fontScale;
export const toSpFromCm = (value: number): number => cm(value) / getMetrics().fontScale;
export const toSpFromInch = (value: number): number => inch(value) / getMetrics().fontScale;

// Pure conversions between unit labels.
export const convertMmToCm = (v: number): number => v / 10;
export const convertMmToInch = (v: number): number => v / MM_PER_INCH;
export const convertCmToMm = (v: number): number => v * 10;
export const convertCmToInch = (v: number): number => (v * 10) / MM_PER_INCH;
export const convertInchToCm = (v: number): number => (v * MM_PER_INCH) / 10;
export const convertInchToMm = (v: number): number => v * MM_PER_INCH;

/** Size of one unit of `type`, in dp (CSS px). */
export function unitSizeInDp(type: UnitType): number {
  switch (type) {
    case UnitType.INCH:
      return inch(1);
    case UnitType.CM:
      return cm(1);
    case UnitType.MM:
      return mm(1);
    case UnitType.SP:
      return getMetrics().fontScale;
    case UnitType.PX:
      return 1 / getMetrics().density;
    default:
      return 1;
  }
}

/** Radius in dp of a circle whose diameter is `diameter` `type` units. */
export const radius = (diameter: number, type: UnitType = UnitType.DP): number => (diameter * unitSizeInDp(type)) / 2;
export const radiusFromDiameter = radius;
/** Radius in dp of a circle whose circumference is `circumference` `type` units. */
export const radiusFromCircumference = (circumference: number, type: UnitType = UnitType.DP): number =>
  (circumference * unitSizeInDp(type)) / (2 * Math.PI);
/** Diameter from a diameter or a circumference measurement. */
export const measureDiameter = (value: number, isCircumference: boolean): number =>
  isCircumference ? value / Math.PI : value;
export const displayMeasureDiameter = measureDiameter;
