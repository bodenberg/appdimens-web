/** Literal percent `space*` API (Android `DimenPercentSpace`). */
import { DpQualifier } from './enums';
import type { DimenMetrics } from './metrics';
import { S, sync } from './runtime';
import { readScreenDp } from './strategy';


/**
 * Port of `literalPercentOfScreenDp`: `(percent / 100) × axis`. With `ignoreMultiWindows`
 * in a split / floating window the receiver is returned as-is (Android behaviour).
 */
function literal(percent: number, q: DpQualifier, ignoreMultiWindows: boolean): number {
  if (!Number.isFinite(percent)) return 0;
  if (S.dirty) sync();
  const m: DimenMetrics = S.metrics;
  if (ignoreMultiWindows && m.isInMultiWindowMode) return percent;
  return (percent / 100) * readScreenDp(m, q);
}

const reference = (percent: number, referenceDp: number): number =>
  Number.isFinite(percent) ? (percent / 100) * referenceDp : 0;

const sp = (len: number, fontScale: boolean): number => (fontScale ? len * S.fs : len);

/** `percent`% of the viewport width → CSS px. `spaceW(15)`. */
export const spaceW = (percent: number): number => literal(percent, DpQualifier.WIDTH, false);
export const spaceWi = (percent: number): number => literal(percent, DpQualifier.WIDTH, true);
export const spaceWPx = (percent: number): number => literal(percent, DpQualifier.WIDTH, false) * S.dpr;
export const spaceWPxi = (percent: number): number => literal(percent, DpQualifier.WIDTH, true) * S.dpr;

/** `percent`% of the smallest viewport side → CSS px. */
export const spaceSw = (percent: number): number => literal(percent, DpQualifier.SMALL_WIDTH, false);
export const spaceSwi = (percent: number): number => literal(percent, DpQualifier.SMALL_WIDTH, true);
export const spaceSwPx = (percent: number): number => literal(percent, DpQualifier.SMALL_WIDTH, false) * S.dpr;
export const spaceSwPxi = (percent: number): number => literal(percent, DpQualifier.SMALL_WIDTH, true) * S.dpr;

/** `percent`% of the viewport height → CSS px. */
export const spaceH = (percent: number): number => literal(percent, DpQualifier.HEIGHT, false);
export const spaceHi = (percent: number): number => literal(percent, DpQualifier.HEIGHT, true);
export const spaceHPx = (percent: number): number => literal(percent, DpQualifier.HEIGHT, false) * S.dpr;
export const spaceHPxi = (percent: number): number => literal(percent, DpQualifier.HEIGHT, true) * S.dpr;

/** `percent`% of a reference length (dp / CSS px). `space(25, 200)` → 50. */
export const space = (percent: number, referenceDp: number): number => reference(percent, referenceDp);
export const spaceI = space;
export const spacePx = (percent: number, referenceDp: number): number => {
  if (S.dirty) sync();
  return reference(percent, referenceDp) * S.dpr;
};
export const spacePxi = spacePx;

// Text variants: `fontScale` (default true) multiplies by the user font scale, like every web `sp`.
export const spaceWSp = (percent: number, fontScale = true, ignoreMultiWindows = false): number =>
  sp(literal(percent, DpQualifier.WIDTH, ignoreMultiWindows), fontScale);
export const spaceWSpi = (percent: number, fontScale = true): number => spaceWSp(percent, fontScale, true);
export const spaceWSpPx = (percent: number, fontScale = true, ignoreMultiWindows = false): number =>
  spaceWSp(percent, fontScale, ignoreMultiWindows) * S.dpr;
export const spaceWSpiPx = (percent: number, fontScale = true): number => spaceWSpPx(percent, fontScale, true);

export const spaceSwSp = (percent: number, fontScale = true, ignoreMultiWindows = false): number =>
  sp(literal(percent, DpQualifier.SMALL_WIDTH, ignoreMultiWindows), fontScale);
export const spaceSwSpi = (percent: number, fontScale = true): number => spaceSwSp(percent, fontScale, true);
export const spaceSwSpPx = (percent: number, fontScale = true, ignoreMultiWindows = false): number =>
  spaceSwSp(percent, fontScale, ignoreMultiWindows) * S.dpr;
export const spaceSwSpiPx = (percent: number, fontScale = true): number => spaceSwSpPx(percent, fontScale, true);

export const spaceHSp = (percent: number, fontScale = true, ignoreMultiWindows = false): number =>
  sp(literal(percent, DpQualifier.HEIGHT, ignoreMultiWindows), fontScale);
export const spaceHSpi = (percent: number, fontScale = true): number => spaceHSp(percent, fontScale, true);
export const spaceHSpPx = (percent: number, fontScale = true, ignoreMultiWindows = false): number =>
  spaceHSp(percent, fontScale, ignoreMultiWindows) * S.dpr;
export const spaceHSpiPx = (percent: number, fontScale = true): number => spaceHSpPx(percent, fontScale, true);

export const spaceSp = (percent: number, referenceDp: number, fontScale = true): number => {
  if (S.dirty) sync();
  return sp(reference(percent, referenceDp), fontScale);
};
export const spaceSpi = spaceSp;
export const spaceSpPx = (percent: number, referenceDp: number, fontScale = true): number =>
  spaceSp(percent, referenceDp, fontScale) * S.dpr;
export const spaceSpiPx = spaceSpPx;
