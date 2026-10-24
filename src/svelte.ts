/**
 * webdimens/svelte — Svelte store bindings (store contract, no Svelte import needed;
 * works with Svelte 3/4 `$store` syntax and Svelte 5).
 *
 *   <script>
 *     import { sdp } from 'webdimens';
 *     import { dimen } from 'webdimens/svelte';
 *     const pad = dimen(() => sdp(16));
 *   </script>
 *   <div style="padding: {$pad}px"></div>
 */
import type { DimenMetrics } from './core/metrics';
import { getMetrics, subscribe } from './core/runtime';
import { bindScalingStrategy, pickScalingStrategy, type BoundScalingStrategy, type ScalingStrategy } from './custom/index';

export interface Readable<T> {
  subscribe(run: (value: T) => void): () => void;
}

/** Store of the current viewport snapshot. */
export const metrics: Readable<DimenMetrics> = {
  subscribe(run) {
    run(getMetrics());
    return subscribe(run);
  },
};

/** Store recomputed on every snapshot change: `const pad = dimen(() => sdp(16))`. */
export function dimen<T>(compute: () => T): Readable<T> {
  return {
    subscribe(run) {
      run(compute());
      return subscribe(() => run(compute()));
    },
  };
}

/**
 * Store of helpers bound to `strategy` (default: the global default), re-emitted on every
 * snapshot change: `const brand = scalingStrategy('brand')` → `{$brand.dp(16)}`.
 */
export function scalingStrategy(strategy?: ScalingStrategy | string): Readable<BoundScalingStrategy> {
  return {
    subscribe(run) {
      const s = pickScalingStrategy(strategy);
      run(bindScalingStrategy(s));
      return subscribe(() => run(bindScalingStrategy(s)));
    },
  };
}
