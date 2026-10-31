/**
 * webdimens/vue — Vue 3 bindings.
 *
 *   app.use(WebDimens)                    // installs the runtime (CSS variables)
 *   const pad = useDimen(() => sdp(16))   // reactive, recomputed when the viewport changes
 */
import {
  computed,
  getCurrentInstance,
  getCurrentScope,
  inject,
  onScopeDispose,
  provide,
  readonly,
  shallowRef,
  type App,
  type ComputedRef,
  type InjectionKey,
  type Ref,
} from 'vue';
import type { DimenMetrics } from './core/metrics';
import { install, type InstallOptions } from './core/install';
import { getMetrics, subscribe } from './core/runtime';
import { bindScalingStrategy, pickScalingStrategy, type BoundScalingStrategy, type ScalingStrategy } from './custom/index';

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


// ── Custom scaling strategies (`webdimens/custom`) ────────────────────────────

const STRATEGY_KEY: InjectionKey<ScalingStrategy> = Symbol('webdimens-scaling-strategy');

/** Descendants calling `useScalingStrategy()` without an argument use `strategy`. */
export function provideScalingStrategy(strategy: ScalingStrategy | string): void {
  provide(STRATEGY_KEY, pickScalingStrategy(strategy));
}

/**
 * Helpers bound to `strategy` (default: provided strategy, then the global default). Reads are
 * reactive: templates / computeds re-run when the snapshot changes. `const s = useScalingStrategy(); s.dp(16)`.
 */
export function useScalingStrategy(strategy?: ScalingStrategy | string): BoundScalingStrategy {
  const metrics = useDimens();
  const provided = strategy === undefined && getCurrentInstance() ? inject(STRATEGY_KEY, null) : null;
  return bindScalingStrategy(strategy === undefined ? provided ?? pickScalingStrategy() : pickScalingStrategy(strategy), () => {
    void metrics.value;
  });
}

/** Computed px for one value: `const pad = useCdp(16, brand)`. */
export function useCdp(value: number, strategy?: ScalingStrategy | string): ComputedRef<number> {
  const s = useScalingStrategy(strategy);
  return computed(() => s.dp(value));
}
