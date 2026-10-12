import { afterEach, describe, expect, it, vi } from 'vitest';
import * as index from '../src/index';
import {
  MODE_CONDITIONS,
  PROPERTY_ALIASES,
  compileDimenAttribute,
  compileDimenClass,
  cssEscape,
  dimenClassesToCss,
  joinRules,
  modeAttribute,
  modifierCss,
  parseConditions,
} from '../src/core/declarative';
import { UiModeType } from '../src/core/enums';

/** CSS of one class, or `undefined` when the class is not compiled. */
const css = (cls: string): string | undefined => compileDimenClass(cls)?.css;

/** Declarations of one `.ad-*` block produced by `modifierCss`, e.g. `--sdp:var(--sdpa)`. */
function declarations(sheet: string, selector: string): string[] {
  const line = sheet.split('\n').find((l) => l.startsWith(`${selector}{`) || l.startsWith(`${selector},`));
  if (!line) throw new Error(`no block for ${selector}`);
  return line.slice(line.indexOf('{') + 1, -1).split(';').filter(Boolean);
}

describe('compileDimenClass: aliases and property names', () => {
  it.each([
    ['p', 'padding'], ['pt', 'padding-top'], ['pr', 'padding-right'], ['pb', 'padding-bottom'], ['pl', 'padding-left'],
    ['px', 'padding-inline'], ['py', 'padding-block'], ['ps', 'padding-inline-start'], ['pe', 'padding-inline-end'],
    ['m', 'margin'], ['mt', 'margin-top'], ['mr', 'margin-right'], ['mb', 'margin-bottom'], ['ml', 'margin-left'],
    ['mx', 'margin-inline'], ['my', 'margin-block'], ['ms', 'margin-inline-start'], ['me', 'margin-inline-end'],
    ['w', 'width'], ['h', 'height'], ['minw', 'min-width'], ['minh', 'min-height'], ['maxw', 'max-width'], ['maxh', 'max-height'],
    ['fs', 'font-size'], ['lh', 'line-height'], ['ls', 'letter-spacing'],
    ['gap', 'gap'], ['gapx', 'column-gap'], ['gapy', 'row-gap'],
    ['r', 'border-radius'], ['radius', 'border-radius'], ['bw', 'border-width'], ['ow', 'outline-width'],
    ['basis', 'flex-basis'], ['indent', 'text-indent'],
  ])('%s expands to the %s property', (alias, property) => {
    expect(PROPERTY_ALIASES[alias]).toEqual([property]);
    expect(css(`${alias}:8sdp`)).toBe(`.${alias}\\:8sdp{${property}:calc(8 * var(--sdp))}`);
  });

  it('size writes width and height', () => {
    expect(css('size:8sdp')).toBe(String.raw`.size\:8sdp{width:calc(8 * var(--sdp));height:calc(8 * var(--sdp))}`);
    expect(PROPERTY_ALIASES.size).toEqual(['width', 'height']);
  });

  it('accepts full, hyphenated CSS property names', () => {
    expect(css('border-top-width:2sdp')).toBe(String.raw`.border-top-width\:2sdp{border-top-width:calc(2 * var(--sdp))}`);
    expect(css('letter-spacing:1ssp')).toBe(String.raw`.letter-spacing\:1ssp{letter-spacing:calc(1 * var(--ssp))}`);
  });

  it('publishes custom properties', () => {
    expect(css('--gap:12sdp')).toBe(String.raw`.--gap\:12sdp{--gap:calc(12 * var(--sdp))}`);
    expect(css('--card-gap:12sdp')).toBe(String.raw`.--card-gap\:12sdp{--card-gap:calc(12 * var(--sdp))}`);
  });

  it('treats "_" as a space between several values', () => {
    expect(css('m:8sdp_16sdp')).toBe(String.raw`.m\:8sdp_16sdp{margin:calc(8 * var(--sdp)) calc(16 * var(--sdp))}`);
    expect(css('p:8sdp_16ssp_4hdpLw')).toBe(
      String.raw`.p\:8sdp_16ssp_4hdpLw{padding:calc(8 * var(--sdp)) calc(16 * var(--ssp)) calc(4 * var(--hdpLw))}`,
    );
  });

  it('turns a trailing "!" into !important', () => {
    expect(css('p:16sdp!')).toBe(String.raw`.p\:16sdp\!{padding:calc(16 * var(--sdp)) !important}`);
    expect(css('p:16sdp')).not.toContain('!important');
  });

  it('accepts negative and fractional literals', () => {
    expect(css('m:-8sdp')).toBe(String.raw`.m\:-8sdp{margin:calc(-8 * var(--sdp))}`);
    expect(css('p:.5sdp')).toBe(String.raw`.p\:\.5sdp{padding:calc(0.5 * var(--sdp))}`);
  });

  it('keeps strategy prefixes, inverters and flags in the custom property name', () => {
    expect(css('p:8pwsdp')).toBe(String.raw`.p\:8pwsdp{padding:calc(8 * var(--pwsdp))}`);
    expect(css('p:8sdpPhia')).toBe(String.raw`.p\:8sdpPhia{padding:calc(8 * var(--sdpPhia))}`);
    expect(css('p:1sem')).toBe(String.raw`.p\:1sem{padding:calc(1 * var(--sem))}`);
  });
});

describe('compileDimenClass: conditions and their CSS', () => {
  it('orientation becomes an @media orientation query', () => {
    expect(css('p@landscape:24sdp')).toBe(
      String.raw`@media (orientation: landscape){.p\@landscape\:24sdp{padding:calc(24 * var(--sdp))}}`,
    );
    expect(css('p@portrait:24sdp')).toBe(
      String.raw`@media (orientation: portrait){.p\@portrait\:24sdp{padding:calc(24 * var(--sdp))}}`,
    );
  });

  it('sw600 matches both the smallest width and the height', () => {
    expect(css('p@sw600:32sdp')).toBe(
      String.raw`@media (min-width: 600px) and (min-height: 600px){.p\@sw600\:32sdp{padding:calc(32 * var(--sdp))}}`,
    );
  });

  it('the "dp" suffix of a width qualifier is optional', () => {
    expect(css('p@sw600dp:32sdp')).toBe(
      String.raw`@media (min-width: 600px) and (min-height: 600px){.p\@sw600dp\:32sdp{padding:calc(32 * var(--sdp))}}`,
    );
  });

  it('w600 matches only the width', () => {
    expect(css('p@w600:32sdp')).toBe(
      String.raw`@media (min-width: 600px){.p\@w600\:32sdp{padding:calc(32 * var(--sdp))}}`,
    );
  });

  it('h600 matches only the height', () => {
    expect(css('p@h600:32hdp')).toBe(
      String.raw`@media (min-height: 600px){.p\@h600\:32hdp{padding:calc(32 * var(--hdp))}}`,
    );
  });

  it('accepts fractional thresholds', () => {
    expect(css('p@sw600.5:8sdp')).toContain('@media (min-width: 600.5px) and (min-height: 600.5px){');
  });

  it.each<[UiModeType, string]>([
    [UiModeType.NORMAL, 'normal'],
    [UiModeType.TELEVISION, 'tv'],
    [UiModeType.CAR, 'car'],
    [UiModeType.WATCH, 'watch'],
    [UiModeType.DESK, 'desk'],
    [UiModeType.APPLIANCE, 'appliance'],
    [UiModeType.VR_HEADSET, 'vr'],
    [UiModeType.UNDEFINED, 'undefined'],
    [UiModeType.FOLD_OPEN, 'fold-open'],
    [UiModeType.FOLD_CLOSED, 'fold-closed'],
    [UiModeType.FOLD_HALF_OPENED, 'fold-half'],
    [UiModeType.FLIP_OPEN, 'flip-open'],
    [UiModeType.FLIP_CLOSED, 'flip-closed'],
    [UiModeType.FLIP_HALF_OPENED, 'flip-half'],
  ])('UI mode %s is selected by a :root[data-ad-mode] prefix', (mode, attr) => {
    const name = modeAttribute(mode);
    expect(name).toBe(attr);
    expect(css(`fs@${name}:28ssp`)).toBe(
      `:root[data-ad-mode="${attr}"] .fs\\@${name}\\:28ssp{font-size:calc(28 * var(--ssp))}`,
    );
  });

  it('the "television" alias maps to the same data-ad-mode value as "tv"', () => {
    expect(css('fs@television:28ssp')).toContain(':root[data-ad-mode="tv"] ');
  });

  it('mw and multi-window select :root[data-ad-multi-window] without a media query', () => {
    expect(css('p@mw:8sdp')).toBe(String.raw`:root[data-ad-multi-window] .p\@mw\:8sdp{padding:calc(8 * var(--sdp))}`);
    expect(css('p@multi-window:8sdp')).toBe(
      String.raw`:root[data-ad-multi-window] .p\@multi-window\:8sdp{padding:calc(8 * var(--sdp))}`,
    );
  });

  it('a UI mode combined with a qualifier wraps the :root prefix in @media', () => {
    expect(css('p@tv@sw600:48sdp')).toBe(
      String.raw`@media (min-width: 600px) and (min-height: 600px){:root[data-ad-mode="tv"] .p\@tv\@sw600\:48sdp{padding:calc(48 * var(--sdp))}}`,
    );
  });

  it('orientation with a qualifier emits both queries', () => {
    expect(css('p@landscape@sw600:8sdp')).toBe(
      String.raw`@media (orientation: landscape) and (min-width: 600px) and (min-height: 600px){.p\@landscape\@sw600\:8sdp{padding:calc(8 * var(--sdp))}}`,
    );
  });

  it('the order of conditions in the class does not change the media query', () => {
    expect(css('p@sw600@landscape:8sdp')).toBe(
      String.raw`@media (orientation: landscape) and (min-width: 600px) and (min-height: 600px){.p\@sw600\@landscape\:8sdp{padding:calc(8 * var(--sdp))}}`,
    );
  });

  it('a UI mode with orientation has no width or height query', () => {
    expect(css('p@tv@landscape:8sdp')).toBe(
      String.raw`@media (orientation: landscape){:root[data-ad-mode="tv"] .p\@tv\@landscape\:8sdp{padding:calc(8 * var(--sdp))}}`,
    );
  });

  it('a UI mode with multi-window combines both root attributes', () => {
    expect(css('p@tv@mw:8sdp')).toBe(
      String.raw`:root[data-ad-mode="tv"][data-ad-multi-window] .p\@tv\@mw\:8sdp{padding:calc(8 * var(--sdp))}`,
    );
  });

  it('rejects unknown or malformed conditions', () => {
    expect(compileDimenClass('p@xl:8sdp')).toBeNull();
    expect(compileDimenClass('p@foo:8sdp')).toBeNull();
    expect(compileDimenClass('p@tv@foo:8sdp')).toBeNull();
    expect(compileDimenClass('p@sw:8sdp')).toBeNull();
    expect(compileDimenClass('p@600:8sdp')).toBeNull();
  });
});

describe('parseConditions', () => {
  it('parses orientation, qualifier and mode together', () => {
    expect(parseConditions(['landscape', 'sw600', 'tv'])).toEqual({
      orientation: 'landscape',
      qualifiers: [{ axis: 'sw', value: 600 }],
      mode: 'tv',
    });
  });

  it('parses the three qualifier axes', () => {
    expect(parseConditions(['w600', 'h700'])).toEqual({
      qualifiers: [
        { axis: 'w', value: 600 },
        { axis: 'h', value: 700 },
      ],
    });
  });

  it('sets multiWindow for "mw" and "multi-window"', () => {
    expect(parseConditions(['mw'])).toEqual({ qualifiers: [], multiWindow: true });
    expect(parseConditions(['multi-window'])).toEqual({ qualifiers: [], multiWindow: true });
  });

  it('ignores empty parts and returns no conditions for an empty list', () => {
    expect(parseConditions([])).toEqual({ qualifiers: [] });
    expect(parseConditions(['', ' '])).toEqual({ qualifiers: [] });
  });

  it('returns null for an unknown part', () => {
    expect(parseConditions(['landscape', 'bogus'])).toBeNull();
  });
});

describe('compileDimenClass: rejects anything that is not a dimension class', () => {
  it.each([
    'hover:bg-red-500',
    'md:p-4',
    'md:flex',
    'dark:text-white',
    'lg:w-1/2',
    'sm:grid-cols-3',
    'hover:translate-x-4',
    'text-center',
    'bg:url(a.png)',
    'p:4px',
    'p:12px',
    'p:1.5rem',
    'p:50%',
    'p:10em',
    'p:100vh',
    'p:16zzz',
    'p:2sdpq',
    'p:',
    'p:16sdp:hover',
    'p:16hdpPh',
    'p:16wdpLw',
  ])('%s is ignored', (cls) => {
    expect(compileDimenClass(cls)).toBeNull();
  });

  it.each([
    'Padding:16sdp',
    '1p:16sdp',
    'padding_top:8sdp',
    'p@:16sdp',
  ])('%s is ignored because its property or condition name is invalid', (cls) => {
    expect(compileDimenClass(cls)).toBeNull();
  });

  it('returns null for classes without a colon', () => {
    expect(compileDimenClass('p-4')).toBeNull();
    expect(compileDimenClass('flex')).toBeNull();
  });
});

describe('selector escaping', () => {
  it('escapes the class name as the selector', () => {
    expect(compileDimenClass('p:16sdp')?.css.startsWith(String.raw`.p\:16sdp{`)).toBe(true);
  });

  it('escapes "@" and "!" as well as ":"', () => {
    expect(css('p@tv:16sdp!')).toContain(String.raw`.p\@tv\:16sdp\!{`);
  });

  it('cssEscape uses CSS.escape when the environment provides it', () => {
    expect(typeof CSS.escape).toBe('function');
    expect(cssEscape('-1a')).toBe(String.raw`-\31 a`);
  });
});

describe('cssEscape fallback (no CSS.escape)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('escapes punctuation and a leading digit', () => {
    vi.stubGlobal('CSS', undefined);
    expect(cssEscape('p:16sdp')).toBe(String.raw`p\:16sdp`);
    expect(cssEscape('a@b!')).toBe(String.raw`a\@b\!`);
    expect(cssEscape('1a')).toBe(String.raw`\31 a`);
    expect(cssEscape('a-b_c')).toBe('a-b_c');
  });

  it('regression: fallback cssEscape drops the "-" before a leading digit', () => {
    vi.stubGlobal('CSS', undefined);
    expect(cssEscape('-1a')).toBe(String.raw`-\31 a`);
  });
});

describe('compileDimenAttribute', () => {
  it('compiles each declaration into its own rule on the attribute selector', () => {
    const text = 'padding: 8sdp 16sdp; font-size: 14ssp';
    const selector = `[data-dimen="${text}"]`;
    expect(compileDimenAttribute(text).map((r) => r.css)).toEqual([
      `${selector}{padding:calc(8 * var(--sdp)) calc(16 * var(--sdp))}`,
      `${selector}{font-size:calc(14 * var(--ssp))}`,
    ]);
  });

  it('uses the given selector instead of the attribute selector', () => {
    expect(compileDimenAttribute('padding: 8sdp', '.card')[0]!.css).toBe('.card{padding:calc(8 * var(--sdp))}');
  });

  it('wraps conditioned declarations in the same way as classes', () => {
    const text = 'padding@landscape: 12sdp 24sdp; font-size@tv: 28ssp';
    const [landscape, tv] = compileDimenAttribute(text).map((r) => r.css);
    expect(landscape).toBe(
      `@media (orientation: landscape){[data-dimen="${text}"]{padding:calc(12 * var(--sdp)) calc(24 * var(--sdp))}}`,
    );
    expect(tv).toBe(`:root[data-ad-mode="tv"] [data-dimen="${text}"]{font-size:calc(28 * var(--ssp))}`);
  });

  it('passes plain CSS values through unchanged', () => {
    expect(
      compileDimenAttribute('font-family: Inter, sans-serif; color: red; margin: 0 auto', '.x').map((r) => r.css),
    ).toEqual(['.x{font-family:Inter, sans-serif}', '.x{color:red}', '.x{margin:0 auto}']);
  });

  it('converts only the dimension literals inside a mixed value', () => {
    expect(compileDimenAttribute('margin: 0 auto 8sdp', '.x')[0]!.css).toBe('.x{margin:0 auto calc(8 * var(--sdp))}');
  });

  it('keeps !important, with or without a space before it', () => {
    expect(compileDimenAttribute('padding: 8sdp !important', '.x')[0]!.css).toBe(
      '.x{padding:calc(8 * var(--sdp)) !important}',
    );
    expect(compileDimenAttribute('padding: 8sdp!', '.x')[0]!.css).toBe('.x{padding:calc(8 * var(--sdp)) !important}');
  });

  it('ignores empty declarations and empty text', () => {
    expect(compileDimenAttribute('padding: 8sdp;; ;', '.x')).toHaveLength(1);
    expect(compileDimenAttribute('')).toEqual([]);
  });

  it('escapes quotes in the attribute selector', () => {
    const text = 'font-family: "Inter"';
    expect(compileDimenAttribute(text)[0]!.css).toBe(String.raw`[data-dimen="font-family: \"Inter\""]{font-family:"Inter"}`);
  });

  it('escapes backslashes in the attribute selector', () => {
    const text = String.raw`content: "\201C"`;
    expect(compileDimenAttribute(text)[0]!.css).toBe(
      String.raw`[data-dimen="content: \"\\201C\""]{content:"\201C"}`,
    );
  });

  it('throws SyntaxError when the colon is missing', () => {
    expect(() => compileDimenAttribute('padding 8sdp')).toThrow(SyntaxError);
    expect(() => compileDimenAttribute('padding 8sdp')).toThrow(/missing ":"/);
  });

  it('throws SyntaxError for a property name that is not a CSS property', () => {
    expect(() => compileDimenAttribute('Padding: 8sdp')).toThrow(SyntaxError);
    expect(() => compileDimenAttribute('8px: 1sdp')).toThrow(/unknown property/);
  });

  it('throws SyntaxError for an unknown condition', () => {
    expect(() => compileDimenAttribute('padding@xl: 8sdp')).toThrow(SyntaxError);
    expect(() => compileDimenAttribute('padding@xl: 8sdp')).toThrow(/unknown condition/);
  });

  it('throws TypeError for a JS-only token, which has no CSS form', () => {
    expect(() => compileDimenAttribute('padding: 2sdpPx')).toThrow(TypeError);
  });

  it('regression: an empty value is accepted and emits an empty declaration instead of throwing', () => {
    expect(() => compileDimenAttribute('padding:')).toThrow(SyntaxError);
  });

  it('regression: a line break inside data-dimen puts a raw newline into the attribute selector', () => {
    const rules = compileDimenAttribute('padding: 8sdp;\nfont-size: 14ssp');
    expect(rules.every((r) => !r.css.includes('\n'))).toBe(true);
  });

  it('regression: Object.prototype keys as a property name do not crash (treated as an unknown property)', () => {
    // Unknown kebab-case names compile to a plain declaration the browser ignores, like any typo.
    expect(compileDimenAttribute('constructor: 8sdp')[0]!.css).toBe('[data-dimen="constructor: 8sdp"]{constructor:calc(8 * var(--sdp))}');
    expect(() => compileDimenAttribute('toString: 8sdp')).toThrow(SyntaxError); // not kebab-case → unknown
  });

  it('regression: Object.prototype keys such as "constructor" as a condition are accepted as mode "normal"', () => {
    expect(() => compileDimenAttribute('padding@constructor: 8sdp')).toThrow(SyntaxError);
    expect(compileDimenClass('p@constructor:8sdp')).toBeNull();
  });
});

describe('compileDimenClass: Object.prototype keys', () => {
  it('regression: a class named "constructor" does not crash (treated as an unknown property)', () => {
    expect(compileDimenClass('constructor:16sdp')?.css).toBe('.constructor\\:16sdp{constructor:calc(16 * var(--sdp))}');
  });

  it('regression: a JS-only token such as "2sdpPx" throws instead of returning null', () => {
    expect(compileDimenClass('p:2sdpPx')).toBeNull();
    expect(compileDimenClass('p:16sspPh')).toBeNull();
  });
});

describe('cascade order (Android priority)', () => {
  it('joinRules sorts default < orientation < qualifier < mode < mode + qualifier, whatever the input order', () => {
    const def = compileDimenClass('p:1sdp')!;
    const orientation = compileDimenClass('p@landscape:1sdp')!;
    const sw300 = compileDimenClass('p@sw300:1sdp')!;
    const landscapeSw600 = compileDimenClass('p@landscape@sw600:1sdp')!;
    const sw720 = compileDimenClass('p@sw720:1sdp')!;
    const h1000 = compileDimenClass('p@h1000:1sdp')!;
    const tv = compileDimenClass('p@tv:1sdp')!;
    const tvSw300 = compileDimenClass('p@tv@sw300:1sdp')!;

    const shuffled = [tvSw300, sw720, def, tv, h1000, orientation, sw300, landscapeSw600];
    expect(joinRules(shuffled).split('\n')).toEqual(
      [def, orientation, sw300, landscapeSw600, sw720, h1000, tv, tvSw300].map((r) => r.css),
    );
  });

  it('dimenClassesToCss emits the same order for any input order', () => {
    const forward = dimenClassesToCss(['p:1sdp', 'p@landscape:1sdp', 'p@sw600:1sdp', 'p@tv:1sdp', 'p@tv@sw600:1sdp']);
    const reverse = dimenClassesToCss(['p@tv@sw600:1sdp', 'p@tv:1sdp', 'p@sw600:1sdp', 'p@landscape:1sdp', 'p:1sdp']);
    expect(reverse).toBe(forward);
    expect(forward.split('\n')).toEqual([
      String.raw`.p\:1sdp{padding:calc(1 * var(--sdp))}`,
      String.raw`@media (orientation: landscape){.p\@landscape\:1sdp{padding:calc(1 * var(--sdp))}}`,
      String.raw`@media (min-width: 600px) and (min-height: 600px){.p\@sw600\:1sdp{padding:calc(1 * var(--sdp))}}`,
      String.raw`:root[data-ad-mode="tv"] .p\@tv\:1sdp{padding:calc(1 * var(--sdp))}`,
      String.raw`@media (min-width: 600px) and (min-height: 600px){:root[data-ad-mode="tv"] .p\@tv\@sw600\:1sdp{padding:calc(1 * var(--sdp))}}`,
    ]);
  });

  it('a larger qualifier threshold comes later, on either axis', () => {
    const out = joinRules([compileDimenClass('p@w720:1sdp')!, compileDimenClass('p@sw600:1sdp')!]).split('\n');
    expect(out[0]).toContain('(min-width: 600px) and (min-height: 600px)');
    expect(out[1]).toBe('@media (min-width: 720px){.p\\@w720\\:1sdp{padding:calc(1 * var(--sdp))}}');
  });

  it('a mode with a small qualifier still beats a larger qualifier without a mode', () => {
    const out = joinRules([compileDimenClass('p@car@sw300:1sdp')!, compileDimenClass('p@sw900:1sdp')!]).split('\n');
    expect(out[0]).toContain('min-width: 900px');
    expect(out[1]).toContain('[data-ad-mode="car"]');
  });

  it('data-dimen rules take the default priority and follow the default classes', () => {
    const out = dimenClassesToCss(['p@tv:1sdp', 'p:1sdp'], ['padding: 2sdp']).split('\n');
    expect(out[0]).toBe('.p\\:1sdp{padding:calc(1 * var(--sdp))}');
    expect(out[1]).toContain('[data-dimen="padding: 2sdp"]');
    expect(out[2]).toContain('[data-ad-mode="tv"]');
  });

  it('dimenClassesToCss ignores non-dimension classes and deduplicates repeats', () => {
    const out = dimenClassesToCss(['hover:bg-red-500', 'p:1sdp', 'p:1sdp'], ['padding: 2sdp', 'padding: 2sdp']);
    expect(out.split('\n')).toHaveLength(2);
    expect(out).not.toContain('hover');
  });

  it('dimenClassesToCss returns an empty string when there is nothing to compile', () => {
    expect(dimenClassesToCss([])).toBe('');
  });
});

describe('modifierCss', () => {
  it('.ad-a maps every unprefixed token to its aspect-ratio variant', () => {
    const a = declarations(modifierCss([]), '.ad-a');
    expect(a).toContain('--sdp:var(--sdpa)');
    expect(a).toContain('--sdpi:var(--sdpia)');
    expect(a).toContain('--ssp:var(--sspa)');
    expect(a).toContain('--sem:var(--sema)');
    expect(a).toContain('--sdpPh:var(--sdpPha)');
    expect(a).toContain('--hdpLw:var(--hdpLwa)');
    expect(a).toHaveLength(34);
  });

  it('.ad-i maps every unprefixed token to its ignore-multi-window variant', () => {
    const i = declarations(modifierCss([]), '.ad-i');
    expect(i).toContain('--sdp:var(--sdpi)');
    expect(i).toContain('--sdpa:var(--sdpia)');
    expect(i).toContain('--ssp:var(--sspi)');
    expect(i).toHaveLength(34);
  });

  it('.ad-ia maps every unprefixed token to its combined variant', () => {
    const ia = declarations(modifierCss([]), '.ad-ia');
    expect(ia).toContain('--sdp:var(--sdpia)');
    expect(ia).toContain('--sdpa:var(--sdpia)');
    expect(ia).toContain('--sdpi:var(--sdpia)');
    expect(ia).toHaveLength(51);
  });

  it('the flag classes are emitted even with no strategies', () => {
    const sheet = modifierCss([]);
    expect(sheet).toContain('.ad-a,:root:root.ad-a{');
    expect(sheet).toContain('.ad-i,:root:root.ad-i{');
    expect(sheet).toContain('.ad-ia,:root:root.ad-ia{');
    expect(sheet).not.toContain('.ad-power');
  });

  it('.ad-power appears only when a strategy with prefix "pw" is passed', () => {
    expect(modifierCss([{ id: 'fluid', prefix: 'f' }])).not.toContain('.ad-power');
    const sheet = modifierCss([{ id: 'power', prefix: 'pw' }]);
    expect(sheet).toContain('.ad-power{--sdp:var(--pwsdp);--sdpa:var(--pwsdpa);--sdpi:var(--pwsdpi);--sdpia:var(--pwsdpia);');
    expect(declarations(sheet, '.ad-power')).toContain('--ssp:var(--pwssp)');
  });

  it('a strategy with an empty prefix (scaled) produces no class', () => {
    expect(modifierCss([{ id: 'scaled', prefix: '' }])).not.toContain('.ad-scaled');
  });
});

describe('modeAttribute', () => {
  it.each<[UiModeType, string]>([
    [UiModeType.NORMAL, 'normal'],
    [UiModeType.TELEVISION, 'tv'],
    [UiModeType.CAR, 'car'],
    [UiModeType.WATCH, 'watch'],
    [UiModeType.DESK, 'desk'],
    [UiModeType.APPLIANCE, 'appliance'],
    [UiModeType.VR_HEADSET, 'vr'],
    [UiModeType.UNDEFINED, 'undefined'],
    [UiModeType.FOLD_OPEN, 'fold-open'],
    [UiModeType.FOLD_CLOSED, 'fold-closed'],
    [UiModeType.FOLD_HALF_OPENED, 'fold-half'],
    [UiModeType.FLIP_OPEN, 'flip-open'],
    [UiModeType.FLIP_CLOSED, 'flip-closed'],
    [UiModeType.FLIP_HALF_OPENED, 'flip-half'],
  ])('%s is written as data-ad-mode="%s"', (mode, attr) => {
    expect(modeAttribute(mode)).toBe(attr);
  });

  it('every UiModeType has a condition name that maps back to it', () => {
    for (const mode of Object.values(UiModeType)) {
      expect(MODE_CONDITIONS[modeAttribute(mode)]).toBe(mode);
    }
  });

  it('falls back to "normal" for a value that is not a UI mode', () => {
    expect(modeAttribute('NOT_A_MODE' as UiModeType)).toBe('normal');
  });
});

describe('package entry', () => {
  it('re-exports the declarative compiler', () => {
    expect(index.compileDimenClass).toBe(compileDimenClass);
    expect(index.compileDimenAttribute).toBe(compileDimenAttribute);
    expect(index.dimenClassesToCss).toBe(dimenClassesToCss);
    expect(index.modifierCss).toBe(modifierCss);
    expect(index.PROPERTY_ALIASES).toBe(PROPERTY_ALIASES);
    expect(index.MODE_CONDITIONS).toBe(MODE_CONDITIONS);
  });
});
