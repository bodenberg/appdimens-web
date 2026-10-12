import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import postcss from 'postcss';
import { expect, it } from 'vitest';
import webdimens from '../src/postcss';

const input = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../examples/postcss/input.css'), 'utf8');

it('examples/postcss/input.css compiles as documented', async () => {
  const { css } = await postcss([webdimens()]).process(input, { from: undefined });
  expect(css).toContain('padding: calc(8 * var(--sdp)) calc(16 * var(--sdp));');
  expect(css).toContain('margin: max(calc(8 * var(--sdp)), 4px) auto;');
  expect(css).toContain('background: url(/img/16sdp.png)'); // last declaration: postcss keeps the source raws (no ';')
  expect(css).toContain('height: calc(220 * var(--hdp));');
  expect(css).toContain('width: calc(100% - 2 * calc(16 * var(--sdp)));');
  expect(css).not.toContain('@dimen');
  // Android priority, whatever the source order: landscape < sw600 < tv < tv+sw600
  const landscape = css.indexOf('@media (orientation: landscape)');
  const sw600 = css.indexOf('@media (min-width: 600px) and (min-height: 600px)');
  const tv = css.indexOf(':root[data-ad-mode="tv"] .card');
  const tvSw = css.lastIndexOf(':root[data-ad-mode="tv"] .card');
  expect(landscape).toBeGreaterThan(0);
  expect(sw600).toBeGreaterThan(landscape);
  expect(tv).toBeGreaterThan(sw600);
  expect(tvSw).toBeGreaterThan(tv);
});
