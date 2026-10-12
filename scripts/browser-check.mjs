#!/usr/bin/env node
/**
 * Real-browser smoke test (Chromium via Playwright): loads examples/vanilla.html,
 * checks the published CSS tokens and JS values at two viewport sizes, and that
 * a resize re-scales layout without a reload.
 *   node scripts/browser-check.mjs [--screenshot dir]
 */
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = await import(process.env.PLAYWRIGHT_MODULE ?? 'playwright'));
}
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const shotDir = process.argv.includes('--screenshot') ? process.argv[process.argv.indexOf('--screenshot') + 1] : null;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 360, height: 740 }, deviceScaleFactor: 3 });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
await page.goto(pathToFileURL(join(root, 'examples/vanilla.html')).href);

const probe = () =>
  page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    const card = document.querySelector('.card');
    return {
      sdpVar: cs.getPropertyValue('--sdp').trim(),
      pwsdpVar: cs.getPropertyValue('--pwsdp').trim(),
      padding: getComputedStyle(card).paddingTop,
      sdp16: window.WebDimens.sdp(16),
      density: window.WebDimens.getMetrics().density,
      fit: document.getElementById('fit').style.fontSize,
    };
  });

let failures = 0;
const expectEq = (label, a, b) => {
  const pass = typeof b === 'number' ? Math.abs(a - b) < 0.01 : a === b;
  console.log(`${pass ? '✓' : '✗'} ${label}: ${a}${pass ? '' : ` (expected ${b})`}`);
  if (!pass) failures++;
};

let r = await probe();
expectEq('360 dp: --sdp', r.sdpVar, '1.2px');
expectEq('360 dp: card padding (16 × --sdp)', r.padding, '19.2px');
expectEq('360 dp: sdp(16)', r.sdp16, 19.2);
expectEq('density = deviceScaleFactor', r.density, 3);
expectEq('--pwsdp = (360/300)^0.75', parseFloat(r.pwsdpVar), Math.round(Math.pow(1.2, 0.75) * 1e4) / 1e4);
expectEq('no horizontal overflow', await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
const fitSize = parseFloat(r.fit);
expectEq('auto-resized headline shrank below max (48px)', fitSize > 10 && fitSize < 48, true);
expectEq('auto-resized headline fits its box', await page.evaluate(() => { const e = document.getElementById('fit'); return e.scrollWidth <= e.clientWidth + 0.5; }), true);
const lines = await page.evaluate(() => {
  const host = document.createElement('div');
  host.style.cssText = 'width:200px;height:400px;line-height:1.3;font-family:sans-serif';
  host.textContent = 'The quick brown fox jumps over the lazy dog again and again';
  document.body.appendChild(host);
  const out = {};
  for (const maxLines of [1, 2, 3]) {
    const size = window.WebDimens.fittingTextSize(host, { min: 6, max: 60, maxLines });
    const range = document.createRange();
    range.selectNodeContents(host);
    const tops = new Set([...range.getClientRects()].map((r) => Math.round(r.top)));
    out[maxLines] = { size, lines: tops.size };
  }
  host.remove();
  return out;
});
for (const n of [1, 2, 3]) expectEq(`fittingTextSize maxLines=${n} renders ≤ ${n} lines (size ${lines[n].size}px)`, lines[n].lines <= n, true);
expectEq('more lines allow a larger size', lines[1].size < lines[2].size && lines[2].size < lines[3].size, true);
const decl = await page.evaluate(() => {
  const cs = (id) => getComputedStyle(document.getElementById(id));
  return {
    title: cs('decl-title').fontSize,
    chip: cs('decl-chip').paddingTop + ' ' + cs('decl-chip').paddingLeft,
    styleBlock: cs('decl').marginTop,
    sdpa: window.WebDimens.sdpa(1),
    mode: document.documentElement.getAttribute('data-ad-mode'),
  };
});
// .ad-a on the section → every --sdp/--ssp inside resolves to the aspect-ratio variant.
expectEq('class fs:20ssp under .ad-a', parseFloat(decl.title), Math.round(20 * decl.sdpa * 1e4) / 1e4);
const [padTop, padLeft] = decl.chip.split(' ').map(parseFloat);
expectEq('class p:8sdp_12sdp under .ad-a (top)', padTop, 8 * decl.sdpa);
expectEq('class p:8sdp_12sdp under .ad-a (left)', padLeft, 12 * decl.sdpa);
// #decl also carries .ad-a, so 4sdp resolves to the aspect-ratio variant there.
expectEq('<style data-webdimens> 4sdp (under .ad-a)', parseFloat(decl.styleBlock), 4 * decl.sdpa);
expectEq('html[data-ad-mode]', decl.mode, 'normal');
if (shotDir) await page.screenshot({ path: join(shotDir, 'vanilla-360.png'), fullPage: true });

await page.setViewportSize({ width: 900, height: 1200 });
await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--sdp').trim() === '3px');
r = await probe();
expectEq('900 dp: --sdp after live resize', r.sdpVar, '3px');
expectEq('900 dp: card padding', r.padding, '48px');
expectEq('900 dp: sdp(16)', r.sdp16, 48);
const wide = await page.evaluate(() => {
  const cs = getComputedStyle(document.getElementById('decl-chip'));
  return { pad: cs.paddingTop, sdpa: window.WebDimens.sdpa(1) };
});
expectEq('data-dimen padding@sw600: 16sdp (≥600 dp) under .ad-a', parseFloat(wide.pad), Math.round(16 * wide.sdpa * 1e4) / 1e4);
if (shotDir) await page.screenshot({ path: join(shotDir, 'vanilla-900.png'), fullPage: true });

const cssOnly = await browser.newPage({ viewport: { width: 600, height: 800 } });
await cssOnly.goto(pathToFileURL(join(root, 'examples/css-only.html')).href);
const pad = await cssOnly.evaluate(() => getComputedStyle(document.querySelector('.box')).paddingTop);
expectEq('CSS-only fallback: 16 × sdp at 600 dp', pad, '32px');

if (errors.length) {
  failures += errors.length;
  console.error('page errors:', errors);
}
await browser.close();
if (failures) process.exit(1);
console.log('\nBrowser check passed.');
