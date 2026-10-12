import postcss, { type AcceptedPlugin, type ChildNode } from 'postcss';
import { describe, expect, it } from 'vitest';
import webdimens, { type WebDimensPostcssOptions } from '../src/postcss';

/**
 * Runs the plugin with the real PostCSS and returns the output CSS (the plugin is synchronous).
 * The cast is needed because the plugin's structural node types are narrower than postcss's
 * `Plugin` type, so `postcss([webdimens()])` does not typecheck without it (reported as a
 * type-only gap in src/postcss.ts; runtime behaviour is unaffected).
 */
function run(css: string, options?: WebDimensPostcssOptions): string {
  return postcss([webdimens(options) as unknown as AcceptedPlugin]).process(css, { from: undefined }).css;
}

/** Compact one-line view of a node: `sel{prop:value;…}`, `@name params{…}`. */
function show(node: ChildNode): string {
  switch (node.type) {
    case 'decl':
      return `${node.prop}:${node.value}${node.important ? '!important' : ''}`;
    case 'rule':
      return `${node.selector}{${node.nodes.map(show).join(';')}}`;
    case 'atrule':
      return `@${node.name} ${node.params}{${(node.nodes ?? []).map(show).join(' ')}}`;
    default:
      return node.type;
  }
}

/** Top-level blocks of the plugin output, in output order. */
function blocks(css: string, options?: WebDimensPostcssOptions): string[] {
  return postcss.parse(run(css, options)).nodes.map(show);
}

const SW600 = '(min-width: 600px) and (min-height: 600px)';

describe('webdimens/postcss: units in declarations', () => {
  it('compiles scaled, height and width literals to CSS custom properties', () => {
    expect(blocks('.card { padding: 8sdp 16sdp; font-size: 14ssp; width: 120wdp; height: 50hdp; }')).toEqual([
      '.card{padding:calc(8 * var(--sdp)) calc(16 * var(--sdp));font-size:calc(14 * var(--ssp));width:calc(120 * var(--wdp));height:calc(50 * var(--hdp))}',
    ]);
  });

  it('supports inverters, the a / i flags, negative and fractional values', () => {
    expect(blocks('.a { margin: -8sdp .5sdp 2hdpLw 3sdpa; }')).toEqual([
      '.a{margin:calc(-8 * var(--sdp)) calc(0.5 * var(--sdp)) calc(2 * var(--hdpLw)) calc(3 * var(--sdpa))}',
    ]);
  });

  it('publishes custom properties and the em text token', () => {
    expect(blocks(':root { --gap: 12sdp; font-size: 14sem; }')).toEqual([
      ':root{--gap:calc(12 * var(--sdp));font-size:calc(14 * var(--sem))}',
    ]);
  });

  it('keeps !important on a compiled declaration', () => {
    expect(blocks('.a { padding: 8sdp !important; }')).toEqual([
      '.a{padding:calc(8 * var(--sdp))!important}',
    ]);
  });

  it('compiles declarations inside any at-rule or nested rule', () => {
    expect(blocks('@media (max-width: 600px) { .a { padding: 8sdp; } }')).toEqual([
      '@media (max-width: 600px){.a{padding:calc(8 * var(--sdp))}}',
    ]);
  });

  it('leaves values without dimension literals byte-for-byte untouched', () => {
    const css = [
      '.a {',
      '  color: red;',
      '  margin: 0 auto;',
      '  width: 100%;',
      '  width: calc(100% - 8px);',
      '  padding: 10px;',
      '  margin-top: 1em;',
      '  transition: opacity 0.3s ease;',
      '  grid-template-columns: repeat(2, 1fr);',
      '  font: 12px/1.5 sans-serif;',
      '  aspect-ratio: 16/9;',
      '  content: "16sdp";',
      '  background: url(img/16sdp.png);',
      '}',
    ].join('\n');
    expect(run(css)).toBe(css);
  });

  it('is idempotent: running the plugin on its own output changes nothing', () => {
    const once = run('.card { padding: 8sdp 16sdp; @dimen tv { font-size: 28ssp; } }');
    expect(run(once)).toBe(once);
  });
});

describe('webdimens/postcss: nested @dimen blocks', () => {
  it('emits media and :root-prefixed rules right after the parent, in Android priority', () => {
    expect(
      blocks(`
        .card {
          padding: 8sdp;
          @dimen landscape { padding: 12sdp 24sdp; }
          @dimen sw600 { padding: 32sdp; }
          @dimen tv { font-size: 28ssp; }
          @dimen tv sw600 { font-size: 40ssp; }
        }`),
    ).toEqual([
      '.card{padding:calc(8 * var(--sdp))}',
      '@media (orientation: landscape){.card{padding:calc(12 * var(--sdp)) calc(24 * var(--sdp))}}',
      `@media ${SW600}{.card{padding:calc(32 * var(--sdp))}}`,
      ':root[data-ad-mode="tv"] .card{font-size:calc(28 * var(--ssp))}',
      `@media ${SW600}{:root[data-ad-mode="tv"] .card{font-size:calc(40 * var(--ssp))}}`,
    ]);
  });

  it('orders blocks by Android priority even when they are written out of order', () => {
    expect(
      blocks(`
        .card {
          padding: 8sdp;
          @dimen tv sw600 { padding: 1sdp; }
          @dimen tv { padding: 2sdp; }
          @dimen sw600 { padding: 3sdp; }
          @dimen landscape { padding: 4sdp; }
        }`),
    ).toEqual([
      '.card{padding:calc(8 * var(--sdp))}',
      '@media (orientation: landscape){.card{padding:calc(4 * var(--sdp))}}',
      `@media ${SW600}{.card{padding:calc(3 * var(--sdp))}}`,
      ':root[data-ad-mode="tv"] .card{padding:calc(2 * var(--sdp))}',
      `@media ${SW600}{:root[data-ad-mode="tv"] .card{padding:calc(1 * var(--sdp))}}`,
    ]);
  });

  it('keeps the blocks of two parents separate and in source order', () => {
    expect(
      blocks(`
        .a { padding: 1sdp; @dimen landscape { padding: 2sdp; } }
        .b { padding: 3sdp; @dimen tv { padding: 4sdp; } }`),
    ).toEqual([
      '.a{padding:calc(1 * var(--sdp))}',
      '@media (orientation: landscape){.a{padding:calc(2 * var(--sdp))}}',
      '.b{padding:calc(3 * var(--sdp))}',
      ':root[data-ad-mode="tv"] .b{padding:calc(4 * var(--sdp))}',
    ]);
  });

  it('applies the condition prefix to every selector of the parent rule', () => {
    expect(blocks('.a, .b { @dimen tv { color: red; } }')).toEqual([
      ':root[data-ad-mode="tv"] .a, :root[data-ad-mode="tv"] .b{color:red}',
    ]);
  });

  it('applies multi-window as a root attribute selector', () => {
    expect(blocks('.card { @dimen landscape mw { margin: 4sdp; } }')).toEqual([
      '@media (orientation: landscape){:root[data-ad-multi-window] .card{margin:calc(4 * var(--sdp))}}',
    ]);
  });

  it('removes a parent whose only content was @dimen blocks', () => {
    expect(
      blocks(`
        .only-dimen { @dimen landscape { padding: 12sdp; } }
        .only-tv { @dimen tv { color: red; } }`),
    ).toEqual([
      '@media (orientation: landscape){.only-dimen{padding:calc(12 * var(--sdp))}}',
      ':root[data-ad-mode="tv"] .only-tv{color:red}',
    ]);
  });

  it('keeps !important on declarations inside @dimen blocks', () => {
    expect(blocks('.a { @dimen tv { padding: 8sdp !important; } }')).toEqual([
      ':root[data-ad-mode="tv"] .a{padding:calc(8 * var(--sdp))!important}',
    ]);
  });
});

describe('webdimens/postcss: errors', () => {
  it('rejects an unknown condition', () => {
    expect(() => run('.a { @dimen bogus { padding: 8sdp; } }')).toThrow(
      'webdimens: unknown condition in "@dimen bogus"',
    );
  });

  it.each([
    ['at the top level', '@dimen tv { .a { padding: 8sdp; } }'],
    ['inside another at-rule', '@media screen { @dimen tv { .a { padding: 8sdp; } } }'],
  ])('rejects @dimen %s', (_where, css) => {
    expect(() => run(css)).toThrow('webdimens: @dimen must be nested inside a style rule');
  });
});

describe('webdimens/postcss: options', () => {
  it('honours a custom atRule name and leaves the default name alone', () => {
    const css = '.card { padding: 8sdp; @when landscape { padding: 12sdp; } @dimen tv { color: red; } }';
    expect(blocks(css, { atRule: 'when' })).toEqual([
      '.card{padding:calc(8 * var(--sdp));@dimen tv{color:red}}',
      '@media (orientation: landscape){.card{padding:calc(12 * var(--sdp))}}',
    ]);
  });

  it('with the default name, an @when block is not a conditional block', () => {
    expect(blocks('@when landscape { .card { padding: 12sdp; } }')).toEqual([
      '@when landscape{.card{padding:calc(12 * var(--sdp))}}',
    ]);
  });

  it('a custom atRule name rejects the same unknown conditions', () => {
    expect(() => run('.a { @when bogus { padding: 8sdp; } }', { atRule: 'when' })).toThrow(
      'webdimens: unknown condition in "@when bogus"',
    );
  });

  it('is a PostCSS 8 plugin object named webdimens', () => {
    expect(webdimens().postcssPlugin).toBe('webdimens');
    expect(webdimens.postcss).toBe(true);
  });
});
