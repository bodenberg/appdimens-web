import { BASE_HEIGHT_DP, BASE_WIDTH_DP } from '../core/constants';
import { defineStrategy, type StrategyDef } from '../core/strategy';

/** Fit ("contain") — `value × min(min / 300, max / 533)` (axis independent). */
export const FIT: StrategyDef = defineStrategy({
  id: 'fit',
  prefix: 'ft',
  ar: 'multiply',
  axisFree: true,
  scale: (m) => Math.min(m.minDimensionDp / BASE_WIDTH_DP, m.maxDimensionDp / BASE_HEIGHT_DP),
});
