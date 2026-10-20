# Custom strategies

`webdimens/custom` lets you **define your own scaling strategy** instead of picking one of the 12 built-ins. It is the web port of the Android module `appdimens-dynamic-custom`, and the configuration is the **same JSON on every AppDimens platform** (Android, KMP, iOS, Flutter, React Native, Web, Games, .NET).

> **Languages:** English · [Português (BR)](./pt-BR/custom.md)

## What a strategy is

A strategy is a plain object that turns the current window (viewport or [element scope](./runtime.md)) into one **factor**:

```
ratio  = axis(window) / axis(reference)
factor = clamp( curve(ratio) × multiplier × AR , clamp.min, clamp.max )
px     = transform( valueClamp( value × factor ) )
```

Rules override any field per **device class** (`phone`, `tablet`, `desktop`, `tv`, `watch`, `car`, `vr`), **screen range** (smallest width, width, height, aspect ratio), **orientation** and **multi-window**.

## Define and use

```ts
import { defineScalingStrategy, cdp, csp } from 'webdimens/custom';

const brand = defineScalingStrategy({
  id: 'brand',
  reference: { width: 360, height: 640 },          // your design frame (dp = CSS px)
  curve: { type: 'power', exponent: 0.8 },         // sublinear growth
  clamp: { min: 0.85, max: 1.6 },                  // factor bounds
  fontScale: { max: 1.3 },                         // csp follows the user font size up to 1.3×
  rules: [
    { name: 'large', when: { device: ['tablet', 'desktop'] }, set: { curve: { type: 'logarithmic', k: 0.4 } } },
    { when: { orientation: 'landscape', smallestWidth: { min: 600 } }, set: { multiplier: 0.9 } },
  ],
});

cdp(16, brand);        // CSS px for the current viewport
csp(14, brand);        // text, font-scale policy applied
brand.dp(16);          // same as cdp(16, brand)
brand.px(16);          // device px (× devicePixelRatio)
brand.css(16);         // "calc(16 * var(--cdp-brand))" — responsive, no re-render, SSR-safe
brand.cssSp(14);       // "calc(14 * var(--csp-brand))"
```

`defineScalingStrategy` also **registers** the strategy, so you can reference it by id (`cdp(16, 'brand')`). Pass `{ register: false }` for throwaway instances.

### Global default

```ts
import { setDefaultScalingStrategy, cdp } from 'webdimens/custom';
setDefaultScalingStrategy('brand');
cdp(16);   // uses brand; before any default it equals sdp(16)
```

## Configuration fields

| Field | Example | Default |
|---|---|---|
| `reference` | `{ width: 360, height: 640 }` | 300 × 533 |
| `axis` | `'smallestWidth'` · `'width'` · `'height'` · `'min'` · `'max'` · `'diagonal'` · `'perimeter'` | `'smallestWidth'` |
| `curve` | see below | `'linear'` |
| `multiplier` | `0.9` | 1 |
| `clamp` | `{ min: 0.85, max: 1.6 }` (factor) | none |
| `valueClamp` | `{ min: 10, max: 32 }` (resulting px, magnitude) | none |
| `aspectRatio` | `true` or `{ enabled: true, sensitivity: 0.004 }` | off, k = 0.08 / 30 |
| `fontScale` | `'follow'` · `'ignore'` · `{ max: 1.3 }` | `'follow'` |
| `ignoreMultiWindow` | `true` → factor 1 in split windows | `false` |
| `transform` | `(base, scaled, screen) => Math.round(scaled)` (code only) | none |
| `rules` | `[{ name?, when: {…}, set: {…} }]` | none |
| `extends` | `'power'`, `'tabletFriendly'`, another id | — |

| Curve | Factor |
|---|---|
| `'linear'` | `r` (same as `sdp` with the default reference) |
| `{ type: 'power', exponent }` | `r^e` (built-in power uses 0.75) |
| `{ type: 'logarithmic', k }` | `1 + k·ln(r)` (built-in uses 0.4) |
| `{ type: 'interpolated', t }` | `1 + (r − 1)·t` (built-in uses 0.5) |
| `{ type: 'constant', factor }` | fixed factor |
| `{ type: 'breakpoints', points: [{ at: 360, factor: 1 }, { at: 840, factor: 1.5 }] }` | piecewise linear over the **absolute** axis value |
| `{ type: 'custom', fn: (ratio, screen) => … }` | your pure formula (code only) |

**How rules apply:**
- Every field set in `when` must match. Ranges are `min <= value < max`.
- Matching rules apply in order, and a later rule overrides the fields an earlier one set.
- If combined rules leave crossed bounds, the max bound wins.
- `explain()` lists the applied rules. Rules without a name show as `#index`.

## JSON, presets and built-ins

```ts
import { loadScalingStrategies, CustomPresets, BuiltInStrategies } from 'webdimens/custom';

const res = await fetch('/appdimens-strategies.json');
loadScalingStrategies(await res.text());   // registers every strategy + applies "default"

const tv = CustomPresets.TV_SAFE;           // tabletFriendly, compactFirst, tvSafe, wearable, gameHud, readableText
const soft = BuiltInStrategies.POWER.extend('soft', { curve: { type: 'power', exponent: 0.6 } });
const heights = brand.withAxis('height');   // "brand@height"
brand.toJSON();                              // export (exportScalingStrategies() for all)
```

`extends` may name another strategy of the same document, a registered strategy, a built-in (`scaled`, `power`, `logarithmic`, `interpolated`, `diagonal`, `perimeter`, `fixed`) or a preset. The parent's rules come first. Errors name the path (`brand.rules[0].set.curve.type …`). Schema: [`custom-strategy.schema.json`](https://github.com/bodenberg/appdimens-skills/blob/main/schemas/custom-strategy.schema.json).

## CSS, literals and PostCSS

Once a strategy is defined in the browser, the runtime publishes on `:root`:
- `--cdp-<id>`: the layout factor, in px.
- `--csp-<id>`: the text factor × the effective font scale.
- `--cdp` / `--csp`: the same two values for the default strategy.

They update once per frame on resize.

```css
.card { padding: calc(16 * var(--cdp-brand)); font-size: calc(14 * var(--csp-brand)); }
```

The literal syntax works everywhere `16sdp` works (`dimens()`, `dimenCss()`, `<style data-webdimens>`, PostCSS):

```css
/* postcss.config.js → plugins: [webdimens()] */
.card { padding: 8cdp-brand 16cdp-brand; font-size: 14csp-brand; margin: 4cdp; }
/* → calc(8 * var(--cdp-brand)) … calc(4 * var(--cdp)) */
```

- In JS, `dimen('16cdp-brand')` and `dimensPx()` resolve the literal through the registry.
- If your CSS only uses `16cdp` / `var(--cdp)` without defining any strategy, call `installCustomCss()` once.
- Strategies with `valueClamp` or `transform` depend on the value, so `brand.css(v)` returns a px literal for the current snapshot instead of a `var()`.
- For an element scope, write `customCssDeclarations(scope.metrics)` on the element.

## Frameworks

```tsx
// React
import { ScalingStrategyProvider, useScalingStrategy } from 'webdimens/react';
<ScalingStrategyProvider strategy={brand}><Card /></ScalingStrategyProvider>
function Card() { const s = useScalingStrategy(); return <div style={{ padding: s.dp(16), fontSize: s.sp(14) }} />; }
```

```ts
// Vue — provideScalingStrategy(brand) in a parent; in a child:
const s = useScalingStrategy();      // s.dp(16) is reactive in templates
const pad = useCdp(16, 'brand');     // ComputedRef<number>
// Svelte
const brandStore = scalingStrategy('brand');   // {$brandStore.dp(16)}
// Angular
providers: [provideScalingStrategy(brand)];  readonly s = injectScalingStrategy();  // s().dp(16)
```

## Device class on the web

The device class is detected in this order:
1. **UI mode** (`tv`, `car`, `watch`, `desk` → `desktop`, `vr`), from the runtime heuristics or the `uiModeType` install option.
2. **Fine pointer with hover** (mouse or trackpad) → `desktop`.
3. **Size**: `sw >= 600` → `tablet`, otherwise `phone`.

You can replace this with `setDeviceClassResolver((metrics) => …)`. Width-range rules (`when: { width: { min: 1024 } }`) do not depend on detection. Prefer them when only the size matters.

## Debug

```ts
console.log(brand.explain());
// [brand] tablet smallestWidth=800dp / ref 360 = 2.2222 -> logarithmic(0.4) = 1.3194 x 0.9 clamp[0.85, 1.6] => factor 1.1875 rules=[large, #1]
```

## Performance

- The factor is computed **once per snapshot per strategy** and memoized, so `cdp(16, brand)` is one multiply.
- Value bounds and `transform` add a few operations per call.
- CSS properties are rewritten only when the snapshot changes.
- Keep `custom` curve functions and `transform` **pure**.
- `webdimens/custom` has no import-time side effects and is tree-shaken when unused.

## Parity

Every platform runs the same fixture (`tests/fixtures/custom-strategy-fixture.json`, generated by the Kotlin reference engine). Factors, px and text sizes match within a relative tolerance of 1e-4.
