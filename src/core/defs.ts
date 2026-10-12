/**
 * Every strategy definition, keyed by name prefix and id. Definitions are tiny (a formula each),
 * so the core keeps all of them: a token such as `16pwsdp` or a class `ad-power` registers its
 * strategy on demand, with no import needed and nothing for a bundler to tree-shake away.
 */
import { SCALED } from './scaled';
import { register, tableForPrefix } from './runtime';
import type { StrategyDef } from './strategy';
import { AUTO } from '../strategies/auto';
import { DENSITY } from '../strategies/density';
import { DIAGONAL } from '../strategies/diagonal';
import { FILL } from '../strategies/fill';
import { FIT } from '../strategies/fit';
import { FLUID } from '../strategies/fluid';
import { INTERPOLATED } from '../strategies/interpolated';
import { LOGARITHMIC } from '../strategies/logarithmic';
import { PERCENT } from '../strategies/percent';
import { PERIMETER } from '../strategies/perimeter';
import { POWER } from '../strategies/power';

export const STRATEGY_DEFS: readonly StrategyDef[] = Object.freeze([
  SCALED, PERCENT, POWER, FLUID, AUTO, DIAGONAL, FILL, FIT, INTERPOLATED, LOGARITHMIC, PERIMETER, DENSITY,
]);

const byPrefix = new Map(STRATEGY_DEFS.map((d) => [d.prefix, d]));
const byId = new Map(STRATEGY_DEFS.map((d) => [d.id, d]));

/** Factor table for a name prefix, registering the strategy first if needed. */
export function ensurePrefix(prefix: string): Float64Array | undefined {
  const table = tableForPrefix(prefix);
  if (table) return table;
  const def = byPrefix.get(prefix);
  return def ? register(def) : undefined;
}

/** Registers a strategy by id (`'power'`, …); returns false for an unknown id. */
export function ensureStrategy(id: string): boolean {
  const def = byId.get(id);
  if (def) register(def);
  return def !== undefined;
}
