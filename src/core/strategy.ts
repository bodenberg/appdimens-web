import { ADJUSTMENT_SCALE, BASE_WIDTH_DP, INV_BASE_RATIO, SENSITIVITY_DEFAULT } from './constants';
import { DpQualifier, Inverter } from './enums';
import { assertFiniteK, type DimenMetrics } from './metrics';

/**
 * A scaling strategy (Android: one `library-<strategy>` module).
 *
 * Every strategy is `value × factor`, where the factor depends only on the window snapshot,
 * the effective axis and the flags — that is what lets the runtime precompute factor
 * tables and resolve each call with a single multiply.
 */
export interface StrategyDef {
  /** Stable id, e.g. `'scaled'`, `'power'`. */
  readonly id: string;
  /** Name prefix for the generated API (`''` → `sdp`, `'pw'` → `pwsdp`). */
  readonly prefix: string;
  /**
   * `'linear'`: aspect ratio uses the scaled law `1 + (d − 300)(1/300 + k·L)` (scaled, percent).
   * `'multiply'`: base factor × `1 + k·L` (every satellite strategy).
   */
  readonly ar: 'linear' | 'multiply';
  /** Strategy ignores qualifier/inverter (diagonal, fill, fit, perimeter, density). */
  readonly axisFree?: boolean;
  /**
   * Base factor (no aspect ratio) for effective axis `q`.
   * `isDefaultSw` is true for SMALL_WIDTH + DEFAULT inverter (memoized snapshot path).
   */
  scale(m: DimenMetrics, q: DpQualifier, isDefaultSw: boolean): number;
}

/** Port of `DimenCalculationPlumbing.effectiveQualifier`. */
export function effectiveQualifier(
  qualifier: DpQualifier,
  inverter: Inverter,
  isLandscape: boolean,
  isPortrait: boolean,
): DpQualifier {
  switch (inverter) {
    case Inverter.PH_TO_LW:
      return isLandscape && qualifier === DpQualifier.HEIGHT ? DpQualifier.WIDTH : qualifier;
    case Inverter.PW_TO_LH:
      return isLandscape && qualifier === DpQualifier.WIDTH ? DpQualifier.HEIGHT : qualifier;
    case Inverter.LH_TO_PW:
      return isPortrait && qualifier === DpQualifier.HEIGHT ? DpQualifier.WIDTH : qualifier;
    case Inverter.LW_TO_PH:
      return isPortrait && qualifier === DpQualifier.WIDTH ? DpQualifier.HEIGHT : qualifier;
    case Inverter.SW_TO_LH:
      return isLandscape && qualifier === DpQualifier.SMALL_WIDTH ? DpQualifier.HEIGHT : qualifier;
    case Inverter.SW_TO_LW:
      return isLandscape && qualifier === DpQualifier.SMALL_WIDTH ? DpQualifier.WIDTH : qualifier;
    case Inverter.SW_TO_PH:
      return isPortrait && qualifier === DpQualifier.SMALL_WIDTH ? DpQualifier.HEIGHT : qualifier;
    case Inverter.SW_TO_PW:
      return isPortrait && qualifier === DpQualifier.SMALL_WIDTH ? DpQualifier.WIDTH : qualifier;
    default:
      return qualifier;
  }
}

/** Port of `DimenCalculationPlumbing.readScreenDp`. */
export function readScreenDp(m: DimenMetrics, q: DpQualifier): number {
  return q === DpQualifier.HEIGHT
    ? m.screenHeightDp
    : q === DpQualifier.WIDTH
      ? m.screenWidthDp
      : m.smallestScreenWidthDp;
}

/**
 * Full factor resolution — the slow, fully general path (custom k, any inverter).
 * The generated API reads precomputed tables built with this same function.
 */
export function computeFactor(
  def: StrategyDef,
  m: DimenMetrics,
  qualifier: DpQualifier,
  inverter: Inverter = Inverter.DEFAULT,
  ignoreMultiWindows = false,
  applyAspectRatio = false,
  customSensitivityK: number | null = null,
): number {
  if (ignoreMultiWindows && m.isInMultiWindowMode) return 1;
  const q = def.axisFree ? qualifier : effectiveQualifier(qualifier, inverter, m.isLandscape, m.isPortrait);
  if (def.ar === 'linear') {
    if (qualifier === DpQualifier.SMALL_WIDTH && inverter === Inverter.DEFAULT) {
      return m.scaledMultiplier(applyAspectRatio, customSensitivityK);
    }
    const dim = readScreenDp(m, q);
    if (!applyAspectRatio) return dim * INV_BASE_RATIO;
    let k = SENSITIVITY_DEFAULT;
    if (customSensitivityK != null) {
      assertFiniteK(customSensitivityK);
      k = customSensitivityK;
    }
    return 1 + (dim - BASE_WIDTH_DP) * (ADJUSTMENT_SCALE + k * m.logNormalizedAspectRatio);
  }
  const base = def.scale(m, q, qualifier === DpQualifier.SMALL_WIDTH && inverter === Inverter.DEFAULT);
  return applyAspectRatio ? base * m.aspectRatioMultiplier(customSensitivityK) : base;
}

// ─────────────────────────────────────────────────────────────────────────────
// Slot layout of the precomputed factor tables.
// slot = variant * 4 + flags, flags bit 0 = aspect ratio (`a`), bit 1 = ignore multi-window (`i`).
// ─────────────────────────────────────────────────────────────────────────────

export interface AxisVariant {
  /** Axis letter in the API name: `s` (sdp) / `h` (hdp) / `w` (wdp). */
  readonly axis: 's' | 'h' | 'w';
  readonly qualifier: DpQualifier;
  readonly inverter: Inverter;
  /** Inverter token in the API name (`''`, `Ph`, `Lh`, `Pw`, `Lw`). */
  readonly token: '' | 'Ph' | 'Lh' | 'Pw' | 'Lw';
}

export const VARIANTS: readonly AxisVariant[] = Object.freeze([
  { axis: 's', qualifier: DpQualifier.SMALL_WIDTH, inverter: Inverter.DEFAULT, token: '' },
  { axis: 'h', qualifier: DpQualifier.HEIGHT, inverter: Inverter.DEFAULT, token: '' },
  { axis: 'w', qualifier: DpQualifier.WIDTH, inverter: Inverter.DEFAULT, token: '' },
  { axis: 's', qualifier: DpQualifier.SMALL_WIDTH, inverter: Inverter.SW_TO_PH, token: 'Ph' },
  { axis: 's', qualifier: DpQualifier.SMALL_WIDTH, inverter: Inverter.SW_TO_LH, token: 'Lh' },
  { axis: 's', qualifier: DpQualifier.SMALL_WIDTH, inverter: Inverter.SW_TO_PW, token: 'Pw' },
  { axis: 's', qualifier: DpQualifier.SMALL_WIDTH, inverter: Inverter.SW_TO_LW, token: 'Lw' },
  { axis: 'h', qualifier: DpQualifier.HEIGHT, inverter: Inverter.PH_TO_LW, token: 'Lw' },
  { axis: 'h', qualifier: DpQualifier.HEIGHT, inverter: Inverter.LH_TO_PW, token: 'Pw' },
  { axis: 'w', qualifier: DpQualifier.WIDTH, inverter: Inverter.PW_TO_LH, token: 'Lh' },
  { axis: 'w', qualifier: DpQualifier.WIDTH, inverter: Inverter.LW_TO_PH, token: 'Ph' },
] as const);

export const FLAG_SUFFIXES = ['', 'a', 'i', 'ia'] as const;
export const SLOT_COUNT = VARIANTS.length * 4;

/** Fills `out` (length SLOT_COUNT) with every precomputed factor for one snapshot. */
export function fillFactorTable(def: StrategyDef, m: DimenMetrics, out: Float64Array): void {
  for (let v = 0; v < VARIANTS.length; v++) {
    const variant = VARIANTS[v]!;
    const base = v * 4;
    const plain = computeFactor(def, m, variant.qualifier, variant.inverter, false, false);
    const ar = computeFactor(def, m, variant.qualifier, variant.inverter, false, true);
    out[base] = plain;
    out[base + 1] = ar;
    out[base + 2] = m.isInMultiWindowMode ? 1 : plain;
    out[base + 3] = m.isInMultiWindowMode ? 1 : ar;
  }
}

/** Slot for a qualifier with the DEFAULT inverter. */
export function defaultSlot(qualifier: DpQualifier, ignoreMultiWindows: boolean, applyAspectRatio: boolean): number {
  const v = qualifier === DpQualifier.HEIGHT ? 1 : qualifier === DpQualifier.WIDTH ? 2 : 0;
  return v * 4 + (applyAspectRatio ? 1 : 0) + (ignoreMultiWindows ? 2 : 0);
}

/** Slot for a qualifier + inverter pair, or -1 when the pair has no precomputed variant. */
export function variantSlot(
  qualifier: DpQualifier,
  inverter: Inverter,
  ignoreMultiWindows: boolean,
  applyAspectRatio: boolean,
): number {
  for (let v = 0; v < VARIANTS.length; v++) {
    const variant = VARIANTS[v]!;
    if (variant.qualifier === qualifier && variant.inverter === inverter) {
      return v * 4 + (applyAspectRatio ? 1 : 0) + (ignoreMultiWindows ? 2 : 0);
    }
  }
  return -1;
}

/** Declares (and freezes) a strategy definition with full contextual typing. */
export function defineStrategy(def: StrategyDef): StrategyDef {
  return Object.freeze(def);
}
