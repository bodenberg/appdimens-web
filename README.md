# webdimens — AppDimens Dynamic for the web

Responsive `dp` / `sp` for the web with **the exact math and the same API names as
[AppDimens Dynamic](https://github.com/bodenberg/appdimens-dynamic) 3.2.0 for Android**:
`sdp`, `hdp`, `wdp`, `ssp`, `sem`, the `a` / `i` / `ia` / `Px` suffixes, orientation
inverters, `Rotate` / `Mode` / `Qualifier` / `Screen` facilitators, `scaledDp().screen()`
builders, 12 scaling strategies, resize and physical units.

> **Languages:** English · [Português (BR)](README.pt-BR.md)
>
> **Full documentation:** [docs/](docs/README.md) — concepts, declarative units, CSS/PostCSS, JavaScript, strategies, frameworks, SSR, runtime, resize, units, recipes, API reference · **Runnable demos:** [examples/](examples/README.md)

- **Fast.** Factors are precomputed once per viewport change; each call is one branch and one multiply (~9 ns, ~100 M ops/s in Node).
- **Write units, not px.** `class="p:16sdp fs@tv:28ssp"`, `data-dimen="padding: 8sdp 16sdp"`, `padding: 16sdp` in CSS (PostCSS), `dimen('14ssp')` in JS. Conditions use Android qualifiers (`@landscape`, `@sw600`, `@tv`), and modifier classes (`ad-a`, `ad-i`, `ad-power`) set flags or the strategy for a whole subtree.
- **Declarative CSS.** Every token is published as a CSS custom property (`var(--sdp)`), so layout follows the viewport with no JS re-render. SCSS functions are included.
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
<!-- CDN: everything on window.WebDimens, CSS variables installed on load (≈15 KB gzip) -->
<script src="https://cdn.jsdelivr.net/npm/webdimens@3/dist/webdimens.global.js"></script>
<!-- or scaled only (≈12 KB gzip) -->
<script src="https://cdn.jsdelivr.net/npm/webdimens@3/dist/webdimens.lite.global.js"></script>
```

## Quick start — write `16sdp` instead of `16px`

```js
import { install } from 'webdimens';
install(); // viewport tracking + CSS variables + declarative classes (CDN script: automatic)
```

The same units (`16sdp`, `14ssp`, `12sspa`, `8hdpLw`, `10pwsdp` …) work everywhere:

### 1. Classes — no CSS file needed

```html
<div class="p:16sdp r:12sdp fs:14ssp">…</div>                     <!-- padding 16.sdp, radius 12.sdp, font 14.ssp -->
<div class="m:8sdp_16sdp w:120wdp h:48hdp">…</div>               <!-- "_" = space (multi-value) -->
<h1 class="fs:20ssp fs@landscape:24ssp fs@sw600:28ssp fs@tv:40ssp">…</h1>
<div class="p@tv@sw600:48sdp p:16sdp!">…</div>                   <!-- "!" = !important -->
```

`prop[@condition…]:value`. Conditions mirror Android qualifiers and `.screen()` rules:

| Condition | Meaning | Android equivalent |
|---|---|---|
| `@landscape` / `@portrait` | orientation | `Orientation.LANDSCAPE` / `PORTRAIT` |
| `@sw600` · `@w600` · `@h600` (`dp` optional) | smallest width / width / height ≥ 600 dp | `DpQualifier` + value (`values-sw600dp`) |
| `@tv` `@car` `@watch` `@desk` `@appliance` `@vr` `@normal` | UI mode | `UiModeType` |
| `@fold-open` `@fold-half` `@fold-closed` `@flip-open` `@flip-half` `@flip-closed` | foldable posture | `UiModeType.FOLD_*` / `FLIP_*` |
| `@mw` | split / floating window | multi-window |

Combine them (`p@tv@sw600:48sdp`). Priority is the Android `.screen()` one, whatever the class order:
UI mode + qualifier > UI mode > qualifier (larger threshold wins) > orientation > default.

Short property names: `p pt pr pb pl px py ps pe m mt mr mb ml mx my ms me w h size minw minh maxw maxh fs lh ls gap gapx gapy r radius bw ow basis indent`.
Any CSS property (`border-top-width:2sdp`) and custom properties (`--gap:12sdp`) work too. Classes without a unit
token (e.g. Tailwind's `hover:bg-red-500`) are ignored.

### 2. Modifier classes — flags and strategy for a whole subtree

```html
<section class="ad-a">  … every sdp/ssp inside behaves as sdpa/sspa (aspect ratio)       </section>
<section class="ad-i">  … ignore multi-window (sdpi)                                       </section>
<section class="ad-ia"> … both                                                           </section>
<section class="ad-power"> … --sdp, --ssp, p:16sdp … use the power strategy (registered automatically) </section>
```

They nest and combine (`class="ad-fluid ad-a"`). Explicit tokens such as `16sdpia` or `16pwsdp` also work anywhere.

### 3. `data-dimen` — several declarations in one attribute

```html
<div data-dimen="padding: 8sdp 16sdp; font-size: 14ssp; padding@landscape: 12sdp 24sdp; font-size@tv: 28ssp">
```

### 4. CSS files

With the PostCSS plugin (Vite, Next, webpack… zero runtime cost):

```js
// postcss.config.js
import webdimens from 'webdimens/postcss';
export default { plugins: [webdimens()] };
```

```css
.card {
  padding: 8sdp 16sdp;              /* → calc(8 * var(--sdp)) calc(16 * var(--sdp)) */
  font-size: 14ssp;
  @dimen landscape { padding: 12sdp 24sdp; }
  @dimen sw600 { padding: 32sdp; }
  @dimen tv sw600 { font-size: 28ssp; }
}
```

Without a build step, use `<style data-webdimens>` (compiled once by the runtime). With Sass: `@use 'webdimens/scss' as d; padding: d.sdp(16);`.
Plain CSS also works directly with the custom properties: `padding: calc(16 * var(--sdp))`.

### 5. JavaScript

```jsx
import { dimen, dimenCss, dimens, dimensPx, sdp, ssp, sdpa, hdpLw, sdpRotate, scaledDp, Orientation, UiModeType, DpQualifier } from 'webdimens';

dimen('16sdp');                                   // 19.2 (CSS px now)  — any token: '14sspa', '2sdpPx', '10pwsdp'
el.style.padding = dimenCss('8sdp 16sdp');          // responsive calc() string
<div style={dimens({ padding: '8sdp 16sdp', fontSize: '14ssp' })} />   // style object, responsive, SSR-safe
<div style={dimensPx({ width: '120wdp' })} />                          // style object in px (re-render on change)

sdp(16); ssp(14); sdpa(16); hdpLw(20);            // Android names as functions
sdpRotate(80, 50, Orientation.LANDSCAPE);         // 80.sdpRotate(50, LANDSCAPE)
scaledDp(16).screen(UiModeType.TELEVISION, 40).screen(DpQualifier.SMALL_WIDTH, 600, 24).sdp
```

### Frameworks

```tsx
// React — classes and dimens() need no re-render; JS numbers do (useDimens()).
import { useDimens, useDimen } from 'webdimens/react';
<div className="p:16sdp fs:14ssp p@tv:40sdp" />
<div style={dimens({ padding: '16sdp' })} />
const size = useDimen(() => dimen('48sdp'));
```

```ts
// Vue 3:  app.use(WebDimens) from 'webdimens/vue';   const pad = useDimen(() => sdp(16))
// Svelte: import { dimen } from 'webdimens/svelte';  const pad = dimen(() => sdp(16))  → {$pad}
// Angular 16+: providers: [provideWebDimens()];        pad = injectDimen(() => sdp(16))
```

> **SSR:** the markup is identical on server and client. Class and `data-dimen` rules are CSS, so pre-compile them for the first paint with `dimenClassesToCss(['p:16sdp', …])` or the PostCSS plugin. `dimens()` and the `var(--sdp)` tokens need the tokens to exist, so also import `webdimens/css` (pure-CSS fallback).

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
| `Px` | device pixels instead of CSS px. JS only: `dimen`, `dimensPx`, the `…Px` functions (not in classes, `data-dimen`, `dimens()` or CSS) |

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

A strategy registers itself on first use (a JS token, a class or `data-dimen` value, an `ad-<strategy>` class); its CSS tokens
are published from then on. For hand-written `var(--fsdp)` or PostCSS output, list it: `install({ strategies: ['fluid'] })`.

## Custom strategies (`webdimens/custom`)

Define your **own** scaling law when none of the 12 built-ins fits. You can also share one law across apps and platforms: the same JSON works on Android, iOS, Flutter, React Native, KMP, Games and .NET.

The simplest way is to write the math as ordinary TypeScript on one line. The editor autocompletes `base`, `sw`, `width`, `tablet`, `pow`, `clamp`…, and typos are type errors:

```ts
import { cdp, csp, customScaleStrategy, scalingFormula } from 'webdimens/custom';

const product = customScaleStrategy(({ width, clamp }) => clamp(width / 360, 0.85, 1.8)); // factor × every value
const hud = scalingFormula(({ base, sw, pow }) => base * pow(sw / 360, 0.8));           // final value (base = 16 in cdp(16, hud))
cdp(16, product);
csp(18, hud);
cdp(16, 'base * pow(sw / 360, 0.8)');   // same thing as text, for JSON / remote config
```

For rules per device, factor bounds or a font-scale policy, use the full configuration:

```ts
import { defineScalingStrategy, cdp, csp } from 'webdimens/custom';

const brand = defineScalingStrategy({
  id: 'brand',
  reference: { width: 360, height: 640 },
  curve: { type: 'power', exponent: 0.8 },
  clamp: { min: 0.85, max: 1.6 },
  rules: [{ when: { device: ['tablet', 'desktop'] }, set: { curve: { type: 'logarithmic', k: 0.4 } } }],
});

cdp(16, brand);            // CSS px · csp(14, brand) for text
brand.css(16);             // "calc(16 * var(--cdp-brand))"
```

```css
.card { padding: 8cdp-brand 16cdp-brand; font-size: 14csp-brand; }   /* PostCSS / dimens() */
```

The module also covers:
- Presets: `CustomPresets.TV_SAFE`, `TABLET_FRIENDLY`, `WEARABLE`, `GAME_HUD`…
- `BuiltInStrategies.POWER.extend(…)` and `loadScalingStrategies(json)`.
- React / Vue / Svelte / Angular helpers (`useScalingStrategy`).

Guide: [docs/custom.md](docs/custom.md).

## Runtime

```ts
import { install, configure, subscribe, getMetrics, setMetrics, refresh, flush, flushDeclarative, uninstall } from 'webdimens';

install({ cssVariables: true, declarative: true });         // tracking + CSS tokens + class/data-dimen compiler
configure({ uiModeType: UiModeType.TELEVISION, fontScale: 1.2, multiWindow: false,
            measure: () => ({ width: innerWidth, height: innerHeight }), cssNonce: '…' });
const off = subscribe((m) => console.log(m.screenWidthDp)); // at most once per frame
getMetrics();      // DimenMetrics snapshot (immutable; scale, AR, strategy factors, …)
setMetrics({ screenWidthDp: 412, screenHeightDp: 915 });    // pin (SSR, tests, previews); null = live
refresh();         // re-measure (e.g. after the user changed the default font size)
flushDeclarative(); // compile classes and data-dimen added since the last frame (tests, before a layout read)
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
| `sdp(v)` | ~9 |
| `sdpa(v)`, `ssp(v)`, `pwsdp(v)` | ~9–11 |
| `toDynamicScaledDp(v, HEIGHT, { applyAspectRatio })` | ~27 |
| `builder.sdp` (memoized per snapshot) | ~18 |

The figures include the harness's indirect call (the baseline inline multiply measures ~2 ns).
There are no allocations on the hot path. Bundled and minified with gzip: `import { sdp }` ≈5.3 KB;
`install()` (runtime, CSS variables, declarative compiler and every strategy definition) ≈8.8 KB.

## Development

The published package runs on Node 18+ (and every modern browser). Developing it requires **Node 22+** (vitest 5 / jsdom 30).

```bash
npm run generate   # regenerate src/generated, css/, scss/ from scripts/generate.mjs
npm test           # vitest (parity, API, runtime, declarative, resize, units, frameworks, assets)
npm run check      # generated-files check + typecheck + tests + build + dist verification
node scripts/browser-check.mjs   # real Chromium smoke test (Playwright)
```

## Publishing (maintainers)

npm, Yarn and pnpm share the npm registry, so one publish serves all three:

```bash
npm login
npm publish --access public      # prepublishOnly runs `npm run check` first
# users: npm i webdimens · yarn add webdimens · pnpm add webdimens
```

## License

Apache-2.0 © Jean Bodenberg
