import { defineStrategy, type StrategyDef } from '../core/strategy';

/** Density — `value × density` (devicePixelRatio on the web; axis independent). */
export const DENSITY: StrategyDef = defineStrategy({
  id: 'density',
  prefix: 'd',
  ar: 'multiply',
  axisFree: true,
  scale: (m) => m.density,
});
