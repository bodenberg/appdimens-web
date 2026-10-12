import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dimen, dimenCss, dimens, dimensPx, parseDimenLiteral, parseToken, setMetrics, STRATEGY_PREFIXES } from '../src/index';
import '../src/power';

beforeEach(() => setMetrics({ screenWidthDp: 600, screenHeightDp: 900, density: 2, fontScale: 1.5 }));
afterEach(() => setMetrics(null));

describe('parseToken', () => {
  it.each(Object.entries(STRATEGY_PREFIXES))('prefix "%s" (%s) parses sdp / hspa / wemLhia', (prefix, strategy) => {
    expect(parseToken(`${prefix}sdp`)).toMatchObject({ strategy, axis: 's', kind: 'dp', flags: '', css: true });
    expect(parseToken(`${prefix}hspa`)).toMatchObject({ strategy, axis: 'h', kind: 'sp', flags: 'a', css: true });
    expect(parseToken(`${prefix}wemLhia`)).toMatchObject({ strategy, axis: 'w', kind: 'em', inverter: 'Lh', flags: 'ia', css: false });
  });

  it('slots match the generated layout (variant * 4 + flags)', () => {
    expect(parseToken('sdp')!.slot).toBe(0);
    expect(parseToken('hdpa')!.slot).toBe(5);
    expect(parseToken('sdpPh')!.slot).toBe(12);
    expect(parseToken('wdpPhia')!.slot).toBe(43);
  });

  it('rejects inverters that do not exist on an axis and non-tokens', () => {
    for (const t of ['hdpPh', 'hdpLh', 'wdpPw', 'wdpLw', 'px', 'em', 'rem', 'vh', 'dvh', 'sdpx', 'sdpai', 'Sdp']) {
      expect(parseToken(t), t).toBeNull();
    }
  });

  it('Px tokens are JS-only', () => {
    expect(parseToken('sdpPx')).toMatchObject({ px: true, css: false });
    expect(parseToken('pwhdpLwiaPx')).toMatchObject({ strategy: 'power', inverter: 'Lw', flags: 'ia', px: true });
  });

  it('parseDimenLiteral handles signs and decimals', () => {
    expect(parseDimenLiteral('-8sdp')!.value).toBe(-8);
    expect(parseDimenLiteral('.5sdp')!.value).toBe(0.5);
    expect(parseDimenLiteral('1.25ssp')!.value).toBe(1.25);
    expect(parseDimenLiteral('16px')).toBeNull();
    expect(parseDimenLiteral('1e3sdp')).toBeNull();
  });
});

describe('dimen()', () => {
  it('resolves every kind', () => {
    expect(dimen('16sdp')).toBeCloseTo(32);
    expect(dimen('16hdp')).toBeCloseTo(48);
    expect(dimen('10ssp')).toBeCloseTo(30); // × font scale 1.5
    expect(dimen('10sem')).toBeCloseTo(20);
    expect(dimen('2sdpPx')).toBeCloseTo(8); // × density 2
    expect(dimen('10sspPx')).toBeCloseTo(60);
    expect(dimen('10pwsdp')).toBeCloseTo(10 * Math.pow(2, 0.75));
  });

  it('passes numbers and px through and rejects garbage', () => {
    expect(dimen(12)).toBe(12);
    expect(dimen('12px')).toBe(12);
    expect(dimen(' 7 ')).toBe(7);
    expect(() => dimen('12vh')).toThrow(TypeError);
    expect(() => dimen('banana')).toThrow(TypeError);
  });

  it('names the module to import when a strategy is not registered', () => {
    expect(() => dimen('10logsdp')).toThrow(/webdimens\/logarithmic/);
  });
});

describe('dimenCss()', () => {
  it('compiles multi-values and literals inside functions', () => {
    expect(dimenCss('8sdp 16sdp')).toBe('calc(8 * var(--sdp)) calc(16 * var(--sdp))');
    expect(dimenCss('max(16sdp, 10px)')).toBe('max(calc(16 * var(--sdp)), 10px)');
    expect(dimenCss('calc(100% - 2sdp)')).toBe('calc(100% - calc(2 * var(--sdp)))');
    expect(dimenCss('10px 50% 1rem auto')).toBe('10px 50% 1rem auto');
  });

  it('throws for JS-only tokens', () => {
    expect(() => dimenCss('2sdpPx')).toThrow(/JS-only/);
    expect(() => dimenCss('2sspLw')).toThrow(/JS-only/);
  });

  it('warns once when the strategy is not registered (browser)', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(dimenCss('3fsdp')).toBe('calc(3 * var(--fsdp))');
    dimenCss('4fhdp');
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0]![0])).toContain("webdimens/fluid");
  });
});

describe('style objects', () => {
  it('dimens() → responsive CSS strings, numbers untouched', () => {
    expect(dimens({ padding: '8sdp 16sdp', opacity: 0.5, color: 'red' })).toEqual({
      padding: 'calc(8 * var(--sdp)) calc(16 * var(--sdp))',
      opacity: 0.5,
      color: 'red',
    });
  });

  it('dimensPx() → numbers for single literals, px strings for multi-values', () => {
    expect(dimensPx({ width: '120wdp', margin: '8sdp 4sdp', color: 'red', z: 3, n: null })).toEqual({
      width: 240,
      margin: '16px 8px',
      color: 'red',
      z: 3,
    });
  });
});
