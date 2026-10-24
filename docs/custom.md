# Custom strategies

`webdimens/custom` lets you **define your own scaling strategy** instead of picking one of the 12 built-ins. It is the web port of the Android module `appdimens-dynamic-custom`, and the configuration is the **same JSON on every AppDimens platform** (Android, KMP, iOS, Flutter, React Native, Web, Games, .NET).

> **Languages:** English · [Português (BR)](./pt-BR/custom.md)

## Quick start: just write the formula

The easiest way is to write the formula yourself. You get the value you pass (`base`, for example 16) and the screen, and you return the scaled value. There is nothing to configure.

```ts
import { cdp, csp, cdpCss, customScaleStrategy, scalingFormula } from 'webdimens/custom';

// 1. Inline: the formula is the value
cdp(16, 'base * pow(sw / 360, 0.8)');             // CSS px
csp(20, 'base * min(sw / 360, 1.3)');             // text, font scale followed
cdpCss(16, 'base * (sw / 360)');                  // "calc(16 * var(--cdp-formula-…))" — responsive CSS

// 2. Named, to reuse it everywhere
const hud = scalingFormula('base * (tablet ? 0.9 : 1) * clamp(sw / 360, 0.85, 1.6)');
hud.dp(48);                                       // or cdp(48, hud), hud.css(48), useScalingStrategy(hud)

// 3. In code, with no limits (not JSON-serializable)
const fancy = scalingFormula((base, screen) => base * Math.pow(screen.smallestWidthDp / 360, 0.8));

// 4. Programmable factor: return the factor that multiplies every value
const product = customScaleStrategy((screen) => {
  const width = screen.widthDp;
  return Math.min(Math.max(width / 360, 0.85), 1.8);
});
cdp(16, product);                                 // 16 × factor
```

| Form | You return | Cost per value | JSON |
|---|---|---|---|
| `cdp(16, '…')` / `scalingFormula('…')` | the final value (`base` = input) | one multiply when shaped `base * (…)`, otherwise evaluated per value | yes |
| `scalingFormula((base, screen) => …)` | the final value | the function runs per value | no |
| `customScaleStrategy((screen) => …)` | the **factor** (any JS: `if`, `switch`, helpers, `Math.min`…) | one multiply (the function runs once per window); `css()` stays a CSS variable | no |

In the functions, `screen` is a `ScreenSnapshot`: `widthDp`, `heightDp`, `smallestWidthDp`, `density`, `fontScale`, `isLandscape`, `isMultiWindow`, `device` (`'phone'`, `'tablet'`, `'tv'`…). They must be pure (they must not read mutable state), because results are memoized per window. `customScaleStrategy(fn, { id: 'product' })` registers it (`--cdp-product`, `16cdp-product`).

A string strategy is a strategy **id** first; when no strategy has that id, it is read as a formula. Text formulas without an `id` are shared per text (calling `scalingFormula` again with the same text returns the same instance) and are not registered. Pass `{ id: 'hud' }` to register one under a name, which also publishes `--cdp-hud` and enables the `16cdp-hud` literal.

| You write | Means |
|---|---|
| `base` | the value you pass (`16` in `cdp(16, …)`) |
| `sw` · `width` · `height` | smallest width · window width · window height (dp = CSS px) |
| `shortSide` · `longSide` · `diagonal` · `aspectRatio` | other window measures |
| `ratio` | `sw / 300`, the ratio `sdp` uses (so `base * ratio` = `sdp`) |
| `phone` `tablet` `desktop` `tv` `watch` `car` `vr` · `landscape` `portrait` `multiWindow` | 1 when true, 0 when false |
| `density` · `fontScale` | device pixel ratio · user font scale |

You can use `+ - * / ^`, `cond ? a : b`, `min` `max` `clamp` `pow` `sqrt` `log` `round` `lerp` `smoothstep`, and more (see [Free-form formulas](#free-form-formulas-no-limits-from-the-built-in-curves)). Typos fail right away with the position, for example `unknown variable 'sww'`.

**Fast path.** When the formula has the shape `base * (…)` and the `(…)` part does not read `base`, it costs one multiply per value: the `(…)` part is computed once per window, and `css()` stays a CSS variable. Any other shape also works, evaluated per value (and `css()` returns the px literal of the current viewport). `base * sw / 360` is evaluated as written, `(base * sw) / 360`. Write `base * (sw / 360)` for the fast path.

The same text works in the strategies JSON (`{"id": "hud", "formula": "base * pow(sw / 360, 0.8)"}`) and gives the same numbers on every AppDimens platform. If you need more structure (rules per device, factor bounds, font-scale policy), use the full configuration below.

## What a strategy is

A strategy is a plain object that turns the current window (viewport or [element scope](./runtime.md)) into one **factor**:

```
ratio  = axis(window) / axis(reference)
factor = clamp( curve(ratio) × multiplier × AR , clamp.min, clamp.max )
px     = formula( valueClamp( value × factor ) )
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
| `formula` | `'round(scaled)'` — per-value text formula (JSON) | none |
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
| `{ type: 'expression', expression: 'pow(ratio, 0.8)' }` | your formula, as text (JSON-serializable) — see below |
| `{ type: 'custom', fn: (ratio, screen) => … }` | your pure formula (code only) |

### Free-form formulas (no limits from the built-in curves)

You are not limited to the built-in curves. Write the formula yourself, as **text** that also works in JSON and gives the same result on every AppDimens platform:

- **Curve expression** returns the **factor** from the screen. It is computed once per window, like any curve, and stays on the one-multiply fast path.
  `"curve": {"type": "expression", "expression": "pow(ratio, 0.8) * (tablet ? 0.9 : 1)"}`
- **Formula** returns the **final value** for each input. It can use `base`, `scaled` and `factor`, and replaces or post-processes the result. The strategy then becomes value-dependent (evaluated per value), unless the formula is `base * (…)` with no value variable inside the parentheses: that one stays screen-only (see [Quick start](#quick-start-just-write-the-formula)).
  `"formula": "base * pow(sw / 360, 0.7) + 2"` · `"formula": "max(scaled, base)"`

| | |
|---|---|
| Operators | `+ - * / % ^` (`^` = power, right-associative; `%` keeps the dividend's sign), `== != < <= > >=`, `&& \|\| !`, `cond ? a : b`, `( )` |
| Functions | `min(a, b, …)` `max(a, b, …)` `clamp(x, lo, hi)` `pow` `sqrt` `ln`/`log` `log10` `log2` `exp` `abs` `sign` `floor` `ceil` `round` (half up) `lerp(a, b, t)` `step(edge, x)` `smoothstep(e0, e1, x)` |
| Screen variables | `sw` `width` `height` `shortSide` `longSide` `diagonal` `perimeter` `aspectRatio` `density` `fontScale`; flags (1/0): `landscape` `portrait` `multiWindow` `phone` `tablet` `desktop` `tv` `watch` `car` `vr`; constants `pi` `e`, `true` / `false` |
| Curve variables | screen variables + `ratio` (axis / reference), `axis` (dp), `ref` (reference dp), `refWidth`, `refHeight` |
| Formula variables | curve variables + `base` (input), `scaled` (base × factor after `valueClamp`), `factor` |

Expressions are parsed when the strategy is created. Unknown variables or functions, wrong arity and syntax errors fail early with the position and the JSON path (e.g. `brand.rules[0].set.curve.expression`). A non-finite factor (for example, a division by zero) throws when the strategy resolves. Rules can swap expressions per device like any other field, and `"formula": null` clears an inherited formula.

For anything the language cannot express, use a code-only function: `{ type: 'custom', fn: (ratio, screen) => … }` (factor) or `transform: (base, scaled, screen) => …` (value). Both have full access to your code, but they cannot be serialized to JSON.

```ts
const hud = defineScalingStrategy({
  id: 'hud',
  curve: { type: 'expression', expression: 'clamp(pow(shortSide / 360, 0.85) * (1 + 0.05 * log(aspectRatio / 1.78)), 0.8, 2)' },
  formula: 'round(scaled)',                       // whole px only
  rules: [{ when: { device: 'tv' }, set: { curve: { type: 'expression', expression: 'height / 540' } } }],
});
```


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
- Strategies with `valueClamp`, `formula` or `transform` depend on the value, so `brand.css(v)` returns a px literal for the current snapshot instead of a `var()`.
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
- Value bounds, `transform` and non-proportional formulas add a few operations per call. A `base * (…)` formula is one multiply.
- CSS properties are rewritten only when the snapshot changes.
- Keep `custom` curve functions and `transform` **pure**.
- `webdimens/custom` has no import-time side effects and is tree-shaken when unused.

## Parity

Every platform runs the same fixture (`tests/fixtures/custom-strategy-fixture.json`, generated by the Kotlin reference engine). Factors, px and text sizes match within a relative tolerance of 1e-4.
