import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  flush,
  flushDeclarative,
  install,
  setMetrics,
  uninstall,
  UiModeType,
  type DimenMetricsInit,
} from '../src/index';

/** Id of the stylesheet the runtime falls back to when `adoptedStyleSheets` is missing (jsdom). */
const SHEET_ID = 'webdimens-declarative';

const root = (): HTMLElement => document.documentElement;

/** Text of the generated declarative stylesheet. */
function sheet(): string {
  return document.getElementById(SHEET_ID)?.textContent ?? '';
}

/** Number of occurrences of `needle` in `text`. */
const count = (text: string, needle: string): number => text.split(needle).length - 1;

/** Pins a deterministic snapshot. Default: a 600x900 phone in portrait, normal mode, single window. */
function pin(overrides: Partial<DimenMetricsInit> = {}): void {
  setMetrics({
    screenWidthDp: 600,
    screenHeightDp: 900,
    density: 1,
    fontScale: 1,
    uiModeType: UiModeType.NORMAL,
    isInMultiWindowMode: false,
    ...overrides,
  });
}

/** Errors passed to console.error that are webdimens parse errors (SyntaxError). */
function loggedErrors(spy: { mock: { calls: unknown[][] } }): Error[] {
  return spy.mock.calls.map(([e]) => e).filter((e): e is SyntaxError => e instanceof SyntaxError);
}

afterEach(() => {
  setMetrics(null);
  uninstall();
  document.body.innerHTML = '';
  vi.restoreAllMocks();
});

describe('declarative runtime: classes and data-dimen already in the document', () => {
  it('compiles dimension classes and data-dimen attributes present at install()', () => {
    document.body.innerHTML = `
      <div class="p:16sdp">a</div>
      <div class="fs@tv:28ssp" data-dimen="margin: 8sdp 16sdp"></div>`;
    pin();
    install();
    const css = sheet();
    expect(css).toContain(String.raw`.p\:16sdp{padding:calc(16 * var(--sdp))}`);
    expect(css).toContain(String.raw`:root[data-ad-mode="tv"] .fs\@tv\:28ssp{font-size:calc(28 * var(--ssp))}`);
    expect(css).toContain('[data-dimen="margin: 8sdp 16sdp"]{margin:calc(8 * var(--sdp)) calc(16 * var(--sdp))}');
  });

  it('compiles data-dimen conditions into media rules around the attribute selector', () => {
    const value = 'padding: 8sdp 16sdp; font-size@landscape: 18ssp';
    document.body.innerHTML = `<div data-dimen="${value}"></div>`;
    pin();
    install();
    const css = sheet();
    expect(css).toContain(`[data-dimen="${value}"]{padding:calc(8 * var(--sdp)) calc(16 * var(--sdp))}`);
    expect(css).toContain(
      `@media (orientation: landscape){[data-dimen="${value}"]{font-size:calc(18 * var(--ssp))}}`,
    );
  });

  it('ignores classes that are not dimension declarations, without logging', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    document.body.innerHTML =
      '<div class="card btn primary hover:bg-blue-500 md:flex sm:p-4 p:16xyz p@bogus:8sdp"></div>';
    pin();
    install();
    const css = sheet();
    expect(css).not.toMatch(/\.(card|btn|primary)\b/);
    expect(css).not.toContain('bg-blue');
    expect(css).not.toContain('16xyz');
    expect(css).not.toContain('bogus');
    expect(error).not.toHaveBeenCalled();
  });

  it('sorts the generated rules by Android priority, whatever the discovery order', () => {
    document.body.innerHTML = `
      <p class="fs@tv:28ssp"></p>
      <p class="fs@landscape:18ssp"></p>
      <p class="fs:14ssp"></p>`;
    pin({ screenWidthDp: 900, screenHeightDp: 600 });
    install();
    const css = sheet();
    const plain = css.indexOf(String.raw`.fs\:14ssp{`);
    const landscape = css.indexOf('@media (orientation: landscape)');
    const tv = css.indexOf(':root[data-ad-mode="tv"]');
    expect(plain).toBeGreaterThan(-1);
    expect(landscape).toBeGreaterThan(plain);
    expect(tv).toBeGreaterThan(landscape);
  });
});

describe('declarative runtime: elements added or changed after install()', () => {
  it('compiles appended elements only after flushDeclarative()', () => {
    pin();
    install();
    const card = document.createElement('article');
    card.className = 'm:8sdp_16sdp';
    document.body.append(card);
    expect(sheet()).not.toContain(String.raw`.m\:8sdp_16sdp{`);
    flushDeclarative();
    expect(sheet()).toContain(
      String.raw`.m\:8sdp_16sdp{margin:calc(8 * var(--sdp)) calc(16 * var(--sdp))}`,
    );
  });

  it('compiles appended elements on the next frame without flushDeclarative()', async () => {
    pin();
    install();
    const card = document.createElement('article');
    card.className = 'p:12sdp';
    document.body.append(card);
    await vi.waitFor(() => expect(sheet()).toContain(String.raw`.p\:12sdp{padding:calc(12 * var(--sdp))}`));
  });

  it('compiles the descendants of an appended subtree', () => {
    pin();
    install();
    const list = document.createElement('ul');
    list.innerHTML = '<li class="gap@landscape:12sdp">one</li><li class="fs:14ssp">two</li>';
    document.body.append(list);
    flushDeclarative();
    const css = sheet();
    expect(css).toContain(
      `@media (orientation: landscape){${String.raw`.gap\@landscape\:12sdp{gap:calc(12 * var(--sdp))}`}}`,
    );
    expect(css).toContain(String.raw`.fs\:14ssp{font-size:calc(14 * var(--ssp))}`);
  });

  it('keeps the rules of earlier elements when new classes arrive', () => {
    document.body.innerHTML = '<p class="p:16sdp"></p>';
    pin();
    install();
    document.body.insertAdjacentHTML('beforeend', '<p class="m:4sdp"></p>');
    flushDeclarative();
    expect(sheet()).toContain(String.raw`.p\:16sdp{padding:calc(16 * var(--sdp))}`);
    expect(sheet()).toContain(String.raw`.m\:4sdp{margin:calc(4 * var(--sdp))}`);
  });

  it('recompiles when the class or data-dimen of an existing element changes', () => {
    document.body.innerHTML = '<p class="fs:14ssp">hi</p>';
    pin();
    install();
    const p = document.querySelector('p')!;
    expect(sheet()).toContain(String.raw`.fs\:14ssp{font-size:calc(14 * var(--ssp))}`);

    p.className = 'fs:20ssp';
    flushDeclarative();
    expect(sheet()).toContain(String.raw`.fs\:20ssp{font-size:calc(20 * var(--ssp))}`);

    p.classList.add('m:4sdp');
    flushDeclarative();
    expect(sheet()).toContain(String.raw`.m\:4sdp{margin:calc(4 * var(--sdp))}`);

    p.setAttribute('data-dimen', 'padding: 4sdp');
    flushDeclarative();
    expect(sheet()).toContain('[data-dimen="padding: 4sdp"]{padding:calc(4 * var(--sdp))}');
  });

  it('compiles each unique class and data-dimen value once (no duplicate rules)', () => {
    document.body.innerHTML = `
      <i class="p:16sdp"></i>
      <i class="p:16sdp"></i>
      <i data-dimen="padding: 8sdp"></i>
      <i data-dimen="padding: 8sdp"></i>`;
    pin();
    install();
    const late = document.createElement('i');
    late.className = 'p:16sdp';
    document.body.append(late);
    flushDeclarative();
    expect(count(sheet(), String.raw`.p\:16sdp{`)).toBe(1);
    expect(count(sheet(), '[data-dimen="padding: 8sdp"]{')).toBe(1);
  });
});

describe('declarative runtime: <html> condition attributes', () => {
  it('reflects the pinned UI mode, orientation and multi-window state', () => {
    pin({ screenWidthDp: 600, screenHeightDp: 900, uiModeType: UiModeType.TELEVISION, isInMultiWindowMode: true });
    install();
    expect(root().getAttribute('data-ad-mode')).toBe('tv');
    expect(root().getAttribute('data-ad-orientation')).toBe('portrait');
    expect(root().hasAttribute('data-ad-multi-window')).toBe(true);
  });

  it('updates after setMetrics() + flush()', () => {
    pin({ screenWidthDp: 600, screenHeightDp: 900 });
    install();
    expect(root().getAttribute('data-ad-mode')).toBe('normal');
    expect(root().getAttribute('data-ad-orientation')).toBe('portrait');
    expect(root().hasAttribute('data-ad-multi-window')).toBe(false);

    pin({ screenWidthDp: 900, screenHeightDp: 600, uiModeType: UiModeType.TELEVISION, isInMultiWindowMode: true });
    flush();
    expect(root().getAttribute('data-ad-mode')).toBe('tv');
    expect(root().getAttribute('data-ad-orientation')).toBe('landscape');
    expect(root().hasAttribute('data-ad-multi-window')).toBe(true);

    pin({ screenWidthDp: 900, screenHeightDp: 600, uiModeType: UiModeType.NORMAL, isInMultiWindowMode: false });
    flush();
    expect(root().getAttribute('data-ad-mode')).toBe('normal');
    expect(root().hasAttribute('data-ad-multi-window')).toBe(false);
  });

  it.each([
    [UiModeType.NORMAL, 'normal'],
    [UiModeType.TELEVISION, 'tv'],
    [UiModeType.WATCH, 'watch'],
    [UiModeType.FOLD_OPEN, 'fold-open'],
  ])('writes the condition name of UI mode %s as "%s"', (mode, attribute) => {
    pin({ uiModeType: mode });
    install();
    expect(root().getAttribute('data-ad-mode')).toBe(attribute);
  });
});

describe('declarative runtime: <style data-webdimens>', () => {
  it('compiles unit literals in place in existing blocks, leaving plain styles alone', () => {
    document.body.innerHTML =
      '<style data-webdimens>.card{padding:8sdp 16sdp;font-size:14ssp;color:red}</style>' +
      '<style>.plain{padding:8sdp}</style>';
    pin();
    install();
    const compiled = document.body.querySelector('style[data-webdimens]')!;
    expect(compiled.textContent).toBe(
      '.card{padding:calc(8 * var(--sdp)) calc(16 * var(--sdp));font-size:calc(14 * var(--ssp));color:red}',
    );
    expect(document.body.querySelector('style:not([data-webdimens])')!.textContent).toBe('.plain{padding:8sdp}');
  });

  it('compiles an appended block exactly once, even across repeated flushes', () => {
    pin();
    install();
    const block = document.createElement('style');
    block.setAttribute('data-webdimens', '');
    block.textContent = '.x{margin:4sdp}';
    document.body.append(block);
    flushDeclarative();
    expect(block.textContent).toBe('.x{margin:calc(4 * var(--sdp))}');
    flushDeclarative();
    expect(block.textContent).toBe('.x{margin:calc(4 * var(--sdp))}');
  });
});

describe('declarative runtime: options and teardown', () => {
  it('install({ declarative: false }) creates no declarative sheet and compiles nothing', () => {
    document.body.innerHTML =
      '<p class="p:16sdp" data-dimen="margin: 8sdp"></p><style data-webdimens>.x{padding:8sdp}</style>';
    pin();
    install({ declarative: false });
    document.body.insertAdjacentHTML('beforeend', '<p class="m:4sdp"></p>');
    flushDeclarative();
    expect(document.getElementById(SHEET_ID)).toBeNull();
    expect(document.body.querySelector('style[data-webdimens]')!.textContent).toBe('.x{padding:8sdp}');
    expect(root().hasAttribute('data-ad-mode')).toBe(false);
    expect(root().hasAttribute('data-ad-orientation')).toBe(false);
  });

  it('a later install() turns the declarative runtime on', () => {
    document.body.innerHTML = '<p class="p:16sdp"></p>';
    pin();
    install({ declarative: false });
    install();
    expect(sheet()).toContain(String.raw`.p\:16sdp{padding:calc(16 * var(--sdp))}`);
  });

  it('applies cssNonce to the generated stylesheet element', () => {
    document.body.innerHTML = '<p class="p:16sdp"></p>';
    pin();
    install({ cssNonce: 'abc123' });
    expect((document.getElementById(SHEET_ID) as HTMLStyleElement).nonce).toBe('abc123');
  });

  it('uninstall() removes the stylesheet and <html> attributes, and stops observing', () => {
    document.body.innerHTML = '<p class="p:16sdp"></p>';
    pin({ uiModeType: UiModeType.TELEVISION, isInMultiWindowMode: true });
    install();
    expect(document.getElementById(SHEET_ID)).not.toBeNull();
    expect(root().getAttribute('data-ad-mode')).toBe('tv');

    uninstall();
    expect(document.getElementById(SHEET_ID)).toBeNull();
    expect(root().hasAttribute('data-ad-mode')).toBe(false);
    expect(root().hasAttribute('data-ad-orientation')).toBe(false);
    expect(root().hasAttribute('data-ad-multi-window')).toBe(false);

    const late = document.createElement('p');
    late.className = 'm:4sdp';
    document.body.append(late);
    expect(() => flushDeclarative()).not.toThrow();
    expect(document.getElementById(SHEET_ID)).toBeNull();
  });

  it('a reinstall after uninstall() rebuilds the sheet from the current document', () => {
    document.body.innerHTML = '<p class="p:16sdp"></p>';
    pin();
    install();
    uninstall();
    install();
    expect(count(sheet(), String.raw`.p\:16sdp{`)).toBe(1);
  });
});

describe('declarative runtime: malformed data-dimen', () => {
  it.each([
    ['a declaration without a colon', 'padding 8sdp', 'missing ":"'],
    ['an unknown property', 'Padding: 8sdp', 'unknown property "Padding"'],
    ['an unknown condition', 'padding@bogus: 8sdp', 'unknown condition'],
  ])('%s is logged with console.error, does not throw, and keeps compiling', (_label, value, message) => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    document.body.innerHTML = `<p data-dimen="${value}"></p><b class="p:16sdp"></b>`;
    pin();
    expect(() => install()).not.toThrow();

    expect(loggedErrors(error)).toHaveLength(1);
    expect(loggedErrors(error)[0]!.message).toContain(message);
    expect(sheet()).toContain(String.raw`.p\:16sdp{padding:calc(16 * var(--sdp))}`);

    // The same bad value on a later element is not reported again, and flushing never throws.
    document.body.insertAdjacentHTML('beforeend', `<q data-dimen="${value}"></q>`);
    expect(() => flushDeclarative()).not.toThrow();
    expect(loggedErrors(error)).toHaveLength(1);
  });
});

describe('declarative runtime: suspected bugs', () => {
  // compileDimenClass() calls hasDimenLiteral() → dimenCss() → literalToCss(), which throws for
  // JS-only tokens (Px, and sp/em with an inverter). That throw is outside the try/catch in
  // compileDimenClass(), so one such class aborts the whole scan instead of being skipped or logged
  // like a malformed data-dimen.
  it('regression: install() throws on a class with a JS-only token and skips the rest of the page', () => {
    document.body.innerHTML = '<p class="fs:14sspLw">a</p><p class="m:4sdp">b</p>';
    pin();
    expect(() => install()).not.toThrow();
    expect(sheet()).toContain(String.raw`.m\:4sdp{margin:calc(4 * var(--sdp))}`);
  });

  it('regression: flushDeclarative() throws on a class with a JS-only token added later', () => {
    document.body.innerHTML = '<p class="m:4sdp">a</p>';
    pin();
    install();
    document.body.insertAdjacentHTML('beforeend', '<p class="fs:14sspPx">b</p>');
    expect(() => flushDeclarative()).not.toThrow();
  });
});
