/**
 * webdimens/angular — Angular (16+) signal bindings.
 *
 *   bootstrapApplication(App, { providers: [provideWebDimens()] });
 *
 *   export class Card {
 *     pad = injectDimen(() => sdp(16));   // Signal<number>
 *   }
 */
import {
  computed,
  DestroyRef,
  ENVIRONMENT_INITIALIZER,
  inject,
  InjectionToken,
  makeEnvironmentProviders,
  signal,
  type EnvironmentProviders,
  type Signal,
} from '@angular/core';
import type { DimenMetrics } from './core/metrics';
import { install, type InstallOptions } from './core/install';
import { getMetrics, subscribe } from './core/runtime';
import { bindScalingStrategy, pickScalingStrategy, type BoundScalingStrategy, type ScalingStrategy } from './custom/index';

/** Installs the runtime (CSS variables) when the environment injector starts. */
export function provideWebDimens(config?: InstallOptions): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: ENVIRONMENT_INITIALIZER,
      multi: true,
      useValue: () => {
        if (typeof window !== 'undefined') install(config);
      },
    },
  ]);
}

/** Signal of the current viewport snapshot (call in an injection context). */
export function injectDimens(): Signal<DimenMetrics> {
  const metrics = signal(getMetrics());
  const off = subscribe((m) => metrics.set(m));
  inject(DestroyRef).onDestroy(off);
  return metrics.asReadonly();
}

/** Computed signal re-evaluated on every snapshot change: `injectDimen(() => sdp(16))`. */
export function injectDimen<T>(compute: () => T): Signal<T> {
  const metrics = injectDimens();
  return computed(() => {
    metrics();
    return compute();
  });
}

// ── Custom scaling strategies (`webdimens/custom`) ────────────────────────────

/** Token holding the strategy used by `injectScalingStrategy()` without an argument. */
export const SCALING_STRATEGY = new InjectionToken<ScalingStrategy>('webdimens.scalingStrategy');

/** `providers: [provideScalingStrategy(brand)]` (app or route level). */
export function provideScalingStrategy(strategy: ScalingStrategy | string): EnvironmentProviders {
  return makeEnvironmentProviders([{ provide: SCALING_STRATEGY, useFactory: () => pickScalingStrategy(strategy) }]);
}

/** Signal of helpers bound to `strategy`, updated on snapshot changes: `brand().dp(16)`. */
export function injectScalingStrategy(strategy?: ScalingStrategy | string): Signal<BoundScalingStrategy> {
  const metrics = injectDimens();
  const provided = strategy === undefined ? inject(SCALING_STRATEGY, { optional: true }) : null;
  const target = strategy === undefined ? provided ?? pickScalingStrategy() : pickScalingStrategy(strategy);
  return computed(() => {
    metrics();
    return bindScalingStrategy(target);
  });
}
