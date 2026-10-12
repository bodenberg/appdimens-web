import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createApp,
  defineComponent,
  effectScope,
  h,
  isReadonly,
  isRef,
  nextTick,
  type App,
  type Component,
  type ComputedRef,
} from 'vue';
import { flush, setMetrics, sdp, uninstall } from '../src/index';
import { useDimen, useDimens, WebDimens } from '../src/vue';

type Snapshot = ReturnType<typeof useDimens>;

const mountedApps: App[] = [];

function mountApp(component: Component): { app: App; el: HTMLElement } {
  const el = document.createElement('div');
  document.body.appendChild(el);
  const app = createApp(component);
  app.mount(el);
  mountedApps.push(app);
  return { app, el };
}

function unmountApp(app: App): void {
  const i = mountedApps.indexOf(app);
  if (i >= 0) mountedApps.splice(i, 1);
  app.unmount();
}

function pin(screenWidthDp: number, screenHeightDp: number): void {
  setMetrics({ screenWidthDp, screenHeightDp });
  flush();
}

function styleText(): string {
  return document.getElementById('webdimens-vars')?.textContent ?? '';
}

beforeEach(() => {
  pin(300, 533);
});

afterEach(() => {
  for (const app of mountedApps.splice(0)) app.unmount();
  document.body.innerHTML = '';
  setMetrics(null);
  uninstall();
});

describe('useDimens', () => {
  it('returns a readonly ref that follows setMetrics + flush', () => {
    const scope = effectScope();
    const snapshot = scope.run(() => useDimens())!;

    expect(isRef(snapshot)).toBe(true);
    expect(isReadonly(snapshot)).toBe(true);
    expect(snapshot.value.screenWidthDp).toBe(300);

    pin(600, 800);
    expect(snapshot.value.screenWidthDp).toBe(600);
    expect(snapshot.value.screenHeightDp).toBe(800);

    scope.stop();
  });

  it('rejects writes to the returned ref', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const scope = effectScope();
    const snapshot = scope.run(() => useDimens())!;

    expect(() => {
      (snapshot as unknown as { value: unknown }).value = { screenWidthDp: 1 };
    }).not.toThrow();
    expect(snapshot.value.screenWidthDp).toBe(300);

    warn.mockRestore();
    scope.stop();
  });

  it('stops following the viewport once its effect scope is disposed', () => {
    const scope = effectScope();
    const snapshot = scope.run(() => useDimens())!;
    scope.stop();

    expect(() => pin(600, 800)).not.toThrow();
    expect(snapshot.value.screenWidthDp).toBe(300);
  });

  it('unsubscribes when the owning component unmounts', () => {
    let snapshot!: Snapshot;
    let pad!: ComputedRef<number>;
    let evaluations = 0;

    const { app } = mountApp(
      defineComponent({
        setup() {
          snapshot = useDimens();
          pad = useDimen(() => {
            evaluations++;
            return sdp(16);
          });
          return () => h('p', String(pad.value));
        },
      }),
    );
    expect(pad.value).toBe(16);

    unmountApp(app);
    const evaluationsAtUnmount = evaluations;

    expect(() => pin(600, 800)).not.toThrow();
    expect(() => pin(900, 900)).not.toThrow();
    expect(snapshot.value.screenWidthDp).toBe(300);
    expect(pad.value).toBe(16);
    expect(evaluations).toBe(evaluationsAtUnmount);
  });
});

describe('useDimen', () => {
  it('computes sdp(16) as 16 and then 32 after a snapshot change', () => {
    const scope = effectScope();
    const pad = scope.run(() => useDimen(() => sdp(16)))!;

    expect(pad.value).toBe(16);
    pin(600, 800);
    expect(pad.value).toBe(32);

    scope.stop();
  });

  it('renders the updated value after nextTick', async () => {
    const { el } = mountApp(
      defineComponent({
        setup() {
          const pad = useDimen(() => sdp(16));
          return () => h('p', { class: 'pad' }, String(pad.value));
        },
      }),
    );
    expect(el.textContent).toBe('16');

    pin(600, 800);
    await nextTick();
    expect(el.textContent).toBe('32');
  });
});

describe('WebDimens plugin', () => {
  it('installs the CSS variables through app.use(WebDimens, config)', () => {
    const app = createApp({ render: () => null });
    app.use(WebDimens, { cssVariables: true });

    expect(styleText()).toContain('--sdp:1px');

    pin(600, 800);
    expect(styleText()).toContain('--sdp:2px');
  });

  it('enables CSS variables by default', () => {
    const app = createApp({ render: () => null });
    app.use(WebDimens);

    expect(styleText()).toContain('--sdp:1px');
  });

  it('skips the CSS variables when cssVariables is false', () => {
    const app = createApp({ render: () => null });
    app.use(WebDimens, { cssVariables: false });

    expect(document.getElementById('webdimens-vars')).toBeNull();
  });
});
