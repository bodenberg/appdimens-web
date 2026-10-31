# Code formulas

> **Languages:** English · [Português (BR)](../pt-BR/custom/code-formulas.md)

Two one-line entry points let you write the scaling math in plain TypeScript. The function receives a typed **scope** whose names match the [text language](text-formulas.md), so you only learn them once. The editor autocompletes them, and a typo is a type error. Every member is a plain property, so destructuring works.

| | `customScaleStrategy((s) => …)` | `scalingFormula((s) => …)` |
|---|---|---|
| You return | the **factor** (every value is multiplied by it) | the **final value** |
| Scope | `ScreenScope` | `FormulaScope` (= `ScreenScope` + `base`) |
| Runs | once per window snapshot (memoized) | on every call (`cdp`, `dp`, `sp`…) |
| Cost per value | one multiply | your function |
| `css()` | stays a CSS variable (`calc(16 * var(--cdp-…))`) | px literal of the current viewport |
| JSON | no (use a text `expression` curve) | no (use a text `formula`) |

## `customScaleStrategy(…)`: programmable factor

```ts
import { customScaleStrategy } from 'webdimens/custom';

const product = customScaleStrategy(({ width, clamp }) => clamp(width / 360, 0.85, 1.8));
const living = customScaleStrategy(({ tv, height, ratio }) => (tv ? height / 540 : ratio));
const steps = customScaleStrategy(({ sw }) => {
  if (sw < 360) return 0.9;
  if (sw < 600) return sw / 400;
  return 1.5 + (sw - 600) / 2000;
});
```

- Signature: `customScaleStrategy(factor: (scope: ScreenScope) => number, options?: { id?: string; register?: boolean }): ScalingStrategy`.
- Without an `id` a unique `scale#N` id is generated and the strategy is not registered (its CSS variable is still published the first time you call `css()`). With an id it is registered by default, so `cdp(16, 'product')` and `16cdp-product` find it. `register` defaults to `id !== undefined`.
- A non-finite factor (NaN, infinity) throws `RangeError: custom strategy produced a non-finite factor (NaN)` when the window resolves.

## `scalingFormula(…)`: the final value

```ts
import { scalingFormula } from 'webdimens/custom';

const hud = scalingFormula(({ base, sw, pow }) => base * pow(sw / 360, 0.8));
const card = scalingFormula(({ base, tablet, ratio }) => (tablet ? base * 1.2 : base * ratio));
const snap = scalingFormula(({ base, sw, round }) => round((base * sw) / 360));   // whole px only
const floor = scalingFormula(({ base, ratio, max }) => max(base * ratio, base));  // never smaller than the design value
```

- Signature: `scalingFormula(formula: string | ((scope: FormulaScope) => number), options?: { id?: string; register?: boolean }): ScalingStrategy`. A string is a [text formula](text-formulas.md).
- `base` is the value you pass: in `cdp(16, hud)` it is `16`. For `csp`, the result then follows the user font scale (see [font scale](configuration.md#font-scale-csp)).
- Without an `id`, a unique `formula#N` id is generated.
- A code formula always depends on the value, so `hud.css(16)` returns the px literal of the current viewport instead of a CSS variable. When the math is `base × (something about the screen)`, use `customScaleStrategy` instead and keep the CSS variable.

## Names in the scope

| Name | Type | Meaning |
|---|---|---|
| `base` | `number` | the value being scaled (`scalingFormula` only) |
| `sw` | `number` | smallest width of the window (dp = CSS px) |
| `width` · `height` | `number` | window width · height |
| `shortSide` · `longSide` | `number` | shorter · longer side |
| `diagonal` · `perimeter` | `number` | `√(w² + h²)` · `w + h` |
| `aspectRatio` | `number` | `longSide / shortSide` |
| `ratio` | `number` | `sw / 300`, the ratio `sdp` uses (`base * ratio` is exactly `sdp`) |
| `density` · `fontScale` | `number` | `devicePixelRatio` · user font scale |
| `phone` `tablet` `desktop` `tv` `watch` `car` `vr` | `boolean` | device class of the window |
| `landscape` · `portrait` · `multiWindow` | `boolean` | orientation · split / non-maximized window |
| `device` | `DeviceClass` | the device class itself (`'phone'`, `'tablet'`…), for `switch` |
| `screen` | `ScreenSnapshot` | the whole snapshot (`widthDp`, `heightDp`, `smallestWidthDp`, `isLandscape`…) |
| `pow(x, e)` `sqrt` `ln` `log10` `exp` `abs` | `(…) => number` | math |
| `round(x)` | `(x) => number` | half up: `floor(x + 0.5)`, like the text language (not `Math.round` on negatives) |
| `min(…)` `max(…)` `clamp(x, lo, hi)` | `(…) => number` | bounds |
| `lerp(a, b, t)` · `smoothstep(e0, e1, x)` | `(…) => number` | blending |

The scope types are exported (`ScreenScope`, `FormulaScope`), and `screenScope(screen)` / `formulaScope(screen, base)` build one by hand for tests. The device class comes from the runtime: UI mode first, then a fine pointer with hover (`desktop`), then `sw ≥ 600` (`tablet`). See [Device class](configuration.md#device-class-on-the-web).

## Rules for the function

- **Keep it pure.** It must not read mutable state, settings, `Date.now()` or the DOM: the factor is memoized per window snapshot. Use a different strategy (or a rule) for a different state.
- **Declare it once.** Every call to `customScaleStrategy(…)` or `scalingFormula(…)` creates a new strategy with its own id and memo. Use a module-level `const`, never a fresh function in a React render or a Vue `setup` that runs per instance (or wrap it in `useMemo`).
- **Watch out for shadowing.** With destructuring you pick the names you read; a variable of your own named like a scope member (`const tv = …`) is a different value.
- **Prefer the factor form when you can.** If your formula is `base × (something about the screen)`, write the something as a `customScaleStrategy`: it costs one multiply and `css()` stays a CSS variable.

## When to use something else

- The formula must live in JSON, a design-token file or remote config: [Text formulas](text-formulas.md).
- You need rules per device, bounds or a font-scale policy on top of a curve: [Configuration](configuration.md). A configuration also accepts code: `curve: { type: 'custom', fn: (ratio, screen) => … }` and `transform: (base, scaled, screen) => …`.

[Back to the custom docs](README.md)
