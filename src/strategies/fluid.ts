import { FLUID_MAX_FACTOR, FLUID_MAX_WIDTH, FLUID_MIN_FACTOR, FLUID_MIN_WIDTH } from '../core/constants';
import { defineStrategy, readScreenDp, type StrategyDef } from '../core/strategy';

/** Fluid — linear interpolation from `0.8 × value` at 320 dp to `1.2 × value` at 768 dp, clamped. */
export const FLUID: StrategyDef = defineStrategy({
  id: 'fluid',
  prefix: 'f',
  ar: 'multiply',
  scale: (m, q) => {
    const d = readScreenDp(m, q);
    if (d <= FLUID_MIN_WIDTH) return FLUID_MIN_FACTOR;
    if (d >= FLUID_MAX_WIDTH) return FLUID_MAX_FACTOR;
    return (
      FLUID_MIN_FACTOR +
      ((FLUID_MAX_FACTOR - FLUID_MIN_FACTOR) * (d - FLUID_MIN_WIDTH)) / (FLUID_MAX_WIDTH - FLUID_MIN_WIDTH)
    );
  },
});
