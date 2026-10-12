import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { DimenMetrics } from '../src/core/metrics';
import { flush, setMetrics, sdp, uninstall } from '../src/index';
import { dimen, metrics } from '../src/svelte';

function pin(screenWidthDp: number, screenHeightDp: number): void {
  setMetrics({ screenWidthDp, screenHeightDp });
  flush();
}

beforeEach(() => {
  pin(300, 533);
});

afterEach(() => {
  setMetrics(null);
  uninstall();
});

describe('metrics store', () => {
  it('emits the current snapshot immediately and again after each change', () => {
    const seen: DimenMetrics[] = [];
    const unsubscribe = metrics.subscribe((m) => seen.push(m));

    expect(seen).toHaveLength(1);
    expect(seen[0]!.screenWidthDp).toBe(300);
    expect(seen[0]!.screenHeightDp).toBe(533);

    pin(600, 800);
    expect(seen).toHaveLength(2);
    expect(seen[1]!.screenWidthDp).toBe(600);
    expect(seen[1]!.screenHeightDp).toBe(800);

    unsubscribe();
  });

  it('stops emitting after unsubscribe', () => {
    const seen: DimenMetrics[] = [];
    const unsubscribe = metrics.subscribe((m) => seen.push(m));
    unsubscribe();

    pin(600, 800);
    pin(900, 900);
    expect(seen).toHaveLength(1);
  });
});

describe('dimen store', () => {
  it('emits sdp(16) as 16 and then 32', () => {
    const pad = dimen(() => sdp(16));
    const seen: number[] = [];
    const unsubscribe = pad.subscribe((v) => seen.push(v));

    pin(600, 800);
    expect(seen).toEqual([16, 32]);

    unsubscribe();
  });

  it('stops emitting after unsubscribe', () => {
    const pad = dimen(() => sdp(16));
    const seen: number[] = [];
    const unsubscribe = pad.subscribe((v) => seen.push(v));
    unsubscribe();

    pin(600, 800);
    expect(seen).toEqual([16]);
  });

  it('recomputes once per snapshot change', () => {
    let computations = 0;
    const pad = dimen(() => {
      computations++;
      return sdp(16);
    });
    const unsubscribe = pad.subscribe(() => {});
    expect(computations).toBe(1);

    pin(600, 800);
    expect(computations).toBe(2);

    unsubscribe();
  });
});
