#!/usr/bin/env node
// Micro-benchmark of the built package (node scripts/bench.mjs). Run `npm run build` first.
import { DpQualifier, scaledDp, sdp, sdpa, setMetrics, ssp, toDynamicScaledDp, UiModeType } from '../dist/index.js';
import { pwsdp } from '../dist/power.js';

setMetrics({ screenWidthDp: 412, screenHeightDp: 915, density: 2.625 });
const builder = scaledDp(16).screen(UiModeType.TELEVISION, 40).screen(DpQualifier.SMALL_WIDTH, 600, 24);
const N = 20_000_000;

function run(name, fn) {
  let sink = 0;
  for (let i = 0; i < 1e6; i++) sink += fn(i); // warm-up
  const t0 = process.hrtime.bigint();
  for (let i = 0; i < N; i++) sink += fn(i);
  const ns = Number(process.hrtime.bigint() - t0) / N;
  console.log(`${name.padEnd(48)} ${ns.toFixed(2).padStart(7)} ns/op  (${(1e3 / ns).toFixed(1)} M ops/s)`);
  return sink;
}

run('baseline: v * 412 / 300', (v) => (v * 412) / 300);
run('sdp(v)', (v) => sdp(v));
run('sdpa(v)', (v) => sdpa(v));
run('ssp(v)', (v) => ssp(v));
run('pwsdp(v)', (v) => pwsdp(v));
run('toDynamicScaledDp(v, HEIGHT, { applyAspectRatio })', (v) =>
  toDynamicScaledDp(v, DpQualifier.HEIGHT, { applyAspectRatio: true }));
run('builder.sdp (memoized per snapshot)', () => builder.sdp);
