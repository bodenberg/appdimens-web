# API reference

> **Languages:** English · [Português (BR)](../pt-BR/custom/api-reference.md)

Everything below is exported by `webdimens/custom` (and on `window.WebDimens` in the CDN bundle) unless another entry is named. Values are dp, which are CSS px; `…Px` results are device px (× `devicePixelRatio`).

## Building strategies

| Function | Returns | Notes |
|---|---|---|
| `customScaleStrategy(fn, { id?, register? })` | `ScalingStrategy` | programmable factor, `ScreenScope` argument ([code formulas](code-formulas.md)) |
| `scalingFormula(fn, { id?, register? })` | `ScalingStrategy` | code formula, `FormulaScope` argument |
| `scalingFormula('text', { id?, register? })` | `ScalingStrategy` | text formula, shared per text without an id ([text formulas](text-formulas.md)) |
| `getFormulaScalingStrategy('text')` | `ScalingStrategy` | the shared strategy for a text formula |
| `defineScalingStrategy(spec, { register? })` | `ScalingStrategy` | full configuration, registered by default ([configuration](configuration.md)) |
| `strategy.extend(id, patch?, { register? })` | `ScalingStrategy` | child of an existing strategy, registered by default |
| `strategy.withAxis(axis)` | `ScalingStrategy` | same strategy on another axis, id `"<id>@<axis>"`, cached per instance |
| `new ScalingStrategy(id, config)` | `ScalingStrategy` | wrap a normalized `ScalingConfig` (e.g. from `configFromSpec`) |
| `BuiltInStrategies.SCALED` … `FIXED` · `CustomPresets.TV_SAFE` … | `ScalingStrategy` | ready-made parents |

## Registry

| Function | Notes |
|---|---|
| `getDefaultScalingStrategy()` | strategy used by `cdp(16)` / `csp(14)` / `16cdp` without an id; initially `BuiltInStrategies.SCALED` |
| `setDefaultScalingStrategy(s \| id \| text \| null)` | change it (`null` restores `SCALED`) |
| `registerScalingStrategy(s)` · `unregisterScalingStrategy(id)` | add or replace · remove |
| `getScalingStrategy(id)` · `requireScalingStrategy(id)` | lookup, including built-ins and presets; `require…` throws `No scaling strategy 'x'. Registered: …` |
| `registeredScalingStrategies()` | strategies registered by the app |
| `pickScalingStrategy(s?)` | resolves an instance, an id, a text formula or the default |
| `loadScalingStrategies(json)` | register a [JSON document](json.md) and apply its `default`; atomic |
| `exportScalingStrategies(list?)` | JSON document of the registered strategies |

## Short functions

| Call | Returns |
|---|---|
| `cdp(16, s?)` | CSS px |
| `cdpPx(16, s?)` | device px |
| `csp(14, s?)` | CSS px for text (font-scale policy applied) |
| `cspPx(14, s?)` | device px for text |
| `cdpCss(16, s?)` · `cspCss(14, s?)` | responsive CSS: `calc(16 * var(--cdp-<id>))`, or `var(--cdp)` / `var(--csp)` for the default |

`s` is a `ScalingStrategy`, a registered / built-in / preset id or a text formula. Without it the default strategy is used.

## Strategy members (`ScalingStrategy`)

| Member | Notes |
|---|---|
| `id` · `config` · `valueDependent` | identity · normalized config · whether results depend on the value (then `css()` returns px) |
| `cssVar` · `cssSpVar` | `--cdp-<id>` · `--csp-<id>` |
| `dp(v, metrics?)` · `px(v, metrics?)` | CSS px · device px |
| `sp(v, metrics?)` · `spPx(v, metrics?)` | text, CSS px · device px |
| `css(v)` · `cssSp(v)` | `calc(v * var(--cdp-<id>))` · `calc(v * var(--csp-<id>))` |
| `factor(metrics?)` · `explain(metrics?)` | debug |
| `resolve(metrics?)` → `ResolvedScaling` | memoized per snapshot: `factor`, `appliedRules`, `valueFactor`, `scale(base)`, `scaleSpDp(base)`, `scaleSpUnits(base)`, `effectiveFontScale()`, `explain(id)` |
| `resolveScreen(screen)` | the same for a `ScreenSnapshot` you build (tests, previews, SSR) |
| `extend(…)` · `withAxis(…)` · `toJSON()` | see above; `toJSON()` throws for code functions |

`metrics` defaults to the current viewport snapshot. Pass an element scope's `scope.metrics` to resolve against an element ([Runtime › Element scopes](../runtime.md#element-scopes)).

## CSS variables and literals

| API | Notes |
|---|---|
| `--cdp-<id>` · `--csp-<id>` on `:root` | layout factor (px) · text factor × effective font scale (px), for every registered strategy and every text formula / auto-id factor used through `css()` |
| `--cdp` · `--csp` | the same for the default strategy |
| `16cdp-<id>` · `14csp-<id>` · `16cdp` · `14csp` | literals in `dimens()`, `dimenCss()`, `<style data-webdimens>` and the PostCSS plugin; `dimen('16cdp-brand')` / `dimensPx()` resolve them in JS |
| `installCustomCss()` | start publishing the variables when your CSS only uses `16cdp` / `var(--cdp)` and no strategy is defined |
| `customCssDeclarations(metrics?, strategies?)` | the declarations as a string, e.g. for an element scope |

Ids are written as CSS identifiers (characters other than `A-Z a-z 0-9 _ -` become `_`; text formulas use `formula-<hash>`). Variables update once per frame on resize.

## Framework helpers

| Framework | Scope | Use |
|---|---|---|
| React (`webdimens/react`) | `<ScalingStrategyProvider strategy={brand}>` | `const s = useScalingStrategy(); s.dp(16)` (re-renders on snapshot changes) |
| Vue (`webdimens/vue`) | `provideScalingStrategy(brand)` | `const s = useScalingStrategy(); s.dp(16)` (reactive) · `useCdp(16, 'brand')`: `ComputedRef<number>` |
| Svelte (`webdimens/svelte`) | — | `const brand = scalingStrategy('brand')` → `{$brand.dp(16)}` |
| Angular (`webdimens/angular`) | `providers: [provideScalingStrategy(brand)]` · token `SCALING_STRATEGY` | `s = injectScalingStrategy()` → `s().dp(16)` |

Each helper takes an optional strategy (instance, id or text formula) and returns a `BoundScalingStrategy`: `strategy`, `dp`, `px`, `sp`, `spPx`, `css`, `cssSp`, `factor()`, `explain()`. `bindScalingStrategy(s, track?)` builds one for other frameworks. For SSR-safe styles prefer `s.css(16)` (CSS variables).

## Engine (platform-free)

| Export | Notes |
|---|---|
| `screenSnapshot({ widthDp, heightDp, … })` | builds a `ScreenSnapshot(widthDp, heightDp, smallestWidthDp, density, fontScale, isLandscape, isMultiWindow, device)` with defaults |
| `toScreenSnapshot(metrics)` · `defaultDeviceClass(metrics)` · `setDeviceClassResolver(fn \| null)` | web snapshot → engine snapshot, device detection |
| `resolveScaling(config, screen)` · `configFromSpec(spec, parent, path)` · `configToSpec(id, config)` · `parseStrategiesDocument(input, lookup)` | the pure engine used by the registry |
| `screenScope(screen)` · `formulaScope(screen, base)` | the scopes code formulas receive |
| `ScalingExpression.parse(text, allowed?)` · `.evaluate(lookup)` · `.source` | the text language |
| `SCREEN_VARIABLES` · `CURVE_VARIABLES` · `FORMULA_VARIABLES` · `SCALING_AXES` · `DEVICE_CLASSES` | name lists |
| `DEFAULT_CONFIG` · `BUILT_IN_SPECS` · `PRESET_SPECS` | defaults and specs of the built-ins and presets |

Types: `ScalingStrategySpec`, `ScalingPatchSpec`, `ScalingRuleSpec`, `ScreenConditionSpec`, `CurveSpec`, `FontScaleSpec`, `ScalingStrategiesDocument`, `ScalingConfig`, `ScreenSnapshot`, `ScreenScope`, `FormulaScope`, `DeviceClass`, `ScalingAxis`, `CurveFunction`, `ValueTransform`, `BoundScalingStrategy`, `ScalingFormulaOptions`.

`resetScalingStrategiesForTest()` clears the registry, the default, the shared formulas and the CSS (tests only).

[Back to the custom docs](README.md)
