/**
 * Strategy-agnostic API building blocks. The generated per-strategy modules
 * (`src/generated/*.ts`) are thin, tree-shakable bindings of these factories.
 */
import { DpQualifier, Inverter, Orientation, UiModeType } from './enums';
import type { DimenMetrics } from './metrics';
import { register, S, sync } from './runtime';
import { computeFactor, readScreenDp, variantSlot, type StrategyDef } from './strategy';

/** Options shared by the generic resolvers and the facilitators. */
export interface DimenOptions {
  /** Orientation axis-swap rule. Default `Inverter.DEFAULT`. */
  inverter?: Inverter;
  /** In a split / floating window return the unscaled base value (`i` suffix). */
  ignoreMultiWindows?: boolean;
  /** Apply the aspect-ratio correction (`a` suffix). */
  applyAspectRatio?: boolean;
  /** Custom aspect-ratio sensitivity k (default 0.08 / 30). */
  customSensitivityK?: number | null;
}

export interface SpOptions extends DimenOptions {
  /** Respect the user font scale (`sp`). `false` behaves like the `em` family. Default `true`. */
  fontScale?: boolean;
}

export interface FacilitatorOptions extends SpOptions {
  /** Axis used to scale the alternate value when the condition matches. Default: the function's axis. */
  finalQualifierResolver?: DpQualifier;
}

export const KIND_DP = 0;
export const KIND_SP = 1;
export type Kind = typeof KIND_DP | typeof KIND_SP;

/** One registered strategy, as seen by the factories. */
export interface Bound {
  readonly def: StrategyDef;
  readonly table: Float64Array;
}

export function bind(def: StrategyDef): Bound {
  return { def, table: register(def) };
}

/** Pairs a strategy with its (already registered) table. */
export function boundOf(def: StrategyDef, table: Float64Array): Bound {
  return { def, table };
}

// ─────────────────────────────────────────────────────────────────────────────
// Hot-path accessors: one dirty-flag branch + one multiply (two for px / sp).
// ─────────────────────────────────────────────────────────────────────────────

/** `value × factor` → CSS px (dp / em families). */
export function dpFn(t: Float64Array, slot: number) {
  return (value: number): number => {
    if (S.dirty) sync();
    return value * t[slot]!;
  };
}

/** `value × factor × devicePixelRatio` → device px. */
export function pxFn(t: Float64Array, slot: number) {
  return (value: number): number => {
    if (S.dirty) sync();
    return value * t[slot]! * S.dpr;
  };
}

/** `value × factor × fontScale` → CSS px (sp family). */
export function spFn(t: Float64Array, slot: number) {
  return (value: number): number => {
    if (S.dirty) sync();
    return value * t[slot]! * S.fs;
  };
}

/** `value × factor × fontScale × devicePixelRatio` → device px. */
export function spPxFn(t: Float64Array, slot: number) {
  return (value: number): number => {
    if (S.dirty) sync();
    return value * t[slot]! * S.fs * S.dpr;
  };
}

/** General resolution in CSS px (or device px when `px`). Uses the precomputed table whenever possible. */
export function resolve(
  b: Bound,
  value: number,
  qualifier: DpQualifier,
  opts: SpOptions | undefined,
  kind: Kind,
  px: boolean,
): number {
  if (S.dirty) sync();
  const inverter = opts?.inverter ?? Inverter.DEFAULT;
  const mw = opts?.ignoreMultiWindows === true;
  const ar = opts?.applyAspectRatio === true;
  const k = opts?.customSensitivityK ?? null;
  let factor: number;
  const slot = k == null ? variantSlot(qualifier, inverter, mw, ar) : -1;
  factor = slot >= 0 ? b.table[slot]! : computeFactor(b.def, S.metrics, qualifier, inverter, mw, ar, k);
  let out = value * factor;
  if (kind === KIND_SP && opts?.fontScale !== false) out *= S.fs;
  return px ? out * S.dpr : out;
}

/** `toDynamic<Strategy>Dp|Px|Sp|SpPx` factory. */
export function toDynamic(b: Bound, kind: Kind, px: boolean) {
  return (value: number, qualifier: DpQualifier = DpQualifier.SMALL_WIDTH, options?: SpOptions): number => {
    if (!Number.isFinite(value)) throw new RangeError('value must be finite');
    return resolve(b, value, qualifier, options, kind, px);
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Facilitators — `sdpRotate`, `sdpMode`, `sdpQualifier`, `sdpScreen` (+ Px, sp, h/w axes).
// ─────────────────────────────────────────────────────────────────────────────

function orientationMatches(m: DimenMetrics, o: Orientation | null | undefined): boolean {
  return o === Orientation.LANDSCAPE ? m.isLandscape : o === Orientation.PORTRAIT ? m.isPortrait : false;
}

function pick(
  b: Bound,
  match: boolean,
  value: number,
  alt: number,
  axis: DpQualifier,
  opts: FacilitatorOptions | undefined,
  kind: Kind,
  px: boolean,
): number {
  return match
    ? resolve(b, alt, opts?.finalQualifierResolver ?? axis, opts, kind, px)
    : resolve(b, value, axis, opts, kind, px);
}

/** `value` on its axis, or `rotationValue` (scaled with `finalQualifierResolver`) in `orientation`. */
export function rotateFn(b: Bound, axis: DpQualifier, kind: Kind, px: boolean) {
  return (
    value: number,
    rotationValue: number,
    orientation: Orientation = Orientation.LANDSCAPE,
    options?: FacilitatorOptions,
  ): number => {
    if (S.dirty) sync();
    return pick(b, orientationMatches(S.metrics, orientation), value, rotationValue, axis, options, kind, px);
  };
}

/** `modeValue` when the current UI mode is `uiModeType`, `value` otherwise. */
export function modeFn(b: Bound, axis: DpQualifier, kind: Kind, px: boolean) {
  return (value: number, modeValue: number, uiModeType: UiModeType, options?: FacilitatorOptions): number => {
    if (S.dirty) sync();
    return pick(b, S.metrics.uiModeType === uiModeType, value, modeValue, axis, options, kind, px);
  };
}

/** `qualifiedValue` when the `qualifierType` axis is ≥ `qualifierValue` dp, `value` otherwise. */
export function qualifierFn(b: Bound, axis: DpQualifier, kind: Kind, px: boolean) {
  return (
    value: number,
    qualifiedValue: number,
    qualifierType: DpQualifier,
    qualifierValue: number,
    options?: FacilitatorOptions,
  ): number => {
    if (S.dirty) sync();
    const match = readScreenDp(S.metrics, qualifierType) >= qualifierValue;
    return pick(b, match, value, qualifiedValue, axis, options, kind, px);
  };
}

/** `screenValue` when both the UI mode and the qualifier threshold match, `value` otherwise. */
export function screenFn(b: Bound, axis: DpQualifier, kind: Kind, px: boolean) {
  return (
    value: number,
    screenValue: number,
    uiModeType: UiModeType,
    qualifierType: DpQualifier,
    qualifierValue: number,
    options?: FacilitatorOptions,
  ): number => {
    if (S.dirty) sync();
    const m = S.metrics;
    const match = m.uiModeType === uiModeType && readScreenDp(m, qualifierType) >= qualifierValue;
    return pick(b, match, value, screenValue, axis, options, kind, px);
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Plain (logic-only) branches — receiver and alternate are already final values.
// Port of `code.plain.DimenPlainBranch` (`plainRotatePx`, `plainModePx`, …).
// ─────────────────────────────────────────────────────────────────────────────

/** `rotation` when the device is in `orientation`, `value` otherwise. No scaling. */
export function plainRotate<T>(value: T, rotation: T, orientation: Orientation = Orientation.LANDSCAPE): T {
  if (S.dirty) sync();
  return orientationMatches(S.metrics, orientation) ? rotation : value;
}

/** `mode` when the current UI mode is `uiModeType`, `value` otherwise. No scaling. */
export function plainMode<T>(value: T, mode: T, uiModeType: UiModeType): T {
  if (S.dirty) sync();
  return S.metrics.uiModeType === uiModeType ? mode : value;
}

/** `qualified` when the `qualifierType` axis is ≥ `qualifierValue`, `value` otherwise. No scaling. */
export function plainQualifier<T>(value: T, qualified: T, qualifierType: DpQualifier, qualifierValue: number): T {
  if (S.dirty) sync();
  return readScreenDp(S.metrics, qualifierType) >= qualifierValue ? qualified : value;
}

/** `screen` when UI mode and qualifier both match, `value` otherwise. No scaling. */
export function plainScreen<T>(
  value: T,
  screen: T,
  uiModeType: UiModeType,
  qualifierType: DpQualifier,
  qualifierValue: number,
): T {
  if (S.dirty) sync();
  const m = S.metrics;
  return m.uiModeType === uiModeType && readScreenDp(m, qualifierType) >= qualifierValue ? screen : value;
}

// ─────────────────────────────────────────────────────────────────────────────
// CSS helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `cssDimen('sdp', 16)` → `"calc(16 * var(--sdp))"`. Works with every published token
 * (`sdpa`, `hdpLw`, `ssp`, `pwsdp`, …) and stays responsive without JavaScript re-renders.
 */
export function cssDimen(token: string, value: number): string {
  return `calc(${value} * var(--${token}))`;
}
