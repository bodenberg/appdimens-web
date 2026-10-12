#!/usr/bin/env node
// Prints the docs comparison table: 16 dp through every strategy on reference windows.
// Run `npm run build` first. Output is pasted into docs/strategies.md (and pt-BR).
import { setMetrics } from '../dist/index.js';
const mods = {
  scaled: ['', await import('../dist/index.js')], percent: ['p', await import('../dist/percent.js')],
  power: ['pw', await import('../dist/power.js')], fluid: ['f', await import('../dist/fluid.js')],
  auto: ['a', await import('../dist/auto.js')], logarithmic: ['log', await import('../dist/logarithmic.js')],
  interpolated: ['i', await import('../dist/interpolated.js')], diagonal: ['dg', await import('../dist/diagonal.js')],
  perimeter: ['pr', await import('../dist/perimeter.js')], fill: ['fl', await import('../dist/fill.js')],
  fit: ['ft', await import('../dist/fit.js')], density: ['d', await import('../dist/density.js')],
};
const windows = [
  ['Small phone 320×640', 320, 640, 2], ['Phone 412×915', 412, 915, 2.625], ['Tablet 768×1024', 768, 1024, 2],
  ['Laptop 1280×800', 1280, 800, 1], ['TV 1920×1080', 1920, 1080, 1],
];
const head = `| Strategy (16 dp) | ${windows.map((w) => w[0]).join(' | ')} |`;
const sep = `|---|${windows.map(() => '---:').join('|')}|`;
for (const flag of ['', 'a']) {
  console.log(flag ? '\n`a` (aspect ratio) variants:\n' : '`s` axis, no flags:\n');
  console.log(head);
  console.log(sep);
  for (const [id, [p, m]] of Object.entries(mods)) {
    const cells = windows.map(([, w, h, dpr]) => {
      setMetrics({ screenWidthDp: w, screenHeightDp: h, density: dpr });
      return m[`${p}sdp${flag}`](16).toFixed(1);
    });
    console.log(`| \`${p}sdp${flag}\` ${id} | ${cells.join(' | ')} |`);
  }
}
