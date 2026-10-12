# webdimens — AppDimens Dynamic for the web

Responsive `dp` / `sp` for the web with **the exact math and the same API names as
[AppDimens Dynamic](https://github.com/bodenberg/appdimens-dynamic) 3.2.0 for Android**:
`sdp`, `hdp`, `wdp`, `ssp`, `sem`, the `a` / `i` / `ia` / `Px` suffixes, orientation
inverters, `Rotate` / `Mode` / `Qualifier` / `Screen` facilitators, `scaledDp().screen()`
builders, 12 scaling strategies, resize and physical units.

> **Languages:** English · [Português (BR)](README.pt-BR.md)

- **Fast.** Factors are precomputed once per viewport change; each call is one branch and one multiply (~11 ns, 80–90 M ops/s in Node).
- **Declarative CSS.** Every token is published as a CSS custom property: `padding: calc(16 * var(--sdp))`. Layout follows the viewport with no JS re-render. SCSS functions (`padding: sdp(16)`) are included.
- **Works without JS too.** Fallback stylesheets give exact pure-CSS values for the linear strategies (and close approximations for the rest) before hydration or with no JS at all.
- **Tree-shakable modules**, mirroring Android's per-strategy artifacts: `webdimens`, `webdimens/power`, `webdimens/fluid`, …
- **Framework bindings** for React, Vue 3, Svelte and Angular (signals). A CDN `<script>` build is also available.
- **Typed, no dependencies, SSR-safe.**

---

## Install

```bash
npm install webdimens
```

```html
<!-- CDN: everything on window.WebDimens, CSS variables installed on load (≈10 KB gzip) -->
<script src="https://cdn.jsdelivr.net/npm/webdimens@3.2.0/dist/webdimens.global.js"></script>
<!-- or scaled only (≈7 KB gzip) -->
<script src="https://cdn.jsdelivr.net/npm/webdimens@3.2.0/dist/webdimens.lite.global.js"></script>
```

## Quick start

### 1. CSS (declarative, recommended for layout)

```js
import { install } from 'webdimens';
install(); // publishes --sdp, --hdp, --wdp, --ssp, --sem, … and keeps them updated
```

```css
@import 'webdimens/css'; /* optional: pure-CSS values before JS runs / without JS */

.card {
  padding: calc(16 * var(--sdp));       /* Android: 16.sdp  */
  border-radius: calc(12 * var(--sdpa));/* 12.sdpa          */
  height: calc(120 * var(--hdp));       /* 120.hdp          */
  font-size: calc(14 * var(--ssp));     /* 14.ssp           */
}
```

With Sass:

```scss
@use 'webdimens/scss' as d;
.card { padding: d.sdp(16); font-size: d.ssp(14); margin: d.pwhdpa(8); }
```

### 2. JavaScript (same names as Android `Number` extensions)

```js
import { sdp, hdp, ssp, sdpa, sdpPx, sdpRotate, scaledDp, Orientation, UiModeType, DpQualifier } from 'webdimens';

el.style.padding = `${sdp(16)}px`;            // 16.sdp  → CSS px
ctx.lineWidth = sdpPx(2);                      // 2.sdpPx → device px (× devicePixelRatio), for canvas
title.style.fontSize = `${ssp(20)}px`;         // 20.ssp  → CSS px × user font scale

sdpRotate(80, 50, Orientation.LANDSCAPE);     // 80.sdpRotate(50, LANDSCAPE)

const gutter = scaledDp(16)                    // 16.scaledDp()
  .screen(UiModeType.TELEVISION, 40)
  .screen(DpQualifier.SMALL_WIDTH, 600, 24);
gutter.sdp;                                    // resolved for the current window (memoized)
```

### 3. Frameworks

```tsx
// React
import { sdp, ssp, install } from 'webdimens';
import { useDimens, useDimen } from 'webdimens/react';
install();
function Card() {
  useDimens();                                 // re-render when the viewport changes
  return <div style={{ padding: sdp(16), fontSize: ssp(14) }} />;
}
```

```ts
// Vue 3
import { sdp } from 'webdimens';
import { WebDimens, useDimen } from 'webdimens/vue';
app.use(WebDimens);
const pad = useDimen(() => sdp(16));           // ComputedRef<number>
```

```svelte
<!-- Svelte -->
<script>
  import { sdp } from 'webdimens';
  import { dimen } from 'webdimens/svelte';
  const pad = dimen(() => sdp(16));
</script>
<div style="padding: {$pad}px"></div>
```

```ts
// Angular 16+
bootstrapApplication(App, { providers: [provideWebDimens()] });
export class Card { pad = injectDimen(() => sdp(16)); } // Signal<number>
```

> **SSR:** on the server the snapshot is the 300×533 reference (or one you pin with
> `setMetrics`). For server-rendered markup prefer the CSS tokens
> (`cssDimen('sdp', 16)` → `"calc(16 * var(--sdp))"`); they never cause hydration mismatches.

---

## Units: how Android maps to the web

| Android | Web | Notes |
|---|---|---|
| `dp` | CSS px | 1 CSS px is the web's density-independent pixel |
| `sp` | CSS px × font scale | font scale = browser default font size / 16 (accessibility setting) |
| `px` (the `Px` suffix) | device px | CSS px × `devicePixelRatio`, for canvas / WebGL |
| window `Configuration` | viewport: `innerWidth` × layout-viewport height | height ignores mobile URL-bar show/hide; or an element, with `createDimenScope` |
| `smallestScreenWidthDp` | `min(width, height)` | |
| `UiModeType` | heuristics + Device Posture / Viewport Segments APIs | override with `configure({ uiModeType })` |
| multi-window (`i`) | the window is ≥ 10 % narrower than the screen | override with `configure({ multiWindow })` |

## API naming (identical to Android)

`<prefix><axis><kind><inverter><flags>[Px]`

| Part | Values |
|---|---|
| prefix (strategy) | `''` scaled · `p` percent · `pw` power · `f` fluid · `a` auto · `dg` diagonal · `fl` fill · `ft` fit · `i` interpolated · `log` logarithmic · `pr` perimeter · `d` density |
| axis | `s` smallest width · `h` height · `w` width |
| kind | `dp` layout · `sp` text × font scale · `em` text without font scale |
| inverter | `Ph` `Lh` `Pw` `Lw` on `sdp`; `Lw` `Pw` on `hdp`; `Lh` `Ph` on `wdp` |
| flags | `a` aspect ratio · `i` ignore multi-window · `ia` both |
| `Px` | device pixels instead of CSS px |

Examples: `sdp`, `sdpa`, `hdpLw`, `wdpPhia`, `ssp`, `semPx`, `pwsdp`, `fhspa`, `logwdpLh`.
Each name exists as a function (`sdpa(16)`) and as a CSS token (`var(--sdpa)`). CSS tokens
cover every `dp` variant, plus the `sp` and `em` variants without inverters.

> **One difference:** Android's `Px` property names are irregular (`sdpPxaPh`, `sspPxa`).
> On the web the suffix is always last: `sdpPhaPx`, `sspaPx`.

### Per strategy

| Name pattern | What it does |
|---|---|
| `sdp(v)` … (264 accessors per strategy) | value → CSS px (or device px with `Px`) |
| `toDynamicScaledDp(v, qualifier?, { inverter, ignoreMultiWindows, applyAspectRatio, customSensitivityK })` | any combination; also `…Px`, `…Sp`, `…SpPx` |
| `sdpRotate(v, alt, orientation?, opts?)` | `alt` in that orientation |
| `sdpMode(v, alt, uiModeType, opts?)` | `alt` for that UI mode |
| `sdpQualifier(v, alt, DpQualifier, minDp, opts?)` | `alt` when the axis is ≥ `minDp` |
| `sdpScreen(v, alt, uiModeType, DpQualifier, minDp, opts?)` | both conditions |
| …also `hdp*`, `wdp*`, `ssp*`, `hsp*`, `wsp*`, and a `Px` variant of each | `opts.finalQualifierResolver` picks the axis for `alt` |
| `scaledDp(v)` / `scaledSp(v)` → builder | `.aspectRatio(true, k?)`, `.ignoreMultiWindows()`, `.screen(...)`, then `.sdp` `.hdp` `.wdp` `.ssp` `.sem` `.sdpPx` … |

In other strategies swap the prefix and the builder name: `pwsdpRotate`,
`powerDp(16).screen(...).pwsdp`, `toDynamicPowerPx`.

`.screen()` takes the same overloads and priority as Android: (1) UI mode + qualifier,
(2) UI mode, (3) qualifier, with larger thresholds first, (4) orientation. It also accepts an
object form: `.screen({ uiModeType, qualifier: [DpQualifier.SMALL_WIDTH, 600], orientation, value })`.

Plain branching, with no scaling: `plainRotate`, `plainMode`, `plainQualifier`, `plainScreen`.

## Strategies

Start with **scaled**. Switch only when visual QA asks for a different curve.

| Strategy | Import | Formula (d = axis in dp) |
|---|---|---|
| Scaled | `webdimens` | `v · d/300`; `a`: `v · (1 + (d−300)(1/300 + k·ln(AR/1.78)))` |
| Percent | `webdimens/percent` | `v · d/300` (+ literal `spaceW(10)` = 10 % of width, `spaceSw`, `spaceH`, `space(p, ref)`) |
| Power | `webdimens/power` | `v · (d/300)^0.75` |
| Fluid | `webdimens/fluid` | `v · lerp(0.8 → 1.2)` between 320 and 768 dp |
| Auto | `webdimens/auto` | linear up to 480 dp, then `1.6 + 0.4·ln(1 + (d−480)/300)` |
| Logarithmic | `webdimens/logarithmic` | `1 ± 0.4·ln(d/300)` |
| Interpolated | `webdimens/interpolated` | `1 + (d/300 − 1)·0.5` |
| Diagonal | `webdimens/diagonal` | `√(w² + h²) / 611.63` |
| Perimeter | `webdimens/perimeter` | `(w + h) / 833` |
| Fill / Fit | `webdimens/fill`, `webdimens/fit` | `max` / `min(sw/300, max/533)` |
| Density | `webdimens/density` | `v · devicePixelRatio` |

With `a`, the satellite strategies multiply by `1 + k·ln(AR/1.78)` (default `k = 0.08/30`).
Every formula is a direct port of the Kotlin kernels. `tests/parity.test.ts` checks all
strategies × axes × inverters × flags against an independent transcription on 12 window sizes.

Import a strategy module to register it; its CSS tokens are published from then on.

## Runtime

```ts
import { install, configure, subscribe, getMetrics, setMetrics, refresh, flush, uninstall } from 'webdimens';

install({ cssVariables: true });                            // start tracking + CSS tokens
configure({ uiModeType: UiModeType.TELEVISION, fontScale: 1.2, multiWindow: false,
            measure: () => ({ width: innerWidth, height: innerHeight }), cssNonce: '…' });
const off = subscribe((m) => console.log(m.screenWidthDp)); // at most once per frame
getMetrics();      // DimenMetrics snapshot (immutable; scale, AR, strategy factors, …)
setMetrics({ screenWidthDp: 412, screenHeightDp: 915 });    // pin (SSR, tests, previews); null = live
refresh();         // re-measure (e.g. after the user changed the default font size)
```

Resize, orientation, DPR and posture events only mark the snapshot dirty. The next read
rebuilds it synchronously, so values are never stale. CSS and subscribers are flushed once
per animation frame. CSS goes through a constructable stylesheet, which is CSP-safe; it falls
back to a `<style>` with `cssNonce`.

### Element scopes (Android per-window snapshots)

```ts
import { createDimenScope } from 'webdimens';
const scope = createDimenScope(panel);   // ResizeObserver on the element
// inside .panel, var(--sdp) now scales with the panel, not the viewport
scope.dp(16); scope.metrics; scope.disconnect();
```

React: `useDimenScope(ref)`.

## Resize (`webdimens/resize`)

Constraint-based auto-fit: the **largest** step in `[min, max]` that still fits (binary search).

```ts
import { autoResizeText, fittingTextSize, fittingTextPx, fittingBoxPx, resizePercentW, resizeFixedDp } from 'webdimens/resize';

const ctl = autoResizeText(titleEl, { min: 12, max: 34, step: 1, maxLines: 2 }); // keeps fitting on resize / text change
fittingTextPx({ text, maxWidth: 240, maxLines: 1, font: '600 16px Inter' }); // canvas, no reflow
fittingBoxPx(48, resizePercentW(30), 4, availablePx);
```

Bounds are numbers (sp), `resizeFixedDp`, `resizeFixedSp`, `resizePercentSw` / `W` / `H`
(viewport %), or `resizePercentBox(p, AutoResizePercentBasis.MIN_SIDE)` (box %). The element
must have a constrained box. In a grid or flex item, set `min-width: 0` or `minmax(0, 1fr)`.

## Physical units (`webdimens/units`)

`mm(10)`, `cm(2.5)`, `inch(1)` → dp. Also `toPxFromMm` (device px), `toSpFromMm`,
`convertMmToInch`, …, `unitSizeInDp(UnitType.MM)`, `radius(48, UnitType.MM)`. Browsers don't
expose the real DPI, so these use the CSS definition (1in = 96 px). Calibrate known panels with
`setPhysicalCalibration(pxPerInch)`. In CSS, just write `10mm`.

## Performance

`node scripts/bench.mjs` (after `npm run build`), Node 22:

| call | ns/op |
|---|---|
| `sdp(v)` | ~11 |
| `sdpa(v)`, `ssp(v)`, `pwsdp(v)` | ~12–13 |
| `toDynamicScaledDp(v, HEIGHT, { applyAspectRatio })` | ~30 |
| `builder.sdp` (memoized per snapshot) | ~26 |

The figures include the harness's indirect call (the baseline inline multiply measures ~2 ns).
There are no allocations on the hot path. A tree-shaken app import (`sdp`, `ssp`, `install`,
runtime and CSS publishing) bundles to ≈4.4 KB min+gzip, and each additional strategy module
adds ≈0.3 KB gzip.

## Development

```bash
npm run generate   # regenerate src/generated, css/, scss/ from scripts/generate.mjs
npm test           # vitest (parity, API, runtime, resize, units, frameworks, assets)
npm run check      # generated-files check + typecheck + tests + build + dist verification
node scripts/browser-check.mjs   # real Chromium smoke test (Playwright)
```

## License

Apache-2.0 © Jean Bodenberg
