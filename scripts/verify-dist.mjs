#!/usr/bin/env node
/**
 * Post-build verification of the publishable package:
 * - every `exports` target exists;
 * - ESM and CJS entries load and resolve values;
 * - the CDN bundles install `window.WebDimens` in a simulated browser global;
 * - package.json version === VERSION constant.
 */
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import vm from 'node:vm';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
const require = createRequire(import.meta.url);
let failures = 0;
const fail = (msg) => {
  failures++;
  console.error(`✗ ${msg}`);
};
const ok = (msg) => console.log(`✓ ${msg}`);

// 1. exports targets
const targets = [];
const collect = (v) => {
  if (typeof v === 'string') targets.push(v);
  else if (v && typeof v === 'object') Object.values(v).forEach(collect);
};
collect(pkg.exports);
for (const t of targets) if (!existsSync(join(root, t))) fail(`missing export target ${t}`);
ok(`${targets.length} export targets checked`);

// 2. ESM + CJS
const esm = await import(pathToFileURL(join(root, 'dist/index.js')).href);
esm.setMetrics({ screenWidthDp: 600, screenHeightDp: 900 });
if (Math.abs(esm.sdp(16) - 32) > 1e-9) fail('ESM sdp(16) != 32 on a 600 dp window');
if (esm.VERSION !== pkg.version) fail(`VERSION ${esm.VERSION} != package.json ${pkg.version}`);
ok('ESM entry resolves');

const cjs = require(join(root, 'dist/index.cjs'));
cjs.setMetrics({ screenWidthDp: 450, screenHeightDp: 900 });
if (Math.abs(cjs.sdp(10) - 15) > 1e-9) fail('CJS sdp(10) != 15 on a 450 dp window');
ok('CJS entry resolves');

for (const sub of ['percent', 'power', 'fluid', 'auto', 'diagonal', 'fill', 'fit', 'interpolated', 'logarithmic', 'perimeter', 'density', 'resize', 'units', 'svelte']) {
  const m = await import(pathToFileURL(join(root, `dist/${sub}.js`)).href);
  if (Object.keys(m).length === 0) fail(`dist/${sub}.js has no exports`);
  require(join(root, `dist/${sub}.cjs`));
}
ok('strategy / resize / units / svelte entries load (ESM + CJS)');

// 3. CDN bundles in a fake browser global
for (const file of ['dist/webdimens.global.js', 'dist/webdimens.lite.global.js']) {
  const listeners = {};
  const window = {
    innerWidth: 720,
    innerHeight: 1280,
    devicePixelRatio: 2,
    outerWidth: 720,
    screen: { availWidth: 720 },
    addEventListener: (t, f) => (listeners[t] = f),
    removeEventListener: () => {},
    matchMedia: () => ({ addEventListener() {}, removeEventListener() {} }),
    requestAnimationFrame: (cb) => setTimeout(cb, 0),
    cancelAnimationFrame: clearTimeout,
    setTimeout,
  };
  const style = { textContent: '' };
  const document = {
    currentScript: null,
    documentElement: { appendChild() {} },
    head: { appendChild() {} },
    getElementById: () => null,
    createElement: () => ({ style: {}, remove() {} }),
  };
  window.document = document;
  const ctx = vm.createContext({
    window,
    document,
    navigator: { userAgent: 'node' },
    getComputedStyle: () => ({ fontSize: '16px' }),
    setTimeout,
    clearTimeout,
    console,
  });
  ctx.self = ctx.window;
  vm.runInContext(readFileSync(join(root, file), 'utf8'), ctx);
  const api = window.WebDimens;
  if (!api) {
    fail(`${file} did not define window.WebDimens`);
    continue;
  }
  if (Math.abs(api.sdp(16) - 38.4) > 1e-9) fail(`${file}: sdp(16) != 38.4 on a 720 dp window`);
  if (file.includes('.lite.') === false && typeof api.pwsdp !== 'function') fail(`${file}: missing power API`);
  void style;
  ok(`${file} defines window.WebDimens (${Object.keys(api).length} members)`);
}

// 4. CSS / SCSS assets
for (const f of ['css/webdimens.css', 'css/all.css', 'scss/_webdimens.scss']) {
  if (!existsSync(join(root, f))) fail(`missing ${f}`);
}
ok('CSS / SCSS assets present');

if (failures) {
  console.error(`\n${failures} verification failure(s).`);
  process.exit(1);
}
console.log('\nPackage verified.');
