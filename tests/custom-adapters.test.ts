import { act, createElement, type ReactNode } from 'react';
import { afterEach, describe, expect, it } from 'vitest';
// @ts-expect-error TS7016: no declaration file for react-dom/client
import { createRoot as createReactRoot } from 'react-dom/client';
import { createApp, defineComponent, h, nextTick } from 'vue';
import { flush, setMetrics } from '../src/index';
import { defineScalingStrategy, resetScalingStrategiesForTest } from '../src/custom';
import { ScalingStrategyProvider, useScalingStrategy } from '../src/react';
import { provideScalingStrategy, useScalingStrategy as useVueScalingStrategy } from '../src/vue';
import { scalingStrategy } from '../src/svelte';

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
const createRoot = createReactRoot as (c: Element) => { render(n: ReactNode): void; unmount(): void };

afterEach(() => {
  resetScalingStrategiesForTest();
  setMetrics(null);
  document.body.innerHTML = '';
});

const brand = () => defineScalingStrategy({ id: 'brand', curve: { type: 'power', exponent: 0.8 } });

describe('custom strategies in framework adapters', () => {
  it('React: provider + hook re-render on snapshot change', () => {
    setMetrics({ screenWidthDp: 411, screenHeightDp: 891 });
    const b = brand();
    const seen: number[] = [];
    function Probe() {
      seen.push(useScalingStrategy().dp(16));
      return null;
    }
    const el = document.createElement('div');
    document.body.appendChild(el);
    const root = createRoot(el);
    act(() => root.render(createElement(ScalingStrategyProvider, { strategy: b }, createElement(Probe))));
    expect(seen[seen.length - 1]).toBeCloseTo(b.dp(16), 10);
    act(() => {
      setMetrics({ screenWidthDp: 800, screenHeightDp: 1280 });
      flush();
    });
    expect(seen[seen.length - 1]).toBeCloseTo(16 * Math.pow(800 / 300, 0.8), 10);
    act(() => root.unmount());
  });

  it('Vue: provide/inject + reactive reads', async () => {
    setMetrics({ screenWidthDp: 411, screenHeightDp: 891 });
    const b = brand();
    const Child = defineComponent({
      setup() {
        const s = useVueScalingStrategy();
        return () => h('span', String(Math.round(s.dp(100))));
      },
    });
    const Parent = defineComponent({
      setup() {
        provideScalingStrategy(b);
        return () => h(Child);
      },
    });
    const el = document.createElement('div');
    document.body.appendChild(el);
    const app = createApp(Parent);
    app.mount(el);
    expect(el.textContent).toBe(String(Math.round(b.dp(100))));
    setMetrics({ screenWidthDp: 800, screenHeightDp: 1280 });
    flush();
    await nextTick();
    expect(el.textContent).toBe(String(Math.round(100 * Math.pow(800 / 300, 0.8))));
    app.unmount();
  });

  it('Svelte: store re-emits bound helpers', () => {
    setMetrics({ screenWidthDp: 411, screenHeightDp: 891 });
    brand();
    const values: number[] = [];
    const off = scalingStrategy('brand').subscribe((s) => values.push(s.dp(16)));
    setMetrics({ screenWidthDp: 800, screenHeightDp: 1280 });
    flush();
    off();
    expect(values[0]).toBeCloseTo(16 * Math.pow(411 / 300, 0.8), 10);
    expect(values[values.length - 1]).toBeCloseTo(16 * Math.pow(800 / 300, 0.8), 10);
  });
});
