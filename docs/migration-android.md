# Migrating from Android

A side-by-side guide for developers who already use AppDimens Dynamic on Android (Compose or Views). The math, the strategy
prefixes and the suffix rules are the same, so most code ports name for name. The table at the end lists what is different on
the web.

## Setup

| Android | Web |
|---|---|
| `implementation(platform("…:appdimens-dynamic-bom:3.2.0"))` + modules | `npm install webdimens` (one package; strategies are entry points: `webdimens/power`, …) |
| `AppDimensProvider { … }` (Compose) | `install()` once in the entry point, or `useWebDimens()` / `app.use(WebDimens)` / `provideWebDimens()` |
| `DimenCache` / `DimenMetrics` | the runtime: `getMetrics()`, `subscribe()`, `setMetrics()` |

## Dimensions

| Android (Compose) | Android (Views / Kotlin) | Web — JavaScript | Web — class / CSS |
|---|---|---|---|
| `16.sdp` | `16.sdp(context)` | `sdp(16)` · `dimen('16sdp')` | `p:16sdp` · `calc(16 * var(--sdp))` |
| `16.hdp` / `16.wdp` | `16.hdp(context)` | `hdp(16)` / `wdp(16)` | `h:16hdp` · `var(--hdp)` |
| `14.ssp` | `14.ssp(context)` | `ssp(14)` | `fs:14ssp` · `var(--ssp)` |
| `14.sem` | `14.sem(context)` | `sem(14)` | `fs:14sem` · `var(--sem)` |
| `16.sdpa` / `16.sdpi` / `16.sdpia` | same with `context` | `sdpa(16)` / `sdpi(16)` / `sdpia(16)` | `p:16sdpa` · or `class="ad-a"` on a container |
| `16.hdpLw` | `16.hdpLw(context)` | `hdpLw(16)` | `h:16hdpLw` · `var(--hdpLw)` |
| `2.sdpPx` | `2.sdpPx(context)` (`Float` px) | `sdpPx(2)` · `dimen('2sdpPx')` (device px) | — (JS only) |
| `16.sdpPxaPh` | — | `sdpPhaPx(16)` (`Px` always last on the web) | — |
| `16.pwsdp` (`compose.power`) | `DimenPowerDp.pwsdp(context, 16)` | `import { pwsdp } from 'webdimens/power'` | `p:16pwsdp` · `class="ad-power"` |
| `16.toDynamicScaledDp(DpQualifier.HEIGHT, applyAspectRatio = true)` | `16.toDynamicScaledPx(context, …)` | `toDynamicScaledDp(16, DpQualifier.HEIGHT, { applyAspectRatio: true })` / `toDynamicScaledPx` | — |

```kotlin
// Android (Compose)
Text("Title", fontSize = 20.ssp, modifier = Modifier.padding(16.sdp))
```

```html
<!-- Web -->
<h1 class="fs:20ssp p:16sdp">Title</h1>
```

```jsx
// Web, React
<h1 style={dimens({ fontSize: '20ssp', padding: '16sdp' })}>Title</h1>
```

## Facilitators

The argument order follows the Compose functions; options become an object.

| Android | Web | 600 × 900 portrait result |
|---|---|---|
| `10.sdpRotate(30, Orientation.LANDSCAPE)` | `sdpRotate(10, 30)` (landscape is the default) | 20 (portrait → base) |
| `10.sdpRotate(30, orientation = Orientation.PORTRAIT)` | `sdpRotate(10, 30, Orientation.PORTRAIT)` | 60 |
| `10.sdpMode(40, UiModeType.TELEVISION)` | `sdpMode(10, 40, UiModeType.TELEVISION)` | 20 (not a TV) |
| `10.sdpQualifier(20, DpQualifier.SMALL_WIDTH, 600)` | `sdpQualifier(10, 20, DpQualifier.SMALL_WIDTH, 600)` | 40 |
| `10.sdpScreen(30, UiModeType.TELEVISION, DpQualifier.SMALL_WIDTH, 1000)` | `sdpScreen(10, 30, UiModeType.TELEVISION, DpQualifier.SMALL_WIDTH, 1000)` | 20 |
| `…, finalQualifierResolver = DpQualifier.WIDTH, applyAspectRatio = true` | `…, { finalQualifierResolver: DpQualifier.WIDTH, applyAspectRatio: true }` | |
| `16.ssp.sspRotatePlain(24)` style plain branching | `plainRotate(a, b, orientation?)`, `plainMode`, `plainQualifier`, `plainScreen` | |

In classes and CSS the same decisions are conditions: `p:10sdp p@landscape:30sdp`, `p@tv:40sdp`, `p@sw600:20sdp`,
`p@tv@sw1000:30sdp` (see [Declarative units](./declarative.md)).

## Builders

```kotlin
// Android
val pad = 16.scaledDp()
    .aspectRatio(true)
    .screen(UiModeType.TELEVISION, 40)
    .screen(DpQualifier.SMALL_WIDTH, 600, 24)
    .screen(Orientation.LANDSCAPE, 20)
    .sdp
```

```js
// Web
import { scaledDp, UiModeType, DpQualifier, Orientation } from 'webdimens';

const pad = scaledDp(16)
  .aspectRatio(true)
  .screen(UiModeType.TELEVISION, 40)
  .screen(DpQualifier.SMALL_WIDTH, 600, 24)
  .screen(Orientation.LANDSCAPE, 20);
pad.sdp; // resolved for the current window, memoized per snapshot
```

The overloads, the priority (mode + qualifier > mode > qualifier, larger threshold first > orientation) and
`finalQualifierResolver` / `inverter` arguments are the same. Other strategies: `powerDp(16).screen(…).pwsdp`,
`fluidSp(14).fssp`, and so on. The web adds an object form: `.screen({ uiModeType, qualifier: [DpQualifier.SMALL_WIDTH, 600], value: 24 })`.

## Percent `space*`, resize and physical units

| Android | Web |
|---|---|
| `15.spaceW` / `20.spaceSw` / `12.spaceH` | `spaceW(15)` / `spaceSw(20)` / `spaceH(12)` from `webdimens/percent` |
| `25.space(200.dp)` | `space(25, 200)` |
| `autoResizeTextSp(text, minSp, maxSp, stepSp, maxLines)` inside `BoxWithConstraints` | `autoResizeText(element, { min, max, step, maxLines })` from `webdimens/resize` |
| `ResizeBound.FixedDp/FixedSp/Percent` | `resizeFixedDp`, `resizeFixedSp`, `resizePercentSw/W/H`, `resizePercentBox` |
| `10f.mm` · `2.5f.cm` · `1f.inch` | `mm(10)` · `cm(2.5)` · `inch(1)` from `webdimens/units` |

## What is different on the web

| Topic | Android | Web |
|---|---|---|
| Window | `Configuration` of the window | the viewport (`innerWidth` × layout-viewport height), or an element with `createDimenScope()` |
| `dp` | density-independent pixel | CSS px |
| `sp` | scaled by the system font scale | CSS px × (browser default font size / 16) |
| `Px` names | irregular (`sdpPxaPh`, `sspPxa`) | `Px` always last (`sdpPhaPx`, `sspaPx`) |
| Multi-window (`i`) | `Activity.isInMultiWindowMode` | heuristic: window ≥ 10 % narrower than the screen; force with `install({ multiWindow })` |
| UI mode | `Configuration.uiMode` + foldable APIs | user agent + Device Posture / Viewport Segments; force with `install({ uiModeType })` |
| `@mw` condition | — | web-only condition for the multi-window state |
| `density` strategy | `densityDpi / 160` | `devicePixelRatio` |
| Physical units | real `xdpi` | CSS definition (1in = 96 CSS px); calibrate with `setPhysicalCalibration()` |
| `space*Sp` with `fontScale` | geometric length | multiplies by the font scale when `fontScale` is true (default) |
| Declarative forms | — | classes, `data-dimen`, `<style data-webdimens>`, CSS variables, PostCSS, Sass |

A design spec written in dp ports 1:1: `16.dp` in a Figma/Android spec becomes `16sdp`. Keep plain px for values that must not
scale with the viewport, such as hairline borders.

Next: [Declarative units](./declarative.md) · [Back to the index](./README.md)
