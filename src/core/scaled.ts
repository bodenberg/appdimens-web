import { INV_BASE_RATIO } from './constants';
import { defineStrategy, readScreenDp, type StrategyDef } from './strategy';

/** Scaled (default) strategy — `value × d / 300`; `a` variants use `1 + (d − 300)(1/300 + k·L)`. */
export const SCALED: StrategyDef = defineStrategy({
  id: 'scaled',
  prefix: '',
  ar: 'linear',
  scale: (m, q, isDefaultSw) => (isDefaultSw ? m.scale : readScreenDp(m, q) * INV_BASE_RATIO),
});
