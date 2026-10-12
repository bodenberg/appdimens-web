/**
 * Element-scoped snapshots — the web analogue of Android per-window `DimenMetrics`.
 *
 * A scope measures one element (ResizeObserver) and treats its content box as the
 * "window": the CSS custom properties are written on the element, so every `var(--sdp)`
 * inside it scales with the container instead of the viewport (widgets, previews,
 * resizable panels, micro-frontends).
 */
import type { DimenOptions, SpOptions } from './api';
import { DpQualifier, Inverter } from './enums';
import { DimenMetrics } from './metrics';
import { cssDeclarations, getMetrics, registeredStrategies, subscribe } from './runtime';
import { SCALED } from './scaled';
import { computeFactor, type StrategyDef } from './strategy';

export interface DimenScopeOptions {
  /** Strategies whose CSS tokens are written on the element. Default: every registered strategy. */
  strategies?: readonly StrategyDef[];
  /** Write CSS custom properties on the element. Default `true`. */
  cssVariables?: boolean;
  /** Called after every snapshot change. */
  onChange?: (metrics: DimenMetrics) => void;
}

export interface DimenScope {
  /** Current element snapshot. */
  readonly metrics: DimenMetrics;
  /** Resolves `value` with `strategy` (default scaled) against the element → CSS px. */
  dp(value: number, qualifier?: DpQualifier, options?: DimenOptions & { strategy?: StrategyDef }): number;
  /** Text variant (× font scale unless `fontScale: false`) → CSS px. */
  sp(value: number, qualifier?: DpQualifier, options?: SpOptions & { strategy?: StrategyDef }): number;
  /** Re-measures immediately. */
  update(): void;
  /** Stops observing and removes the CSS properties written on the element. */
  disconnect(): void;
}

/** Creates a scope bound to `element`'s content box. */
export function createDimenScope(element: HTMLElement, options: DimenScopeOptions = {}): DimenScope {
  let metrics = DimenMetrics.DEFAULT;
  const written = new Map<string, string>();
  let width = element.clientWidth;
  let height = element.clientHeight;

  const rebuild = (): void => {
    const g = getMetrics();
    const next = new DimenMetrics({
      screenWidthDp: width,
      screenHeightDp: height,
      density: g.density,
      fontScale: g.fontScale,
      uiModeType: g.uiModeType,
      isInMultiWindowMode: g.isInMultiWindowMode,
    });
    if (next.equals(metrics)) return;
    metrics = next;
    if (options.cssVariables !== false) writeVars();
    options.onChange?.(metrics);
  };

  const writeVars = (): void => {
    const text = cssDeclarations(metrics, options.strategies ?? registeredStrategies());
    for (const declaration of text.split(';')) {
      const i = declaration.indexOf(':');
      if (i < 0) continue;
      const name = declaration.slice(0, i);
      const value = declaration.slice(i + 1);
      if (written.get(name) !== value) {
        element.style.setProperty(name, value);
        written.set(name, value);
      }
    }
  };

  const ro =
    typeof ResizeObserver !== 'undefined'
      ? new ResizeObserver((entries) => {
          const box = entries[entries.length - 1]!.contentRect;
          width = box.width;
          height = box.height;
          rebuild();
        })
      : null;
  ro?.observe(element);
  const unsubscribe = subscribe(() => rebuild());
  rebuild();

  const resolve = (value: number, q: DpQualifier, o: (SpOptions & { strategy?: StrategyDef }) | undefined): number =>
    value *
    computeFactor(
      o?.strategy ?? SCALED,
      metrics,
      q,
      o?.inverter ?? Inverter.DEFAULT,
      o?.ignoreMultiWindows === true,
      o?.applyAspectRatio === true,
      o?.customSensitivityK ?? null,
    );

  return {
    get metrics() {
      return metrics;
    },
    dp: (value, q = DpQualifier.SMALL_WIDTH, o) => resolve(value, q, o),
    sp: (value, q = DpQualifier.SMALL_WIDTH, o) => resolve(value, q, o) * (o?.fontScale === false ? 1 : metrics.fontScale),
    update() {
      width = element.clientWidth;
      height = element.clientHeight;
      rebuild();
    },
    disconnect() {
      ro?.disconnect();
      unsubscribe();
      for (const name of written.keys()) element.style.removeProperty(name);
      written.clear();
    },
  };
}
