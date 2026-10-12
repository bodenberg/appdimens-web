/**
 * Enum-like constants mirroring `com.appdimens.dynamic.common` (Android).
 *
 * They are plain frozen string maps so they tree-shake, serialize and compare
 * with `===` (no lookups on the hot path). Each also exports a matching type,
 * so both `DpQualifier.SMALL_WIDTH` and the literal `'SMALL_WIDTH'` are accepted.
 */

/** Which screen axis drives the scaling (`sdp` → SMALL_WIDTH, `hdp` → HEIGHT, `wdp` → WIDTH). */
export const DpQualifier = Object.freeze({
  SMALL_WIDTH: 'SMALL_WIDTH',
  HEIGHT: 'HEIGHT',
  WIDTH: 'WIDTH',
} as const);
export type DpQualifier = (typeof DpQualifier)[keyof typeof DpQualifier];

/** Orientation-based axis swap rules (the `Ph` / `Lh` / `Pw` / `Lw` name tokens). */
export const Inverter = Object.freeze({
  /** Portrait height → landscape width. */
  PH_TO_LW: 'PH_TO_LW',
  /** Portrait width → landscape height. */
  PW_TO_LH: 'PW_TO_LH',
  /** Landscape height → portrait width. */
  LH_TO_PW: 'LH_TO_PW',
  /** Landscape width → portrait height. */
  LW_TO_PH: 'LW_TO_PH',
  /** Smallest width → height in landscape. */
  SW_TO_LH: 'SW_TO_LH',
  /** Smallest width → width in landscape. */
  SW_TO_LW: 'SW_TO_LW',
  /** Smallest width → height in portrait. */
  SW_TO_PH: 'SW_TO_PH',
  /** Smallest width → width in portrait. */
  SW_TO_PW: 'SW_TO_PW',
  /** No inversion. */
  DEFAULT: 'DEFAULT',
} as const);
export type Inverter = (typeof Inverter)[keyof typeof Inverter];

export const Orientation = Object.freeze({
  PORTRAIT: 'PORTRAIT',
  LANDSCAPE: 'LANDSCAPE',
  DEFAULT: 'DEFAULT',
} as const);
export type Orientation = (typeof Orientation)[keyof typeof Orientation];

/** Device UI mode (Android `UiModeType`, including the foldable states). */
export const UiModeType = Object.freeze({
  NORMAL: 'NORMAL',
  TELEVISION: 'TELEVISION',
  CAR: 'CAR',
  WATCH: 'WATCH',
  DESK: 'DESK',
  APPLIANCE: 'APPLIANCE',
  VR_HEADSET: 'VR_HEADSET',
  UNDEFINED: 'UNDEFINED',
  FOLD_OPEN: 'FOLD_OPEN',
  FOLD_CLOSED: 'FOLD_CLOSED',
  FLIP_OPEN: 'FLIP_OPEN',
  FLIP_CLOSED: 'FLIP_CLOSED',
  FOLD_HALF_OPENED: 'FOLD_HALF_OPENED',
  FLIP_HALF_OPENED: 'FLIP_HALF_OPENED',
} as const);
export type UiModeType = (typeof UiModeType)[keyof typeof UiModeType];

/** Physical / logical units for `units` helpers. */
export const UnitType = Object.freeze({
  INCH: 'INCH',
  CM: 'CM',
  MM: 'MM',
  SP: 'SP',
  DP: 'DP',
  PX: 'PX',
} as const);
export type UnitType = (typeof UnitType)[keyof typeof UnitType];

/** Edge used for box-local percent auto-resize ranges. */
export const AutoResizePercentBasis = Object.freeze({
  HEIGHT: 'HEIGHT',
  WIDTH: 'WIDTH',
  MIN_SIDE: 'MIN_SIDE',
} as const);
export type AutoResizePercentBasis = (typeof AutoResizePercentBasis)[keyof typeof AutoResizePercentBasis];

/** A `DpQualifier` + minimum value pair (e.g. `SMALL_WIDTH >= 600`). */
export interface DpQualifierEntry {
  readonly type: DpQualifier;
  readonly value: number;
}
