import { INV_BASE_RATIO } from '../core/constants';
import { defineStrategy, readScreenDp, type StrategyDef } from '../core/strategy';

/** Interpolated — halfway between the base value and linear scaling: `1 + (d / 300 − 1) × 0.5`. */
export const INTERPOLATED: StrategyDef = defineStrategy({
  id: 'interpolated',
  prefix: 'i',
  ar: 'multiply',
  scale: (m, q, isDefaultSw) =>
    isDefaultSw ? m.interpolatedScale : 1 + (readScreenDp(m, q) * INV_BASE_RATIO - 1) * 0.5,
});
