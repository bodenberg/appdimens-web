import { defineStrategy, type StrategyDef } from '../core/strategy';

/** Diagonal — `value × √(min² + max²) / 611.63` (axis independent). */
export const DIAGONAL: StrategyDef = defineStrategy({
  id: 'diagonal',
  prefix: 'dg',
  ar: 'multiply',
  axisFree: true,
  scale: (m) => m.diagonalScale,
});
