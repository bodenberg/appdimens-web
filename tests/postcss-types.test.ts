import postcss from 'postcss';
import { expect, it } from 'vitest';
import webdimens from '../src/postcss';

it('the plugin is assignable to postcss Plugin (compile-time check) and runs', async () => {
  const processor = postcss([webdimens()]); // TS2769 here would mean the public type regressed
  const out = await processor.process('.a{padding:8sdp}', { from: undefined });
  expect(out.css).toBe('.a{padding:calc(8 * var(--sdp))}');
});
