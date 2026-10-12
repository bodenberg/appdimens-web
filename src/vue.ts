/**
 * webdimens/vue — Vue 3 bindings.
 *
 *   app.use(WebDimens)                    // installs the runtime (CSS variables)
 *   const pad = useDimen(() => sdp(16))   // reactive, recomputed when the viewport changes
 */
import { computed, getCurrentScope, onScopeDispose, readonly, shallowRef, type App, type ComputedRef, type Ref } from 'vue';
import type { DimenMetrics } from './core/metrics';
import { install, type InstallOptions } from './core/install';
import { getMetrics, subscribe } from './core/runtime';

/**
 * Reactive snapshot of the viewport. Call it in `setup()` (or an `effectScope`): the
 * subscription is released with the scope; outside a scope it lives for the page lifetime.
 */
export function useDimens(): Readonly<Ref<DimenMetrics>> {
  const metrics = shallowRef(getMetrics());
  const off = subscribe((m) => {
    metrics.value = m;
  });
  if (getCurrentScope()) onScopeDispose(off);
  return readonly(metrics) as Readonly<Ref<DimenMetrics>>;
}

/** Computed value re-evaluated on every snapshot change: `useDimen(() => sdp(16))`. */
export function useDimen<T>(compute: () => T): ComputedRef<T> {
  const metrics = useDimens();
  return computed(() => {
    void metrics.value;
    return compute();
  });
}

/** Vue plugin: `app.use(WebDimens, { cssVariables: true })`. */
export const WebDimens = {
  install(_app: App, config?: InstallOptions): void {
    if (typeof window !== 'undefined') install(config);
  },
};

