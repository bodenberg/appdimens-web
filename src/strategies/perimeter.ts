import { defineStrategy, type StrategyDef } from '../core/strategy';

/** Perimeter — `value × (min + max) / 833` (axis independent). */
export const PERIMETER: StrategyDef = defineStrategy({
  id: 'perimeter',
  prefix: 'pr',
  ar: 'multiply',
  axisFree: true,
  scale: (m) => m.perimeterScale,
});
