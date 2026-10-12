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
  makeEnvironmentProviders,
  signal,
  type EnvironmentProviders,
  type Signal,
} from '@angular/core';
import type { DimenMetrics } from './core/metrics';
import { getMetrics, install, subscribe, type WebDimensConfig } from './core/runtime';

/** Installs the runtime (CSS variables) when the environment injector starts. */
export function provideWebDimens(config?: WebDimensConfig): EnvironmentProviders {
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
