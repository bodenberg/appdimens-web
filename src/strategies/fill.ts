import { BASE_HEIGHT_DP, BASE_WIDTH_DP } from '../core/constants';
import { defineStrategy, type StrategyDef } from '../core/strategy';

/** Fill ("cover") — `value × max(min / 300, max / 533)` (axis independent). */
export const FILL: StrategyDef = defineStrategy({
  id: 'fill',
  prefix: 'fl',
  ar: 'multiply',
  axisFree: true,
  scale: (m) => Math.max(m.minDimensionDp / BASE_WIDTH_DP, m.maxDimensionDp / BASE_HEIGHT_DP),
});
