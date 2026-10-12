# Concepts

This page explains the model behind every webdimens value: the 300 dp reference, how Android's `dp` / `sp` / `px` map to CSS,
the viewport snapshot, axes, flags, inverters, the token grammar and why each call costs one multiply. Read it before writing
many units; the other pages assume it.

## The 300 dp reference

A design is written in **dp** for a reference window whose smallest side is **300 dp** (height 533 dp). At run time every value is
multiplied by a factor that depends on the current window:

```
sdp(16) = 16 × smallestWidth / 300
```

| Window (CSS px) | smallest width | `sdp(16)` |
|---|---:|---:|
| 300 × 533 (reference) | 300 | 16 |
| 360 × 740 (phone) | 360 | 19.2 |
| 600 × 900 (small tablet) | 600 | 32 |
| 1920 × 1080 (TV) | 1080 | 57.6 |

This is the Android `16.sdp` of AppDimens Dynamic, with the same constants (`BASE_WIDTH_DP = 300`, `BASE_HEIGHT_DP = 533`,
`REFERENCE_ASPECT_RATIO = 1.78`).

## dp, sp and px on the web

| Android | Web | Example on 600 × 900, DPR 2, font scale 1.25 |
|---|---|---|
| `dp` | CSS px (1 CSS px is the web's density-independent pixel) | `sdp(16)` → **32** |
| `sp` | CSS px × font scale | `ssp(16)` → 32 × 1.25 = **40** |
| `em` family (Android `sem`: sp without font scale) | CSS px | `sem(16)` → **32** |
| `px` (the `Px` suffix) | device px = CSS px × `devicePixelRatio` | `sdpPx(16)` → 32 × 2 = **64**, `sspPx(16)` → **80** |

- **Font scale** is the browser's default font size ÷ 16 (the accessibility setting users change), measured once with a hidden
  `font-size: medium` probe. Override it with `install({ fontScale })`; call `refresh()` to measure again.
- Use `Px` values only for canvas, WebGL or other device-pixel APIs. Layout always uses CSS px.

## The viewport snapshot

Every value is computed from one immutable `DimenMetrics` snapshot, the web equivalent of Android's per-window `DimenMetrics`.

| Field | Source on the web |
|---|---|
| `screenWidthDp` | `window.innerWidth` (same basis as `vw`) |
| `screenHeightDp` | layout-viewport height (`document.documentElement.clientHeight` in standards mode): it does not jump when mobile URL bars show or hide |
| `smallestScreenWidthDp` / `smallestWidthDp` | `min(width, height)` |
| `density` | `window.devicePixelRatio` |
| `fontScale` | browser default font size ÷ 16 |
| `orientation`, `isLandscape`, `isPortrait` | `LANDSCAPE` when width > height, otherwise `PORTRAIT` (the CSS `orientation` media feature) |
| `uiModeType` | user-agent and Device Posture / Viewport Segments heuristics, or `install({ uiModeType })` |
| `isInMultiWindowMode` | the window is at least 10 % narrower than the screen (`screen.availWidth` vs `outerWidth`), or `install({ multiWindow })` |

Derived factors are computed once per snapshot: `scale` (`sw / 300`), `screenWidthFactor`, `screenHeightFactor`,
`normalizedAspectRatio` (`(max / min) / 1.78`), `logNormalizedAspectRatio`, `defaultAspectRatioMultiplier`,
`defaultScaledAspectRatioMultiplier`, `powerScale`, `interpolatedScale`, `diagonalScale`, `perimeterScale`, `logarithmicScale`.

```js
import { getMetrics, setMetrics } from 'webdimens';

setMetrics({ screenWidthDp: 600, screenHeightDp: 900, density: 2, fontScale: 1.25 });
const m = getMetrics();
m.smallestWidthDp;          // 600
m.scale;                    // 2
m.orientation;              // 'PORTRAIT'
m.normalizedAspectRatio;    // 0.8427  (1.5 / 1.78)
setMetrics(null);           // back to the live viewport
```

On the server (no `window`) the snapshot is the 300 × 533 reference unless you pin one with `setMetrics()`; see [SSR](./ssr.md).

## Axes

| Axis letter | Qualifier | Reads | Typical use |
|---|---|---|---|
| `s` (`sdp`, `ssp`) | `DpQualifier.SMALL_WIDTH` | `min(width, height)` | spacing, radii, icons, most text |
| `h` (`hdp`, `hsp`) | `DpQualifier.HEIGHT` | height | vertical rhythm, row heights |
| `w` (`wdp`, `wsp`) | `DpQualifier.WIDTH` | width | width-driven columns |

On 600 × 900: `sdp(16)` = 32, `hdp(16)` = 48, `wdp(16)` = 32.

## Flags

| Suffix | Meaning | On 600 × 900 |
|---|---|---|
| *(none)* | plain scaling | `sdp(16)` = 32 |
| `a` | aspect-ratio correction | `sdpa(16)` = 29.81 |
| `i` | ignore multi-window: returns the unscaled value while the window is split / floating | `sdpi(16)` = 32 (or 16 in multi-window) |
| `ia` | both | |

The scaled and percent strategies' `a` variants use `1 + (d − 300) × (1/300 + k × ln(AR / 1.78))`, which noticeably changes
values on very wide or tall windows. The other strategies multiply their factor by `1 + k × ln(AR / 1.78)` with
`k = 0.08 / 30`, a small correction. A custom `k` is available through `toDynamic…({ customSensitivityK })` and the builders.

## Orientation inverters

An inverter swaps the axis in one orientation. They appear in names between the axis and the flags (`sdpPh`, `hdpLwa`).

| Token | Inverter | Rule | 600 × 900 (portrait) | 900 × 600 (landscape) |
|---|---|---|---:|---:|
| `sdpPh` | `SW_TO_PH` | smallest width → **height** in **portrait** | `sdpPh(16)` = 48 | 32 |
| `sdpLh` | `SW_TO_LH` | smallest width → height in landscape | 32 | 32 (height = sw) |
| `sdpPw` | `SW_TO_PW` | smallest width → width in portrait | 32 (width = sw) | 32 |
| `sdpLw` | `SW_TO_LW` | smallest width → width in landscape | 32 | 48 |
| `hdpLw` | `PH_TO_LW` | height → width in landscape | 48 | 48 |
| `hdpPw` | `LH_TO_PW` | height → width in portrait | 32 | 32 |
| `wdpLh` | `PW_TO_LH` | width → height in landscape | 32 | 32 |
| `wdpPh` | `LW_TO_PH` | width → height in portrait | 48 | 48 |

Use them when a size must follow the *long* or *short* side as the device rotates.

## Token grammar

Every name, in JavaScript, classes and CSS variables, follows the Android names:

```
<prefix><axis><kind><inverter>?<flags>?<Px>?
```

| Part | Values |
|---|---|
| prefix (strategy) | `''` scaled · `p` percent · `pw` power · `f` fluid · `a` auto · `dg` diagonal · `fl` fill · `ft` fit · `i` interpolated · `log` logarithmic · `pr` perimeter · `d` density |
| axis | `s` · `h` · `w` |
| kind | `dp` (layout) · `sp` (text × font scale) · `em` (text, no font scale) |
| inverter | `s`: `Ph` `Lh` `Pw` `Lw` · `h`: `Lw` `Pw` · `w`: `Lh` `Ph` |
| flags | `a` · `i` · `ia` |
| `Px` | device pixels (JavaScript only) |

Examples: `sdp`, `sdpa`, `hdpLw`, `wdpPhia`, `ssp`, `semPx`, `pwsdp`, `fhspa`, `logwdpLh`.

```js
import { parseToken } from 'webdimens';
parseToken('pwhdpLwa');
// { name: 'pwhdpLwa', prefix: 'pw', strategy: 'power', axis: 'h', kind: 'dp',
//   inverter: 'Lw', flags: 'a', px: false, slot: 29, css: true }
parseToken('hdpPh'); // null — Ph does not exist on the h axis
```

Each strategy exposes 264 accessors (11 axis variants × 4 flags × 3 kinds × with/without `Px`). CSS variables exist for every
`dp` token and for the `sp` / `em` tokens without an inverter; `Px` tokens and `sp`/`em` tokens with an inverter are
JavaScript-only (`dimen('14sspLw')`, never in classes or CSS).

## Why it is fast: value × factor

Every strategy, axis, inverter and flag reduces to `value × factor`, where the factor depends only on the snapshot. When the
snapshot changes, the runtime fills one `Float64Array` of 44 factors per registered strategy. An accessor such as `sdp(v)` is
then one dirty-flag check and one multiply:

```js
// what sdp(16) does
if (S.dirty) sync();      // only after a resize / orientation / DPR event
return 16 * table[0];     // table[0] = smallestWidth / 300
```

Resize events only mark the snapshot dirty; the next read (or the next animation frame) rebuilds it. See
[Performance](./performance.md).

## The CSS custom properties model

`install()` publishes one custom property per CSS token on `:root`, holding the size of **one unit** in CSS px:

```css
:root:root {
  --sdp: 2px;        /* 600 / 300 */
  --sdpa: 1.8631px;
  --hdp: 3px;
  --ssp: 2.5px;      /* × font scale 1.25 */
  --sem: 2px;
  /* …every registered strategy: --pwsdp, --fsdp, … and --ad-w, --ad-h, --ad-sw, --ad-density, … */
}
```

So `calc(16 * var(--sdp))` is `16sdp`, and every class, `data-dimen` attribute and PostCSS output compiles to exactly that.
When the window changes, only these properties are rewritten (once per frame); the rules that use them never change.
Modifier classes (`ad-a`, `ad-power`, …) work by redirecting these properties inside a subtree. See
[Declarative units](./declarative.md) and [CSS](./css.md).

Next: [Migrating from Android](./migration-android.md) · [Back to the index](./README.md)
