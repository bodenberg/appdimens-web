import { AUTO_TRANSITION_DP, INV_BASE_RATIO, LOG_SENSITIVITY } from '../core/constants';
import { defineStrategy, readScreenDp, type StrategyDef } from '../core/strategy';

/** Auto — linear `d / 300` up to 480 dp, then `1.6 + 0.4·ln(1 + (d − 480) / 300)`. */
export const AUTO: StrategyDef = defineStrategy({
  id: 'auto',
  prefix: 'a',
  ar: 'multiply',
  scale: (m, q) => {
    const d = readScreenDp(m, q);
    return d <= AUTO_TRANSITION_DP
      ? d * INV_BASE_RATIO
      : AUTO_TRANSITION_DP * INV_BASE_RATIO + LOG_SENSITIVITY * Math.log(1 + (d - AUTO_TRANSITION_DP) * INV_BASE_RATIO);
  },
});
