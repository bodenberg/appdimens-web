#!/usr/bin/env node
/**
 * Validates every relative Markdown link (file + #anchor) in README*, docs/, examples/, skills/,
 * CHANGELOG.md and LLMS.txt, and that docs/ and docs/pt-BR/ contain the same pages.
 *   node scripts/docs-check.mjs
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const files = [];
const walk = (dir) => {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (statSync(p).isDirectory()) walk(p);
    else if (f.endsWith('.md') || f === 'LLMS.txt') files.push(p);
  }
};
for (const d of ['docs', 'examples', 'skills']) if (existsSync(join(root, d))) walk(join(root, d));
for (const f of ['README.md', 'README.pt-BR.md', 'CHANGELOG.md', 'LLMS.txt']) files.push(join(root, f));

/** GitHub heading slug. */
const slug = (h) =>
  h.trim().toLowerCase().replace(/<[^>]+>/g, '').replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');
const anchorsCache = new Map();
function anchors(file) {
  if (!anchorsCache.has(file)) {
    const text = readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, '');
    const seen = new Map();
    const set = new Set();
    for (const m of text.matchAll(/^#{1,6}\s+(.+)$/gm)) {
      const base = slug(m[1]);
      const n = seen.get(base) ?? 0;
      seen.set(base, n + 1);
      set.add(n ? `${base}-${n}` : base);
    }
    anchorsCache.set(file, set);
  }
  return anchorsCache.get(file);
}

let failures = 0;
let links = 0;
for (const file of files) {
  const text = readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, '').replace(/`[^`\n]*`/g, '');
  for (const m of text.matchAll(/\]\(([^)\s]+)\)/g)) {
    const target = m[1];
    if (/^(https?:|mailto:)/.test(target)) continue;
    links++;
    const [path, hash] = target.split('#');
    const dest = path ? resolve(dirname(file), path) : file;
    const where = relative(root, file);
    if (!existsSync(dest)) {
      console.error(`✗ ${where}: missing ${target}`);
      failures++;
      continue;
    }
    if (hash && dest.endsWith('.md') && !anchors(dest).has(hash)) {
      console.error(`✗ ${where}: missing anchor ${target}`);
      failures++;
    }
  }
}

// docs/ and docs/pt-BR/ must mirror each other.
const en = readdirSync(join(root, 'docs')).filter((f) => f.endsWith('.md')).sort();
const pt = existsSync(join(root, 'docs/pt-BR')) ? readdirSync(join(root, 'docs/pt-BR')).filter((f) => f.endsWith('.md')).sort() : [];
for (const f of en) if (!pt.includes(f)) { console.error(`✗ docs/pt-BR/${f} missing (translation)`); failures++; }
for (const f of pt) if (!en.includes(f)) { console.error(`✗ docs/${f} missing (source of pt-BR/${f})`); failures++; }

if (failures) {
  console.error(`\n${failures} documentation problem(s).`);
  process.exit(1);
}
console.log(`Docs OK: ${files.length} files, ${links} relative links, ${en.length} pages in EN and pt-BR.`);
