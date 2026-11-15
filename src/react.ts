/**
 * webdimens/react — React bindings.
 *
 *   install();                            // once, in your entry (CSS variables)
 *   function Card() {
 *     useDimens();                        // re-render when the viewport snapshot changes
 *     return <div style={{ padding: sdp(16), fontSize: ssp(14) }} />;
 *   }
 *
 * SSR: inline JS values render with the server snapshot; prefer CSS tokens
 * (`cssDimen('sdp', 16)` → `calc(16 * var(--sdp))`) for server-rendered markup.
 */
import {
  createContext,
  createElement,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type DependencyList,
  type ReactNode,
  type RefObject,
} from 'react';
import { createDimenScope, type DimenScope, type DimenScopeOptions } from './core/scope';
import type { DimenMetrics } from './core/metrics';
import { install, type InstallOptions } from './core/install';
import { getMetrics, getVersion, S, subscribe } from './core/runtime';
import { bindScalingStrategy, pickScalingStrategy, type BoundScalingStrategy, type ScalingStrategy } from './custom/index';

const serverMetrics = (): DimenMetrics => S.metrics;
const serverVersion = (): number => S.version;

/** Current snapshot; the component re-renders (at most once per frame) when it changes. */
export function useDimens(): DimenMetrics {
  return useSyncExternalStore(subscribe, getMetrics, serverMetrics);
}

/** Snapshot version — handy as a `useMemo` / `useEffect` dependency. */
export function useDimensVersion(): number {
  return useSyncExternalStore(subscribe, getVersion, serverVersion);
}

/**
 * Memoizes `compute` per snapshot: `const s = useDimen(() => ({ pad: sdp(16), title: ssp(20) }))`.
 * Pass `deps` when `compute` reads props or state: `useDimen(() => sdp(size), [size])`.
 */
export function useDimen<T>(compute: () => T, deps: DependencyList = []): T {
  const version = useDimensVersion();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(compute, [version, ...deps]);
}

/** Starts the runtime (CSS variables) once from a component. Equivalent to calling `install()`. */
export function useWebDimens(config?: InstallOptions): DimenMetrics {
  const configured = useRef(false);
  if (!configured.current && typeof window !== 'undefined') {
    configured.current = true;
    install(config);
  }
  return useDimens();
}

/**
 * Element-scoped snapshot (CSS tokens written on the element; see `createDimenScope`).
 * Follows `ref.current` across commits, so elements mounted later or swapped are picked up.
 */
export function useDimenScope<T extends HTMLElement>(
  ref: RefObject<T | null>,
  options?: DimenScopeOptions,
): DimenScope | null {
  const [scope, setScope] = useState<DimenScope | null>(null);
  const [, force] = useState(0);
  const current = useRef<{ el: T; scope: DimenScope } | null>(null);
  const optionsRef = useRef(options);
  optionsRef.current = options;

  // Runs after every commit: cheap identity check, (re)creates the scope only when the element changes.
  useEffect(() => {
    const el = ref.current;
    if (current.current?.el === el) return;
    current.current?.scope.disconnect();
    current.current = null;
    if (!el) {
      setScope(null);
      return;
    }
    const s = createDimenScope(el, {
      ...optionsRef.current,
      onChange: (m) => {
        optionsRef.current?.onChange?.(m);
        force((n) => n + 1);
      },
    });
    current.current = { el, scope: s };
    setScope(s);
  });

  useEffect(
    () => () => {
      current.current?.scope.disconnect();
      current.current = null;
    },
    [],
  );
  return scope;
}

// ── Custom scaling strategies (`webdimens/custom`) ────────────────────────────

const ScalingStrategyContext = createContext<ScalingStrategy | null>(null);

/** Every `useScalingStrategy()` without an argument inside `children` uses `strategy`. */
export function ScalingStrategyProvider(props: { strategy: ScalingStrategy | string; children?: ReactNode }) {
  return createElement(ScalingStrategyContext.Provider, { value: pickScalingStrategy(props.strategy) }, props.children);
}

/**
 * Helpers bound to `strategy` (default: nearest `ScalingStrategyProvider`, then the global
 * default); re-renders on snapshot changes. `const s = useScalingStrategy(); s.dp(16)`.
 */
export function useScalingStrategy(strategy?: ScalingStrategy | string): BoundScalingStrategy {
  const version = useDimensVersion();
  const scoped = useContext(ScalingStrategyContext);
  const target = strategy === undefined ? scoped ?? pickScalingStrategy() : pickScalingStrategy(strategy);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  return useMemo(() => bindScalingStrategy(target), [target, version]);
}
