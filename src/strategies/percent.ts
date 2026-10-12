import { INV_BASE_RATIO } from '../core/constants';
import { defineStrategy, readScreenDp, type StrategyDef } from '../core/strategy';

/** Percent — linear `value × d / 300` on the axis; `a` uses the scaled aspect-ratio law. */
export const PERCENT: StrategyDef = defineStrategy({
  id: 'percent',
  prefix: 'p',
  ar: 'linear',
  scale: (m, q) => readScreenDp(m, q) * INV_BASE_RATIO,
});
