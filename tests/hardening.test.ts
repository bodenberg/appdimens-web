/** Regression tests for the adversarial review of the declarative runtime. */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  compileCssText,
  compileDimenAttribute,
  compileDimenClass,
  dimenClassesToCss,
  dimenCss,
  flush,
  flushDeclarative,
  install,
  modifierCss,
  setMetrics,
  uninstall,
} from '../src/index';

describe('CSS injection through class / attribute text', () => {
  it('rejects classes whose value could close the rule', () => {
    expect(compileDimenClass('p:16sdp)}body{background:red')).toBeNull();
    expect(compileDimenClass('p:16sdp;color:red')).toBeNull();
    expect(compileDimenClass('p:16sdp/**/')).toBeNull();
    expect(compileDimenClass('p:16sdp\\')).toBeNull();
    expect(dimenClassesToCss(['p:16sdp</style><script>'])).toBe('');
  });

  it('rejects unsafe data-dimen values but keeps ordinary escapes', () => {
    expect(() => compileDimenAttribute('padding: 8px}body{background:red')).toThrow(SyntaxError);
    expect(() => compileDimenAttribute('padding: 8sdp\\')).toThrow(SyntaxError);
    expect(() => compileDimenAttribute('padding:')).toThrow(/empty value/);
    expect(compileDimenAttribute(String.raw`content: "\201C"`)[0]!.css).toContain(String.raw`{content:"\201C"}`);
  });

  it('escapes line breaks in the attribute selector', () => {
    const css = compileDimenAttribute('padding: 8sdp;\nmargin: 4sdp')[0]!.css;
    expect(css).not.toMatch(/\n/);
    expect(css).toContain(String.raw`\a `);
  });
});

describe('literal recognition', () => {
  it('leaves url() and quoted strings alone', () => {
    expect(dimenCss('url(/img/16sdp) 16sdp')).toBe('url(/img/16sdp) calc(16 * var(--sdp))');
    expect(compileCssText(`.a{background:url("16sdp.png");padding:8sdp}`)).toBe(
      `.a{background:url("16sdp.png");padding:calc(8 * var(--sdp))}`,
    );
    expect(compileCssText(`.a::before{content:'16sdp'}`)).toBe(`.a::before{content:'16sdp'}`);
  });

  it('converts literals next to * without spaces', () => {
    expect(dimenCss('calc(8sdp*2)')).toBe('calc(calc(8 * var(--sdp))*2)');
    expect(dimenCss('calc(2*8sdp)')).toBe('calc(2*calc(8 * var(--sdp)))');
  });
});

describe('modifier classes on <html>', () => {
  it('carry enough specificity to beat the :root:root token sheet', () => {
    const css = modifierCss([{ id: 'power', prefix: 'pw' }]);
    for (const cls of ['ad-power', 'ad-a', 'ad-i', 'ad-ia']) expect(css).toContain(`.${cls},:root:root.${cls}{`);
  });
});

describe('DOM runtime robustness', () => {
  beforeEach(() => {
    setMetrics({ screenWidthDp: 600, screenHeightDp: 900 });
    document.body.innerHTML = '';
  });
  afterEach(() => {
    uninstall();
    setMetrics(null);
  });

  const sheetText = (): string => document.getElementById('webdimens-declarative')?.textContent ?? '';

  it('one JS-only class does not stop the rest of the scan', () => {
    document.body.innerHTML = '<p class="fs:14sspLw m:4sdp"></p><p class="r:12sdp"></p>';
    expect(() => install()).not.toThrow();
    expect(sheetText()).toContain('margin:calc(4 * var(--sdp))');
    expect(sheetText()).toContain('border-radius:calc(12 * var(--sdp))');
  });

  it('recompiles a <style data-webdimens> block edited after the first pass', async () => {
    install();
    const style = document.createElement('style');
    style.setAttribute('data-webdimens', '');
    style.textContent = '.card{padding:8sdp}';
    document.head.appendChild(style);
    flushDeclarative();
    expect(style.textContent).toBe('.card{padding:calc(8 * var(--sdp))}');
    style.textContent = '.card{padding:16sdp}';
    await new Promise((r) => setTimeout(r, 0)); // MutationObserver callbacks are microtasks
    expect(style.textContent).toBe('.card{padding:calc(16 * var(--sdp))}');
    flush();
  });
});
