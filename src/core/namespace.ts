/**
 * Builds a strategy's full API object at runtime (used by the CDN bundles, where
 * thousands of static re-exports would bloat the file). Naming rules are identical to
 * `scripts/generate.mjs`; a test asserts both produce the same names and results.
 */
import {
  boundOf,
  dpFn,
  KIND_DP,
  KIND_SP,
  modeFn,
  pxFn,
  qualifierFn,
  rotateFn,
  screenFn,
  spFn,
  spPxFn,
  toDynamic,
} from './api';
import { DimenBuilder } from './builder';
import { DpQualifier } from './enums';
import { register } from './runtime';
import { FLAG_SUFFIXES, VARIANTS, type StrategyDef } from './strategy';

type Fn = (...args: never[]) => unknown;

const AXES = { s: DpQualifier.SMALL_WIDTH, h: DpQualifier.HEIGHT, w: DpQualifier.WIDTH } as const;
const capitalize = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);

export function buildNamespace(def: StrategyDef): Record<string, unknown> {
  const t = register(def);
  const b = boundOf(def, t);
  const P = def.prefix;
  const N = capitalize(def.id);
  const ns: Record<string, unknown> = { [def.id.toUpperCase()]: def };

  VARIANTS.forEach((v, vi) => {
    FLAG_SUFFIXES.forEach((flag, fi) => {
      const slot = vi * 4 + fi;
      const stem = `${v.token}${flag}`;
      ns[`${P}${v.axis}dp${stem}`] = dpFn(t, slot);
      ns[`${P}${v.axis}dp${stem}Px`] = pxFn(t, slot);
      ns[`${P}${v.axis}sp${stem}`] = spFn(t, slot);
      ns[`${P}${v.axis}sp${stem}Px`] = spPxFn(t, slot);
      ns[`${P}${v.axis}em${stem}`] = dpFn(t, slot);
      ns[`${P}${v.axis}em${stem}Px`] = pxFn(t, slot);
    });
  });

  ns[`toDynamic${N}Dp`] = toDynamic(b, KIND_DP, false);
  ns[`toDynamic${N}Px`] = toDynamic(b, KIND_DP, true);
  ns[`toDynamic${N}Sp`] = toDynamic(b, KIND_SP, false);
  ns[`toDynamic${N}SpPx`] = toDynamic(b, KIND_SP, true);

  const facilitators: [string, (bb: typeof b, q: DpQualifier, k: 0 | 1, px: boolean) => Fn][] = [
    ['Rotate', rotateFn],
    ['Mode', modeFn],
    ['Qualifier', qualifierFn],
    ['Screen', screenFn],
  ];
  for (const [axis, q] of Object.entries(AXES)) {
    for (const [kind, k] of [['dp', KIND_DP], ['sp', KIND_SP]] as const) {
      for (const [name, factory] of facilitators) {
        ns[`${P}${axis}${kind}${name}`] = factory(b, q, k, false);
        ns[`${P}${axis}${kind}${name}Px`] = factory(b, q, k, true);
      }
    }
  }

  class Builder extends DimenBuilder {}
  if (P) {
    for (const axis of ['s', 'h', 'w']) {
      for (const kind of ['dp', 'sp', 'em']) {
        for (const px of ['', 'Px']) {
          Object.defineProperty(Builder.prototype, `${P}${axis}${kind}${px}`, {
            get(this: Record<string, number>) {
              return this[`${axis}${kind}${px}`];
            },
          });
        }
      }
    }
  }
  Object.defineProperty(Builder, 'name', { value: `Dimen${N}` });
  ns[`Dimen${N}`] = Builder;
  ns[`${def.id}Dp`] = (value: number) => new Builder(b, value);
  ns[`${def.id}Sp`] = (value: number) => new Builder(b, value);
  return ns;
}
