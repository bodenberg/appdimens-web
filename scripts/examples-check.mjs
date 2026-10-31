#!/usr/bin/env node
/**
 * Loads every examples/*.html in Chromium (Playwright) and fails on page errors or wrong values.
 * Run `npm run build` first.   node scripts/examples-check.mjs
 */
import { readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  ({ chromium } = await import('playwright'));
}
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pages = readdirSync(join(root, 'examples')).filter((f) => f.endsWith('.html'));
const browser = await chromium.launch();
let failures = 0;
const check = (label, ok, detail = '') => {
  console.log(`${ok ? '✓' : '✗'} ${label}${ok ? '' : `  ${detail}`}`);
  if (!ok) failures++;
};
const near = (a, b) => Math.abs(a - b) < 0.05;

async function open(file, viewport) {
  const page = await browser.newPage({ viewport });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto(pathToFileURL(join(root, 'examples', file)).href);
  await page.waitForTimeout(150);
  return { page, errors };
}

// Every page loads without errors, portrait phone and landscape desktop.
for (const file of pages) {
  for (const viewport of [{ width: 360, height: 740 }, { width: 1280, height: 800 }]) {
    const { page, errors } = await open(file, viewport);
    check(`${file} @ ${viewport.width}×${viewport.height}: no page errors`, errors.length === 0, errors.join(' | '));
    await page.close();
  }
}

// declarative.html — Android priority and modifiers.
{
  const pad = (p) => p.evaluate(() => parseFloat(getComputedStyle(document.getElementById('prio')).paddingTop));
  let { page } = await open('declarative.html', { width: 360, height: 740 });
  check('declarative: default p:8sdp at 360 dp', near(await pad(page), 8 * 1.2));
  await page.setViewportSize({ width: 900, height: 600 });
  await page.waitForTimeout(150);
  check('declarative: @sw600 (16sdp) beats @landscape at 900×600', near(await pad(page), 16 * 2));
  await page.click('[data-mode="TELEVISION"]');
  await page.waitForTimeout(100);
  check('declarative: @tv@sw600 (32sdp) wins with UI mode TV', near(await pad(page), 32 * 2));
  check('declarative: <html data-ad-mode="tv">', (await page.evaluate(() => document.documentElement.dataset.adMode)) === 'tv');
  const widths = await page.evaluate(() =>
    ['plain', 'mod-power', 'mod-fluid'].map((id) => parseFloat(getComputedStyle(document.querySelector(`#${id} > div`)).width)));
  check('declarative: .ad-power / .ad-fluid change the subtree strategy', widths[0] !== widths[1] && widths[0] !== widths[2], widths.join(','));
  const style = await page.evaluate(() => parseFloat(getComputedStyle(document.getElementById('readout')).paddingTop));
  check('declarative: <style data-webdimens> compiled', near(style, 12 * 2));
  await page.close();
}

// strategies.html — 12 rows with values.
{
  const { page } = await open('strategies.html', { width: 412, height: 915 });
  const values = await page.$$eval('[data-value]', (els) => els.map((e) => e.textContent));
  check('strategies: 12 strategies rendered', values.length === 12 && values.every((v) => /px$/.test(v)), values.join(','));
  await page.close();
}

// canvas.html — drawn with device pixels.
{
  const { page } = await open('canvas.html', { width: 400, height: 800 });
  const drawn = await page.evaluate(() => Number(document.getElementById('chart').dataset.drawn));
  check('canvas: drawn with sdpPx(16) padding', near(drawn, 16 * (400 / 300) * 1), String(drawn));
  await page.close();
}

// scope.html — tokens follow the panel.
{
  const { page } = await open('scope.html', { width: 1280, height: 800 });
  const r = await page.evaluate(() => {
    const panel = document.getElementById('panel');
    const sdp = parseFloat(panel.style.getPropertyValue('--sdp'));
    const pad = parseFloat(getComputedStyle(document.querySelector('.card')).paddingTop);
    return { sdp, pad, sw: Math.min(panel.clientWidth, panel.clientHeight) };
  });
  check('scope: --sdp on the panel = panel sw / 300', near(r.sdp, r.sw / 300), JSON.stringify(r));
  check('scope: .card padding uses the panel token', near(r.pad, 16 * r.sdp), JSON.stringify(r));
  await page.close();
}

// resize.html — every box fits.
{
  const { page } = await open('resize.html', { width: 360, height: 740 });
  const boxes = await page.$$eval('.box', (els) =>
    els.map((e) => ({ fs: parseFloat(e.style.fontSize), fits: e.scrollWidth <= e.clientWidth + 0.5 && e.scrollHeight <= e.clientHeight + 0.5 })));
  check('resize: all boxes fitted', boxes.every((b) => b.fs >= 10 && b.fits), JSON.stringify(boxes));
  await page.close();
}

// custom.html — custom strategy resolves and publishes its CSS variable.
{
  const { page } = await open('custom.html', { width: 360, height: 740 });
  const r = await page.evaluate(() => ({
    custom: window.__custom,
    cssVar: getComputedStyle(document.documentElement).getPropertyValue('--cdp-brand').trim(),
  }));
  const expected = 48 * Math.max(0.85, Math.pow(360 / 360, 0.8));
  check('custom: brand factor at 360 wide', Math.abs(r.custom.brand - expected) < 1e-6, JSON.stringify(r));
  check('custom: --cdp-brand published', /px$/.test(r.cssVar), JSON.stringify(r));
  await page.close();
}

await browser.close();
if (failures) {
  console.error(`\n${failures} example check(s) failed.`);
  process.exit(1);
}
console.log(`\nAll ${pages.length} examples passed.`);
