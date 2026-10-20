# webdimens — API reference (3.2.1)

All numbers are **CSS px** unless the name ends in `Px` (device px = CSS px × devicePixelRatio).

## Setup

```ts
install(options?)      // viewport tracking + CSS variables + declarative compiler; idempotent
uninstall()
configure({ cssVariables, cssNonce, uiModeType, fontScale, multiWindow, measure })
// install-only: declarative (default true), strategies: string[] | 'all' (pre-register strategies used only by hand-written CSS)
subscribe(fn) → unsubscribe   getMetrics() → DimenMetrics   getVersion()   refresh()   flush()
setMetrics(DimenMetrics | init | null)   // pin a snapshot (SSR, tests, previews)
createDimenScope(element, { strategies?, cssVariables?, onChange? }) → { metrics, dp, sp, update, disconnect }
```

## Unit tokens

Grammar: `<prefix><axis><kind><inverter>?<flags>?<Px>?`

| Part | Values |
|---|---|
| prefix | `''` scaled · `p` percent · `pw` power · `f` fluid · `a` auto · `dg` diagonal · `fl` fill · `ft` fit · `i` interpolated · `log` logarithmic · `pr` perimeter · `d` density |
| axis | `s` smallest width · `h` height · `w` width |
| kind | `dp` layout · `sp` text × font scale · `em` text, no font scale |
| inverter | orientation-specific axis, as in Android: `s`: `Ph Lh Pw Lw` · `h`: `Lw Pw` · `w`: `Lh Ph` |
| flags | `a` aspect ratio · `i` ignore multi-window · `ia` both |
| `Px` | device pixels (JS only) |

CSS variables exist for every `dp` token, and for `sp`/`em` without inverter (`--sdp`, `--sdpLwa`, `--ssp`, `--pwhema`, …),
plus `--ad-w --ad-h --ad-sw --ad-density --ad-dpi --ad-font-scale --ad-landscape --ad-multi-window`.

`Px` tokens and `sp`/`em` tokens with an inverter (`16sdpPx`, `14sspLw`, `semPh`) are JS only: use them with `dimen()`,
`dimensPx()`, `parseToken()` or the `…Px` functions. They are not valid in classes, `data-dimen`, `dimens()` or CSS.

## Declarative

| Form | Syntax |
|---|---|
| class | `prop[@cond…]:value[!]` — `_` = space · `p:16sdp` `m:8sdp_16sdp` `fs@tv@sw600:40ssp` `--gap:12sdp` |
| attribute | `data-dimen="prop[@cond…]: value; …"` |
| style block | `<style data-webdimens> .x { padding: 16sdp } </style>` |
| PostCSS | `padding: 16sdp;` and nested `@dimen <cond…> { … }` |
| modifiers | `ad-a` `ad-i` `ad-ia` · `ad-<strategy>` (`ad-power`, `ad-fluid`, …) |

Conditions: `landscape` `portrait` · `sw<N>` `w<N>` `h<N>` (≥ N dp, optional `dp`) · `normal` `tv` `car` `watch` `desk` `appliance` `vr`
`undefined` `fold-open` `fold-closed` `fold-half` `flip-open` `flip-closed` `flip-half` · `mw`.
Aliases: `television` (= `tv`), `multi-window` (= `mw`). Condition names are case-insensitive.
Order: mode+qualifier > mode > qualifier (larger N later) > orientation > default.
Aliases: `p pt pr pb pl px py ps pe m mt mr mb ml mx my ms me w h size minw minh maxw maxh fs lh ls gap gapx gapy r radius bw ow basis indent`.
`<html>` attributes kept by the runtime: `data-ad-mode`, `data-ad-orientation`, `data-ad-multi-window`.
A literal is recognised only as a whole value word: at the start of the value or after a space, `,`, `(`, `/` or `*`, and
followed by a space, `,`, `)`, `/` or `*` (`calc(8sdp*2)` works). Text inside `url(...)` and quoted strings is never rewritten.
Class / `data-dimen` values containing `{`, `}`, `;`, `<`, `/*` or a dangling `\` are rejected (CSS-injection guard).

Compilers (SSR / build tools): `dimenClassesToCss(classes, attributeValues?)`, `compileDimenClass`, `compileDimenAttribute`,
`compileCssText`, `modifierCss`, `flushDeclarative()`.

## JS helpers

```ts
dimen('16sdp') → number          dimenCss('8sdp 16sdp') → 'calc(…) calc(…)'
dimens({ padding: '8sdp' })       // CSS strings (responsive)       dimensPx({ width: '120wdp' }) // numbers
parseToken('pwhdpLwa')            parseDimenLiteral('16sdp')        cssDimen('sdp', 16)
```

## Per strategy (scaled shown; swap the prefix for others)

- 264 accessors: `sdp(v)` … `wemPhiaPx(v)`.
- `toDynamicScaledDp | Px | Sp | SpPx (v, qualifier?, { inverter, ignoreMultiWindows, applyAspectRatio, customSensitivityK, fontScale })`.
- Facilitators, each also `h`/`w`, `sp`, and `…Px`:
  `sdpRotate(v, alt, orientation = LANDSCAPE, opts?)` · `sdpMode(v, alt, uiModeType, opts?)` ·
  `sdpQualifier(v, alt, qualifierType, minDp, opts?)` · `sdpScreen(v, alt, uiModeType, qualifierType, minDp, opts?)`;
  `opts.finalQualifierResolver` sets the axis for `alt`.
- Builder: `scaledDp(v)` / `scaledSp(v)` → `.aspectRatio(apply, k?)` `.ignoreMultiWindows()` `.screen(…)` →
  `.sdp .hdp .wdp .ssp .hsp .wsp .sem .hem .wem` (+ `Px`), `.dp(q) .px(q) .sp(q, fontScale) .all()`.
  Other strategies: `powerDp(v).pwsdp`, etc.
- `.screen` overloads: `(uiMode, qualifierType, minDp, value, finalQ?, inverter?, orientation?)` · `(uiMode, value, …)` ·
  `(qualifierType, minDp, value, …)` · `(orientation, value, …)` · `({ uiModeType, qualifier: [type, minDp], orientation, value })`.
- Plain branches (no scaling): `plainRotate`, `plainMode`, `plainQualifier`, `plainScreen`.

## Percent `space*` (`webdimens/percent`)

`spaceW(p)` `spaceSw(p)` `spaceH(p)` (% of axis) · `space(p, ref)` · `…Px` · `…i` · `spaceWSp(p, fontScale = true)` … `spaceSp(p, ref)`.

## Resize (`webdimens/resize`)

`autoResizeText(el, { min, max, step, maxLines })` → `{ fontSize, refit, disconnect }` · `fittingTextSize(el, opts)` ·
`fittingTextPx({ text, maxWidth, maxHeight?, maxLines?, font?, lineHeight?, letterSpacing?, min, max, step })` ·
`fittingBoxPx(min, max, step, available)` · bounds: number (sp for text, dp for boxes), `resizeFixedDp`, `resizeFixedSp`,
`resizePercentSw/W/H`, `resizePercentBox(p, AutoResizePercentBasis)` · `buildResizeStepsPx`, `findLargestFittingResizePx`, `ResizeRangePx`.

## Units (`webdimens/units`)

`mm` `cm` `inch` → dp · `toPxFrom*` · `toSpFrom*` · `convert*` · `unitSizeInDp(UnitType)` · `radius` · `radiusFromCircumference` ·
`measureDiameter` · `setPhysicalCalibration(pxPerInch)` (default 96).

## Frameworks

React `useDimens()` `useDimensVersion()` `useDimen(fn, deps?)` `useWebDimens(opts?)` `useDimenScope(ref)` ·
Vue `WebDimens` plugin, `useDimens()`, `useDimen(fn)` · Svelte stores `metrics`, `dimen(fn)` ·
Angular `provideWebDimens(opts?)`, `injectDimens()`, `injectDimen(fn)`.

## Custom strategies (`webdimens/custom`)

- **Define:** `defineScalingStrategy({ id, reference?, axis?, curve?, multiplier?, clamp?, valueClamp?, aspectRatio?, fontScale?, ignoreMultiWindow?, transform?, rules?, extends? })`. It registers the strategy.
- **JSON:** `loadScalingStrategies(json)` registers every strategy and applies `default`. Export with `exportScalingStrategies()`.
- **Axis:** `smallestWidth` · `width` · `height` · `min` · `max` · `diagonal` · `perimeter`.
- **Curves:** `linear` · `power(exponent)` · `logarithmic(k)` · `interpolated(t)` · `constant(factor)` · `breakpoints(points[{at, factor}])` · `expression(text)` · `custom(fn)`.
- **Free-form formulas:** `curve: { type: 'expression', expression: 'pow(ratio, 0.8) * (tablet ? 0.9 : 1)' }` (factor, memoized) and `formula: 'base * pow(sw / 360, 0.7) + 2'` (per value). Variables `sw width height shortSide longSide diagonal perimeter aspectRatio density fontScale`, flags `landscape portrait multiWindow phone tablet desktop tv watch car vr`, `ratio axis ref refWidth refHeight` (curve), `base scaled factor` (formula); functions `min max clamp pow sqrt ln log log10 log2 exp abs sign floor ceil round lerp step smoothstep`; `ScalingExpression.parse` validates early. Same results on every AppDimens platform.
- **Rules:** `{ name?, when: { device?, orientation?, smallestWidth?, width?, height?, aspectRatio?: {min?, max?}, multiWindow? }, set: { …fields } }`. Ranges are `min <= v < max`. Matching rules apply in order, and a later rule wins.
- **Use:**
  - `cdp(v, s?)` / `cdpPx` / `csp` / `cspPx` (default strategy = `BuiltInStrategies.SCALED` until `setDefaultScalingStrategy`).
  - `s.dp(v)`, `s.sp(v)`, `s.css(v)`, `s.cssSp(v)`, `s.explain()`, `s.extend(id, patch)`, `s.withAxis(axis)`, `s.toJSON()`.
- **CSS:** `--cdp-<id>` / `--csp-<id>` (+ `--cdp` / `--csp` for the default). Literals: `16cdp-<id>`, `14csp-<id>`, `16cdp`.
- **Device class:** the UI mode, then a fine pointer → desktop, then `sw >= 600` → tablet. Override with `setDeviceClassResolver`.
- **Formula:** `factor = clamp(curve(axis/ref) × multiplier × (1 + k·ln(AR/1.78))^ar, min, max)`, `dp = transform(clampValue(v × factor))`.

## Formulas (d = axis dp; L = ln(max/min / 1.78); k = 0.08/30)

scaled/percent `d/300`, `a`: `1 + (d−300)(1/300 + k·L)` · power `(d/300)^0.75` · fluid `0.8→1.2` over 320–768 ·
auto `d/300` ≤ 480 then `1.6 + 0.4·ln(1 + (d−480)/300)` · logarithmic `1 ± 0.4·ln(d/300)` · interpolated `1 + (d/300 − 1)/2` ·
diagonal `√(w²+h²)/611.63` · perimeter `(w+h)/833` · fill/fit `max/min(sw/300, max/533)` · density `dpr`.
Satellite `a` = × `(1 + k·L)`. `i` in multi-window = unscaled value.
