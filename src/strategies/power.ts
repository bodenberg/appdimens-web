import { BASE_WIDTH_DP, POWER_EXPONENT } from '../core/constants';
import { defineStrategy, readScreenDp, type StrategyDef } from '../core/strategy';

/** Power — sublinear `value × (d / 300)^0.75`. */
export const POWER: StrategyDef = defineStrategy({
  id: 'power',
  prefix: 'pw',
  ar: 'multiply',
  scale: (m, q, isDefaultSw) =>
    isDefaultSw ? m.powerScale : Math.pow(readScreenDp(m, q) / BASE_WIDTH_DP, POWER_EXPONENT),
});
