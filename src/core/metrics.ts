import {
  ADJUSTMENT_SCALE,
  BASE_DIAGONAL_DP,
  BASE_PERIMETER_DP,
  BASE_WIDTH_DP,
  INV_BASE_RATIO,
  LOG_SENSITIVITY,
  POWER_EXPONENT,
  REFERENCE_ASPECT_RATIO,
  SENSITIVITY_DEFAULT,
} from './constants';
import { Orientation, UiModeType } from './enums';

/** Raw window inputs — the web equivalent of the Android `Configuration` fields AppDimens reads. */
export interface DimenMetricsInit {
  /** Viewport width in CSS px (== dp). */
  screenWidthDp: number;
  /** Viewport height in CSS px (== dp). */
  screenHeightDp: number;
  /** Smallest width; defaults to `min(width, height)`. */
  smallestScreenWidthDp?: number;
  /** Device pixels per CSS px (`window.devicePixelRatio`). Default 1. */
  density?: number;
  /** User font scale (browser default font size / 16). Default 1. */
  fontScale?: number;
  /** Defaults to LANDSCAPE when width > height, PORTRAIT otherwise (CSS `orientation` media feature). */
  orientation?: Orientation;
  /** Default NORMAL. */
  uiModeType?: UiModeType;
  /** Window is a split/floating window (drives the `i` variants). Default false. */
  isInMultiWindowMode?: boolean;
}

const positiveOr = (v: number | undefined, fallback: number): number =>
  v !== undefined && Number.isFinite(v) && v > 0 ? v : fallback;

const nonNegative = (v: number): number => (Number.isFinite(v) && v > 0 ? v : 0);

/**
 * Immutable snapshot of everything a dimension depends on for one window (or one scoped
 * element). Port of Android `DimenMetrics`: every derived factor is computed once here, so
 * resolving a dimension is a single multiply.
 */
export class DimenMetrics {
  readonly screenWidthDp: number;
  readonly screenHeightDp: number;
  readonly smallestScreenWidthDp: number;
  readonly density: number;
  readonly fontScale: number;
  readonly orientation: Orientation;
  readonly uiModeType: UiModeType;
  readonly isInMultiWindowMode: boolean;

  readonly isLandscape: boolean;
  readonly isPortrait: boolean;
  readonly minDimensionDp: number;
  readonly maxDimensionDp: number;
  /** `sw` used by every SMALL_WIDTH formula. */
  readonly smallestWidthDp: number;
  /** `sw / 300` */
  readonly scale: number;
  /** `w / 300` */
  readonly screenWidthFactor: number;
  /** `h / 300` */
  readonly screenHeightFactor: number;
  /** `(max / min) / 1.78` */
  readonly normalizedAspectRatio: number;
  /** `ln(normalizedAspectRatio)` */
  readonly logNormalizedAspectRatio: number;
  /** `1 + k·ln(AR/1.78)` — multiplier used by the satellite strategies' `a` variants. */
  readonly defaultAspectRatioMultiplier: number;
  /** `1 + (sw − 300)·(1/300 + k·ln(AR/1.78))` — scaled `sdpa`. */
  readonly defaultScaledAspectRatioMultiplier: number;
  /** `(sw / 300)^0.75` */
  readonly powerScale: number;
  /** `1 + (sw / 300 − 1)·0.5` */
  readonly interpolatedScale: number;
  /** `√(min² + max²) / 611.63` */
  readonly diagonalScale: number;
  /** `(min + max) / 833` */
  readonly perimeterScale: number;
  /** piecewise `1 ± 0.4·ln(…)` on sw */
  readonly logarithmicScale: number;

  constructor(init: DimenMetricsInit) {
    const w = nonNegative(init.screenWidthDp);
    const h = nonNegative(init.screenHeightDp);
    this.screenWidthDp = w;
    this.screenHeightDp = h;
    this.minDimensionDp = Math.min(w, h);
    this.maxDimensionDp = Math.max(w, h);
    this.smallestScreenWidthDp = positiveOr(init.smallestScreenWidthDp, this.minDimensionDp);
    this.density = positiveOr(init.density, 1);
    this.fontScale = positiveOr(init.fontScale, 1);
    this.orientation =
      init.orientation ?? (w > h ? Orientation.LANDSCAPE : h > 0 || w > 0 ? Orientation.PORTRAIT : Orientation.DEFAULT);
    this.uiModeType = init.uiModeType ?? UiModeType.NORMAL;
    this.isInMultiWindowMode = init.isInMultiWindowMode === true;
    this.isLandscape = this.orientation === Orientation.LANDSCAPE;
    this.isPortrait = this.orientation === Orientation.PORTRAIT;

    const sw = this.smallestScreenWidthDp > 0 ? this.smallestScreenWidthDp : BASE_WIDTH_DP;
    this.smallestWidthDp = sw;
    this.scale = sw * INV_BASE_RATIO;
    this.screenWidthFactor = w * INV_BASE_RATIO;
    this.screenHeightFactor = h * INV_BASE_RATIO;

    const rawAr = this.minDimensionDp > 0 ? this.maxDimensionDp / this.minDimensionDp : 1;
    const nAr = rawAr / REFERENCE_ASPECT_RATIO;
    this.normalizedAspectRatio = Number.isFinite(nAr) && nAr > 0 ? nAr : 1;
    this.logNormalizedAspectRatio = Math.log(this.normalizedAspectRatio);
    this.defaultAspectRatioMultiplier = 1 + SENSITIVITY_DEFAULT * this.logNormalizedAspectRatio;
    this.defaultScaledAspectRatioMultiplier =
      1 + (sw - BASE_WIDTH_DP) * (ADJUSTMENT_SCALE + SENSITIVITY_DEFAULT * this.logNormalizedAspectRatio);

    this.powerScale = Math.pow(sw / BASE_WIDTH_DP, POWER_EXPONENT);
    this.interpolatedScale = 1 + (sw * INV_BASE_RATIO - 1) * 0.5;
    this.diagonalScale =
      Math.sqrt(this.minDimensionDp * this.minDimensionDp + this.maxDimensionDp * this.maxDimensionDp) /
      BASE_DIAGONAL_DP;
    this.perimeterScale = (this.minDimensionDp + this.maxDimensionDp) / BASE_PERIMETER_DP;
    this.logarithmicScale = logarithmicScaleFor(sw);
    Object.freeze(this);
  }

  /** Multiplier used by the scaled path (`sdp` / `sdpa` / custom k). Throws on a non-finite k. */
  scaledMultiplier(applyAspectRatio: boolean, customSensitivityK?: number | null): number {
    if (!applyAspectRatio) return this.scale;
    if (customSensitivityK == null) return this.defaultScaledAspectRatioMultiplier;
    assertFiniteK(customSensitivityK);
    return (
      1 +
      (this.smallestWidthDp - BASE_WIDTH_DP) * (ADJUSTMENT_SCALE + customSensitivityK * this.logNormalizedAspectRatio)
    );
  }

  /** Multiplier shared by satellite strategies that apply AR after their base formula. */
  aspectRatioMultiplier(customSensitivityK?: number | null): number {
    if (customSensitivityK == null) return this.defaultAspectRatioMultiplier;
    assertFiniteK(customSensitivityK);
    return 1 + customSensitivityK * this.logNormalizedAspectRatio;
  }

  /** Structural equality on the raw inputs (derived values follow). */
  equals(other: DimenMetrics | null | undefined): boolean {
    return (
      !!other &&
      other.screenWidthDp === this.screenWidthDp &&
      other.screenHeightDp === this.screenHeightDp &&
      other.smallestScreenWidthDp === this.smallestScreenWidthDp &&
      other.density === this.density &&
      other.fontScale === this.fontScale &&
      other.orientation === this.orientation &&
      other.uiModeType === this.uiModeType &&
      other.isInMultiWindowMode === this.isInMultiWindowMode
    );
  }

  /** Reference snapshot (300 × 533 dp, density 1) used on the server and before the first measure. */
  static readonly DEFAULT: DimenMetrics = new DimenMetrics({
    screenWidthDp: BASE_WIDTH_DP,
    screenHeightDp: 533,
    orientation: Orientation.DEFAULT,
  });
}

/** Logarithmic strategy curve on one axis value (`1 + 0.4·ln(d/300)` above 300, mirrored below). */
export function logarithmicScaleFor(dim: number): number {
  if (dim > BASE_WIDTH_DP) return 1 + LOG_SENSITIVITY * Math.log(dim * INV_BASE_RATIO);
  if (dim > 0) return 1 - LOG_SENSITIVITY * Math.log(BASE_WIDTH_DP / dim);
  return 1;
}

export function assertFiniteK(k: number): void {
  if (!Number.isFinite(k)) throw new RangeError('customSensitivityK must be finite');
}
