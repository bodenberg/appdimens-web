import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { compileString } from 'sass';
import { describe, expect, it } from 'vitest';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

describe('SCSS functions', () => {
  it('compile to calc() over the CSS tokens', () => {
    const out = compileString(
      `@use 'webdimens' as d;\n.card { padding: d.sdp(16); font-size: d.ssp(14); margin: d.pwhdpa(8); gap: d.dimen(sdpLw, 4); }`,
      { loadPaths: [join(root, 'scss')], style: 'compressed' },
    ).css;
    expect(out).toContain('padding:calc(16*var(--sdp))');
    expect(out).toContain('font-size:calc(14*var(--ssp))');
    expect(out).toContain('margin:calc(8*var(--pwhdpa))');
    expect(out).toContain('gap:calc(4*var(--sdpLw))');
  });
});

describe('CSS fallbacks', () => {
  const css = readFileSync(join(root, 'css/webdimens.css'), 'utf8');
  it('define every scaled token without JavaScript', () => {
    for (const token of ['sdp', 'hdp', 'wdp', 'sdpa', 'sdpi', 'sdpia', 'ssp', 'sem', 'hsp', 'wem', 'sdpPh', 'hdpLw', 'wdpPh']) {
      expect(css, token).toContain(`--${token}:`);
    }
    expect(css).toContain('--sdp: calc(min(100vw, 100vh) / 300)');
    expect(css).toContain('@media (orientation: portrait)');
  });

  it('all.css carries every strategy', () => {
    const all = readFileSync(join(root, 'css/all.css'), 'utf8');
    for (const token of ['psdp', 'pwsdp', 'fsdp', 'asdp', 'dgsdp', 'flsdp', 'ftsdp', 'isdp', 'logsdp', 'prsdp', 'dsdp']) {
      expect(all, token).toContain(`--${token}:`);
    }
  });
});
