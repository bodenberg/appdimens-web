import { logarithmicScaleFor } from '../core/metrics';
import { defineStrategy, readScreenDp, type StrategyDef } from '../core/strategy';

/** Logarithmic — `1 + 0.4·ln(d / 300)` above 300 dp, `1 − 0.4·ln(300 / d)` below. */
export const LOGARITHMIC: StrategyDef = defineStrategy({
  id: 'logarithmic',
  prefix: 'log',
  ar: 'multiply',
  scale: (m, q, isDefaultSw) => (isDefaultSw ? m.logarithmicScale : logarithmicScaleFor(readScreenDp(m, q))),
});
