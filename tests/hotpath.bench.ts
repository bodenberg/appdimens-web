import { bench, describe } from 'vitest';
import { DpQualifier, scaledDp, sdp, sdpa, setMetrics, ssp, toDynamicScaledDp, UiModeType } from '../src/index';
import { pwsdp } from '../src/power';

setMetrics({ screenWidthDp: 412, screenHeightDp: 915, density: 2.625 });
let sink = 0;
const builder = scaledDp(16).screen(UiModeType.TELEVISION, 40).screen(DpQualifier.SMALL_WIDTH, 600, 24);

describe('hot path (1000 resolutions per iteration)', () => {
  bench('baseline: inline v * 412 / 300', () => {
    for (let i = 0; i < 1000; i++) sink += (i * 412) / 300;
  });
  bench('sdp(v)', () => {
    for (let i = 0; i < 1000; i++) sink += sdp(i);
  });
  bench('sdpa(v)', () => {
    for (let i = 0; i < 1000; i++) sink += sdpa(i);
  });
  bench('ssp(v)', () => {
    for (let i = 0; i < 1000; i++) sink += ssp(i);
  });
  bench('pwsdp(v) (power)', () => {
    for (let i = 0; i < 1000; i++) sink += pwsdp(i);
  });
  bench('toDynamicScaledDp(v, HEIGHT, {applyAspectRatio})', () => {
    for (let i = 0; i < 1000; i++) sink += toDynamicScaledDp(i, DpQualifier.HEIGHT, { applyAspectRatio: true });
  });
  bench('builder.sdp (memoized)', () => {
    for (let i = 0; i < 1000; i++) sink += builder.sdp;
  });
});
