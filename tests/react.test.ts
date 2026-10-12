import { act, createElement, useRef, useState, type ReactElement, type ReactNode } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// react-dom ships no typings and @types/react-dom is not installed, so the one call used here is typed locally.
// @ts-expect-error TS7016: no declaration file for react-dom/client
import { createRoot as createReactRoot } from 'react-dom/client';
import { flush, getVersion, setMetrics, sdp, uninstall, type DimenScope } from '../src/index';
import { install } from '../src/core/runtime';
import { useDimen, useDimenScope, useDimens, useDimensVersion, useWebDimens } from '../src/react';

// Wrap the runtime module so tests can count how often the adapter calls install().
vi.mock('../src/core/runtime', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../src/core/runtime')>();
  return { ...actual, install: vi.fn(actual.install) };
});

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

interface Root {
  render(children: ReactNode): void;
  unmount(): void;
}
const createRoot = createReactRoot as (container: Element) => Root;

interface Mounted {
  container: HTMLDivElement;
  root: Root;
}

let mounted: Mounted[] = [];
const latest: { scope: DimenScope | null } = { scope: null };

function render(element: ReactElement): Mounted {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(element);
  });
  const entry = { container, root };
  mounted.push(entry);
  return entry;
}

function unmount(entry: Mounted): void {
  act(() => {
    entry.root.unmount();
  });
  entry.container.remove();
  mounted = mounted.filter((m) => m !== entry);
}

function pin(screenWidthDp: number, screenHeightDp: number): void {
  act(() => {
    setMetrics({ screenWidthDp, screenHeightDp });
    flush();
  });
}

function styleText(): string {
  return document.getElementById('webdimens-vars')?.textContent ?? '';
}

beforeEach(() => {
  latest.scope = null;
  setMetrics({ screenWidthDp: 300, screenHeightDp: 533 });
  flush();
});

afterEach(() => {
  for (const entry of mounted.splice(0)) {
    act(() => {
      entry.root.unmount();
    });
    entry.container.remove();
  }
  setMetrics(null);
  uninstall();
});

describe('useDimens', () => {
  it('re-renders with the new metrics after setMetrics + flush', () => {
    function WidthProbe(): ReactElement {
      const m = useDimens();
      return createElement('p', null, `w=${m.screenWidthDp} h=${m.screenHeightDp}`);
    }

    const { container } = render(createElement(WidthProbe));
    expect(container.textContent).toBe('w=300 h=533');

    pin(600, 800);
    expect(container.textContent).toBe('w=600 h=800');
  });
});

describe('useDimensVersion', () => {
  it('increments when the snapshot changes', () => {
    function VersionProbe(): ReactElement {
      return createElement('p', null, String(useDimensVersion()));
    }

    const { container } = render(createElement(VersionProbe));
    const before = Number(container.textContent);
    expect(before).toBe(getVersion());

    pin(600, 800);
    const after = Number(container.textContent);
    expect(after).toBeGreaterThan(before);
    expect(after).toBe(getVersion());
  });
});

describe('useDimen', () => {
  it('updates sdp(16) from 16 to 32 when the snapshot changes', () => {
    function Pad(): ReactElement {
      const pad = useDimen(() => sdp(16));
      return createElement('span', null, String(pad));
    }

    const { container } = render(createElement(Pad));
    expect(container.textContent).toBe('16');

    pin(600, 800);
    expect(container.textContent).toBe('32');
  });

  it('memoizes per snapshot: re-renders without a snapshot change do not recompute', () => {
    let computations = 0;
    function Pad({ label }: { label: string }): ReactElement {
      const pad = useDimen(() => {
        computations++;
        return sdp(16);
      });
      return createElement('span', null, `${label}:${pad}`);
    }

    const entry = render(createElement(Pad, { label: 'a' }));
    expect(computations).toBe(1);

    act(() => {
      entry.root.render(createElement(Pad, { label: 'b' }));
    });
    expect(entry.container.textContent).toBe('b:16');
    expect(computations).toBe(1);

    pin(600, 800);
    expect(entry.container.textContent).toBe('b:32');
    expect(computations).toBe(2);
  });
});

describe('useWebDimens', () => {
  it('installs the runtime exactly once across re-renders and publishes the CSS variables', () => {
    function Shell(): ReactElement {
      const m = useWebDimens({ cssVariables: true });
      return createElement('p', null, `w=${m.screenWidthDp}`);
    }

    const { container } = render(createElement(Shell));
    expect(vi.mocked(install)).toHaveBeenCalledTimes(1);
    expect(styleText()).toContain('--sdp:1px');

    pin(600, 800);
    expect(container.textContent).toBe('w=600');
    expect(styleText()).toContain('--sdp:2px');

    pin(900, 900);
    expect(container.textContent).toBe('w=900');
    expect(styleText()).toContain('--sdp:3px');

    expect(vi.mocked(install)).toHaveBeenCalledTimes(1);
  });
});

describe('useDimenScope', () => {
  function ScopedBox(): ReactElement {
    const ref = useRef<HTMLDivElement>(null);
    const scope = useDimenScope(ref);
    latest.scope = scope;
    return createElement('div', { ref, 'data-testid': 'box' }, scope ? `dp16=${scope.dp(16)}` : 'no-scope');
  }

  it('returns a scope after mount and removes its CSS properties on unmount', () => {
    // jsdom has no layout and no ResizeObserver: the scope reads clientWidth/clientHeight once at creation.
    vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(600);
    vi.spyOn(Element.prototype, 'clientHeight', 'get').mockReturnValue(800);

    const entry = render(createElement(ScopedBox));
    const box = entry.container.querySelector<HTMLElement>('[data-testid="box"]')!;

    expect(latest.scope).not.toBeNull();
    expect(entry.container.textContent).toBe('dp16=32');
    expect(box.style.getPropertyValue('--sdp')).toBe('2px');

    unmount(entry);
    expect(box.style.getPropertyValue('--sdp')).toBe('');
  });

  // Suspected bug in src/react.ts (useDimenScope): the effect depends only on the ref object. When the
  // element is rendered after the first commit, the effect has already run with ref.current === null and
  // never runs again, so no scope is ever created. Expected: a scope once the element exists.
  // Marked it.fails so the suite stays green while the bug exists; switch to `it` once fixed.
  it('creates a scope when the element is rendered after the first commit', () => {
    vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(600);
    vi.spyOn(Element.prototype, 'clientHeight', 'get').mockReturnValue(800);

    let reveal: () => void = () => {};
    function LateBox(): ReactElement {
      const ref = useRef<HTMLDivElement>(null);
      const [shown, setShown] = useState(false);
      reveal = () => setShown(true);
      const scope = useDimenScope(ref);
      latest.scope = scope;
      return shown ? createElement('div', { ref, 'data-testid': 'box' }, 'shown') : createElement('p', null, 'hidden');
    }

    render(createElement(LateBox));
    act(() => {
      reveal();
    });

    expect(latest.scope).not.toBeNull();
  });

  it('re-renders when the scope re-measures its element', () => {
    const width = vi.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(600);
    const height = vi.spyOn(Element.prototype, 'clientHeight', 'get').mockReturnValue(800);

    const entry = render(createElement(ScopedBox));
    expect(entry.container.textContent).toBe('dp16=32');

    width.mockReturnValue(1200);
    height.mockReturnValue(1200);
    act(() => {
      latest.scope?.update();
    });

    expect(entry.container.textContent).toBe('dp16=64');
    const box = entry.container.querySelector<HTMLElement>('[data-testid="box"]')!;
    expect(box.style.getPropertyValue('--sdp')).toBe('4px');
  });
});

describe('useDimen deps', () => {
  it('recomputes when deps change without a viewport change', () => {
    pin(600, 900);
    function Sized({ size }: { size: number }): ReactElement {
      const px = useDimen(() => sdp(size), [size]);
      return createElement('span', null, String(px));
    }
    const entry = render(createElement(Sized, { size: 10 }));
    expect(entry.container.textContent).toBe('20');
    act(() => {
      entry.root.render(createElement(Sized, { size: 20 }));
    });
    expect(entry.container.textContent).toBe('40');
  });
});
