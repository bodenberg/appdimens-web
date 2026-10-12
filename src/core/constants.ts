/**
 * Design reference constants — identical to `DesignScaleConstants` / `DimenCache`
 * in AppDimens Dynamic 3.2.0 (Android). Do not change: every strategy formula
 * depends on them and parity tests pin the results.
 */

/** Reference smallest width (dp / CSS px). */
export const BASE_WIDTH_DP = 300;
/** Reference height (dp / CSS px). */
export const BASE_HEIGHT_DP = 533;
/** √(300² + 533²) */
export const BASE_DIAGONAL_DP = 611.6305;
/** 300 + 533 */
export const BASE_PERIMETER_DP = 833;
/** Reference aspect ratio (≈ 16:9). */
export const REFERENCE_ASPECT_RATIO = 1.78;
/** 1 / 1.78 */
export const INV_REFERENCE_ASPECT_RATIO = 0.5617978;

/** 1 / 300 */
export const INV_BASE_RATIO = 1 / 300;
/** 0.10 / 30 — linear adjustment used by the aspect-ratio ("a") variants. */
export const ADJUSTMENT_SCALE = 0.1 / 30;
/** 0.08 / 30 — default aspect-ratio sensitivity (k). */
export const SENSITIVITY_DEFAULT = 0.08 / 30;

/** Fluid strategy band (dp). */
export const FLUID_MIN_WIDTH = 320;
export const FLUID_MAX_WIDTH = 768;
export const FLUID_MIN_FACTOR = 0.8;
export const FLUID_MAX_FACTOR = 1.2;

/** Auto strategy: linear until this width, logarithmic after it. */
export const AUTO_TRANSITION_DP = 480;
/** Auto / logarithmic sensitivity. */
export const LOG_SENSITIVITY = 0.4;

/** Power strategy exponent. */
export const POWER_EXPONENT = 0.75;

/** CSS reference pixel density: 1 CSS px == 1 dp (Android mdpi, 160 dpi). */
export const DENSITY_DPI_BASE = 160;

/** Library version (kept in sync with package.json by `scripts/verify-dist.mjs`). */
export const VERSION = '3.2.1';
