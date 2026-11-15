# Quick start

> **Languages:** English · [Português (BR)](../pt-BR/custom/quick-start.md)

## 1. Install

```bash
npm i webdimens
```

```ts
import { cdp, cdpPx, csp, cdpCss, customScaleStrategy, scalingFormula, defineScalingStrategy } from 'webdimens/custom';
```

Without a bundler, the CDN script (`https://cdn.jsdelivr.net/npm/webdimens@3/dist/webdimens.global.js`) exposes the same functions on `window.WebDimens` (`WebDimens.customScaleStrategy(…)`).

## 2. Write the math (recommended)

Declare the strategy **once** (at module level), then use it anywhere.

```ts
// Factor: the number that multiplies every value
const product = customScaleStrategy(({ width, clamp }) => clamp(width / 360, 0.85, 1.8));

// Formula: the final value (`base` = the value you pass, the 16 in cdp(16, hud))
const hud = scalingFormula(({ base, sw, pow }) => base * pow(sw / 360, 0.8));
```

The function receives a typed scope (`ScreenScope` / `FormulaScope`): the editor autocompletes `width`, `sw`, `height`, `ratio`, `tablet`, `tv`, `landscape`, `pow`, `clamp`, `min`, `max`, `lerp`… and a typo is a type error. Any other code works too (`Math.*`, `switch`, your own helpers). The full list is in [Code formulas](code-formulas.md).

## 3. Use it

```ts
cdp(16, product);          // CSS px for the current viewport
csp(18, hud);              // text, follows the user font scale
cdpPx(24, product);        // device px (× devicePixelRatio), for canvas / WebGL
product.css(16);           // "calc(16 * var(--cdp-scale_1))": responsive CSS, no re-render
```

```tsx
// React
import { useScalingStrategy } from 'webdimens/react';
function Card() {
  const s = useScalingStrategy(product);
  return <div style={{ padding: s.dp(16), fontSize: s.sp(14) }} />;
}
```

Pass `{ id: 'product' }` to register a strategy under a name: `cdp(16, 'product')` then finds it, the runtime publishes `--cdp-product`, and the literal `16cdp-product` works in `dimens()` and PostCSS.

## 4. Make it the default (optional)

```ts
import { setDefaultScalingStrategy } from 'webdimens/custom';
setDefaultScalingStrategy(product);   // app-wide: cdp(16), 16cdp and var(--cdp) now use product
```

```tsx
import { ScalingStrategyProvider } from 'webdimens/react';
<ScalingStrategyProvider strategy={hud}><Hud /></ScalingStrategyProvider>   // one subtree
```

Vue, Svelte and Angular have the same helpers: see the [API reference](api-reference.md#framework-helpers).

## 5. The same thing as text (for JSON and remote config)

```ts
const remote = scalingFormula('base * pow(sw / 360, 0.8)');
cdp(16, 'base * (sw / 360)');                // inline, shared per text
cdpCss(16, 'base * (sw / 360)');             // "calc(16 * var(--cdp-formula-…))"
```

A string strategy is a strategy **id** first; when no strategy has that id, it is read as a formula. The text form uses the same names (flags are 1 or 0) and works in the strategies JSON (`{"id": "hud", "formula": "base * pow(sw / 360, 0.8)"}`). See [Text formulas](text-formulas.md).

## 6. Need more structure?

Rules per device class, factor bounds, a font-scale cap or a different reference frame go in the full configuration:

```ts
const brand = defineScalingStrategy({
  id: 'brand',
  reference: { width: 360, height: 640 },
  curve: { type: 'power', exponent: 0.8 },
  clamp: { min: 0.85, max: 1.6 },
  fontScale: { max: 1.3 },
  rules: [{ when: { device: ['tablet', 'desktop'] }, set: { curve: { type: 'logarithmic', k: 0.4 } } }],
});
```

```css
.card { padding: 16cdp-brand; font-size: 14csp-brand; }   /* PostCSS → calc(16 * var(--cdp-brand)) */
```

See [Configuration](configuration.md) and [JSON format](json.md).

## 7. Check the numbers

```ts
console.log(product.explain());
// [scale#1] phone smallestWidth=411dp / ref 300 = 1.37 -> custom = 1.1417 => factor 1.1417
```

[Back to the custom docs](README.md)
