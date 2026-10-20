# webdimens — module map and Android ↔ web

## Modules (npm entry points)

| Entry | Contents | Android artifact |
|---|---|---|
| `webdimens` | runtime, scaled strategy (`sdp`…), tokens (`dimen`, `dimens`), declarative compiler, builders, scopes, enums | `appdimens-dynamic` |
| `webdimens/<strategy>` | percent (+ `space*`), power, fluid, auto, diagonal, fill, fit, interpolated, logarithmic, perimeter, density | `appdimens-dynamic-<strategy>` |
| `webdimens/resize` | `autoResizeText`, `fittingTextSize`, `fittingTextPx`, `fittingBoxPx`, bounds | `appdimens-dynamic-resize` |
| `webdimens/units` | `mm`, `cm`, `inch`, conversions, `radius` | `appdimens-dynamic-units` |
| `webdimens/custom` | custom strategies: `defineScalingStrategy`, `loadScalingStrategies`, `cdp` / `csp` / `cdpCss`, `CustomPresets`, `BuiltInStrategies`, CSS vars `--cdp-<id>` | `appdimens-dynamic-custom` |
| `webdimens/postcss` | PostCSS plugin (`16sdp` in CSS, `@dimen` blocks) | — |
| `webdimens/react` · `/vue` · `/svelte` · `/angular` | framework bindings | Compose `AppDimensProvider` |
| `webdimens/css` · `webdimens/css/all.css` | pure-CSS fallback tokens | — |
| `webdimens/scss` | Sass functions `sdp(16)` | — |
| `dist/webdimens.global.js` | CDN bundle (`window.WebDimens`, auto-install) | — |

## Android concepts

| Android | Web |
|---|---|
| `16.sdp` (Compose) / `DimenSdp.sdp(ctx, 16)` | `sdp(16)` · `dimen('16sdp')` · `class="p:16sdp"` · `calc(16 * var(--sdp))` |
| `dp` / `sp` / `px` | CSS px / CSS px × font scale / device px (`Px` suffix) |
| `Configuration` window | viewport (`innerWidth` × layout height) or element (`createDimenScope`) |
| `DimenCache` / `DimenMetrics` | runtime / `DimenMetrics` (`getMetrics()`) |
| `AppDimensProvider` | `install()` + framework bindings |
| `values-sw600dp` / `.screen(DpQualifier.SMALL_WIDTH, 600, …)` | `@sw600` · `sdpQualifier(...)` · `scaledDp().screen(...)` |
| `UiModeType.TELEVISION` | `@tv`, `<html data-ad-mode="tv">`, `UiModeType.TELEVISION` |
| `Inverter.SW_TO_LH` (`sdpLh`) | `sdpLh(16)`, `16sdpLh`, `var(--sdpLh)` |
| `ignoreMultiWindows` (`i`) | `sdpi`, `class="ad-i"`. `@mw` is web-only: it tests the multi-window flag and has no Android qualifier |
| `applyAspectRatio` (`a`) | `sdpa`, `class="ad-a"` |
| `scalingStrategy("brand") { … }` / `16.cdp(Brand)` / `ProvideScalingStrategy` | `defineScalingStrategy({ id: 'brand', … })` / `cdp(16, brand)` · `16cdp-brand` / `ScalingStrategyProvider` · `provideScalingStrategy` |
| `autoResizeTextSp` (BoxWithConstraints) | `autoResizeText(el, …)` |

## Strategy prefixes

`''` scaled · `p` percent · `pw` power · `f` fluid · `a` auto · `dg` diagonal · `fl` fill · `ft` fit · `i` interpolated ·
`log` logarithmic · `pr` perimeter · `d` density — token = `<prefix><s|h|w><dp|sp|em><Ph|Lh|Pw|Lw>?<a|i|ia>?<Px>?`.
