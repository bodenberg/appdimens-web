import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  configure,
  createDimenScope,
  cssDeclarations,
  DimenMetrics,
  flush,
  getMetrics,
  getVersion,
  install,
  refresh,
  sdp,
  setMetrics,
  subscribe,
  UiModeType,
  uninstall,
} from '../src/index';
import { pwsdp } from '../src/power';

function resizeTo(width: number, height: number): void {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
  Object.defineProperty(window, 'innerHeight', { configurable: true, value: height });
  window.dispatchEvent(new Event('resize'));
}

function cssText(): string {
  const el = document.getElementById('webdimens-vars');
  if (el) return el.textContent ?? '';
  const sheets = (document as Document & { adoptedStyleSheets?: CSSStyleSheet[] }).adoptedStyleSheets ?? [];
  return sheets.map((s) => Array.from(s.cssRules).map((r) => r.cssText).join('')).join('');
}

beforeEach(() => {
  uninstall();
  setMetrics(null);
  Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 1 });
  resizeTo(360, 640);
});

afterEach(() => {
  uninstall();
  setMetrics(null);
});

describe('live viewport tracking', () => {
  it('reads the window and re-resolves synchronously after a resize event', () => {
    configure({ multiWindow: false, fontScale: 1 });
    expect(sdp(30)).toBeCloseTo(36);
    resizeTo(720, 1280);
    expect(sdp(30)).toBeCloseTo(72);
    expect(getMetrics().isPortrait).toBe(true);
    resizeTo(1280, 720);
    expect(getMetrics().isLandscape).toBe(true);
  });

  it('bumps the version only when the snapshot really changes', () => {
    const v0 = getVersion();
    resizeTo(360, 640);
    expect(getVersion()).toBe(v0);
    resizeTo(500, 640);
    expect(getVersion()).toBe(v0 + 1);
  });

  it('notifies subscribers once per flush with the new snapshot', () => {
    const seen: number[] = [];
    const off = subscribe((m) => seen.push(m.screenWidthDp));
    resizeTo(400, 640);
    resizeTo(420, 640);
    flush();
    expect(seen).toEqual([420]);
    off();
    resizeTo(500, 640);
    flush();
    expect(seen).toEqual([420]);
  });

  it('picks up devicePixelRatio', () => {
    Object.defineProperty(window, 'devicePixelRatio', { configurable: true, value: 3 });
    refresh();
    expect(getMetrics().density).toBe(3);
  });
});

describe('configure', () => {
  it('forces ui mode, multi-window and font scale', () => {
    configure({ uiModeType: UiModeType.TELEVISION, multiWindow: true, fontScale: 1.5 });
    const m = getMetrics();
    expect(m.uiModeType).toBe(UiModeType.TELEVISION);
    expect(m.isInMultiWindowMode).toBe(true);
    expect(m.fontScale).toBe(1.5);
  });

  it('accepts resolver functions and a custom measure', () => {
    configure({
      measure: () => ({ width: 1000, height: 500 }),
      uiModeType: ({ width }) => (width >= 960 ? UiModeType.TELEVISION : UiModeType.NORMAL),
      multiWindow: () => false,
    });
    expect(getMetrics().screenWidthDp).toBe(1000);
    expect(getMetrics().uiModeType).toBe(UiModeType.TELEVISION);
  });

  it('setMetrics pins a snapshot and null resumes tracking', () => {
    setMetrics(new DimenMetrics({ screenWidthDp: 600, screenHeightDp: 900 }));
    resizeTo(300, 300);
    expect(sdp(10)).toBeCloseTo(20);
    setMetrics(null);
    expect(sdp(10)).toBeCloseTo(10);
  });
});

describe('CSS custom properties', () => {
  it('install() publishes tokens for every registered strategy and updates them on resize', () => {
    void pwsdp; // registers the power strategy
    install({ fontScale: 1, multiWindow: false });
    let css = cssText();
    expect(css).toContain('--sdp:1.2px');
    expect(css).toContain('--hdp:2.1333px');
    expect(css).toContain('--ssp:1.2px');
    expect(css).toContain('--pwsdp:');
    expect(css).toContain('--sdpPh:');
    expect(css).toContain('--ad-sw:360px');
    resizeTo(600, 900);
    flush();
    css = cssText();
    expect(css).toContain('--sdp:2px');
    expect(css).toContain('--ad-landscape:0');
  });

  it('cssVariables:false removes them', () => {
    install();
    expect(cssText()).toContain('--sdp');
    configure({ cssVariables: false });
    flush();
    expect(cssText()).not.toContain('--sdp');
  });

  it('cssDeclarations works for arbitrary snapshots', () => {
    const decl = cssDeclarations(new DimenMetrics({ screenWidthDp: 900, screenHeightDp: 1200, fontScale: 2 }));
    expect(decl).toContain('--sdp:3px;');
    expect(decl).toContain('--ssp:6px;');
    expect(decl).toContain('--sem:3px;');
  });
});

describe('scoped snapshots', () => {
  it('writes element-local tokens from the element box and cleans up', () => {
    const el = document.createElement('div');
    Object.defineProperty(el, 'clientWidth', { configurable: true, value: 150 });
    Object.defineProperty(el, 'clientHeight', { configurable: true, value: 300 });
    document.body.appendChild(el);
    const onChange = vi.fn();
    const scope = createDimenScope(el, { onChange });
    expect(scope.metrics.smallestWidthDp).toBe(150);
    expect(scope.dp(20)).toBeCloseTo(10);
    expect(el.style.getPropertyValue('--sdp')).toBe('0.5px');
    expect(onChange).toHaveBeenCalledTimes(1);
    Object.defineProperty(el, 'clientWidth', { configurable: true, value: 600 });
    Object.defineProperty(el, 'clientHeight', { configurable: true, value: 600 });
    scope.update();
    expect(el.style.getPropertyValue('--sdp')).toBe('2px');
    scope.disconnect();
    expect(el.style.getPropertyValue('--sdp')).toBe('');
    el.remove();
  });
});

describe('server / non-DOM safety', () => {
  it('DimenMetrics.DEFAULT is the 300×533 reference and is frozen', () => {
    const d = DimenMetrics.DEFAULT;
    expect(d.scale).toBe(1);
    expect(Object.isFrozen(d)).toBe(true);
  });

  it('sanitizes invalid inputs', () => {
    const m = new DimenMetrics({ screenWidthDp: Number.NaN, screenHeightDp: -5, density: 0, fontScale: Number.POSITIVE_INFINITY });
    expect(m.screenWidthDp).toBe(0);
    expect(m.density).toBe(1);
    expect(m.fontScale).toBe(1);
    expect(m.smallestWidthDp).toBe(300);
    expect(Number.isFinite(m.defaultScaledAspectRatioMultiplier)).toBe(true);
  });
});
