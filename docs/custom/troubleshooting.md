# Troubleshooting

> **Languages:** English · [Português (BR)](../pt-BR/custom/troubleshooting.md)

## See what a strategy does

```ts
console.log(brand.explain());                 // current viewport
console.log(brand.explain(scope.metrics));    // an element scope
console.log(brand.resolveScreen(screenSnapshot({ widthDp: 1280, heightDp: 800, device: 'tablet' })).explain('brand'));
```

```
[brand] tablet smallestWidth=800dp / ref 360 = 2.2222 -> logarithmic(0.4) = 1.3194 x 0.9 clamp[0.85, 1.6] => factor 1.1875 rules=[large, #1]
[hud] phone smallestWidth=411dp / ref 300 = 1.37 -> linear = 1.37 => factor 1.37 then Formula(base * pow(sw / 360, 0.8))
```

The line reads left to right: device class, axis value and reference, the curve and its result, multiplier, aspect ratio, bounds, the final factor, the applied rules and, when there is one, the per-value formula or transform. `factor()` returns only the number. In the frameworks, `useScalingStrategy().explain()` (and its Vue / Svelte / Angular equivalents) does the same.

## Common errors

| Message | Cause | Fix |
|---|---|---|
| `SyntaxError: Invalid expression at 7: unknown variable 'sww' …` | typo in a text formula | use a name from the list in the message, or switch to a [code formula](code-formulas.md), which the type checker checks |
| `'clamp' takes 3 argument(s), got 2` | wrong number of arguments | see the [function table](text-formulas.md#functions) |
| `RangeError: custom strategy produced a non-finite factor (NaN)` | division by zero, `ln` of 0, NaN from a function | guard the formula (`max(x, 1)`) or clamp the factor |
| `<path> must be an object` / `must be a boolean` / `must be a finite number` | wrong JSON type | see the [field tables](json.md#strategy-fields) |
| `strategy: maxValue must be >= 0` | negative value bound | value bounds limit the magnitude; use a positive number |
| `strategy: minFactor must be <= maxFactor` | crossed bounds in the declaration | swap them (crossed bounds produced by rules at runtime let the max win) |
| `No scaling strategy 'x'. Registered: …` | id not registered, or a typo in `cdp(16, 'x')` | register it, load the JSON first, or check the id |
| `Custom curve functions cannot be encoded to JSON` · `transform functions cannot be encoded to JSON` | `toJSON()` on code | use the text form for strategies you export |
| `strategy id must not be blank` | empty `id` | give the strategy an id |

## Frequent questions

**My function result never changes.** The factor is memoized per window snapshot. A function that reads mutable state (a setting, the time, the DOM) is not re-run until the snapshot changes. Use separate strategies and pick one, or express the setting as a rule.

**`cdp(16, product)` and `sdp(16)` differ.** Expected: the default reference is 300 dp of smallest width; `ratio` is `sw / 300`. `base * ratio` (or `BuiltInStrategies.SCALED`) gives exactly `sdp`.

**`css()` returns `"18.5px"` instead of `calc(… var(…))`.** The strategy is value-dependent (`valueClamp`, `transform`, a code `scalingFormula`, or a text formula that is not `base * (…)`), so it cannot be one factor. The px value is for the current viewport and does not follow resizes; re-render, or switch to a factor (`customScaleStrategy`, a curve, `base * (…)`).

**`var(--cdp-x)` is not defined.** Variables are published for registered strategies (`defineScalingStrategy`, `{ id }`, `loadScalingStrategies`), for shared text formulas and for auto-id `customScaleStrategy` strategies once `css()` runs. A strategy built with `register: false` or a `withAxis(…)` variant is not published: call `registerScalingStrategy(s)` first. If your CSS only uses `16cdp` / `var(--cdp)`, call `installCustomCss()` once.

**My text formula is slow / misses the fast path.** Only `base * E` qualifies. `base * sw / 360` reads as `(base * sw) / 360`; write `base * (sw / 360)`.

**My laptop is detected as `desktop`, not `tablet`.** A fine pointer with hover counts as desktop. Use width ranges (`when: { width: { min: 1024 } }`) when only the size matters, or `setDeviceClassResolver`.

**A strategy created in a component leaks.** `customScaleStrategy(…)` and `scalingFormula((s) => …)` build a new strategy on each call. Declare them at module level or wrap them in `useMemo`. Inline text formulas (`cdp(16, '…')`) are shared per text and are fine.

**Fonts ignore my strategy.** `csp` follows the browser text size by default. Use `fontScale: 'ignore'` for fixed text, or `fontScale: { max }` to cap it.

**What happens during SSR?** Without a DOM the strategy resolves against the default snapshot (or one pinned with `setMetrics`); `css()` returns `calc(… var(--cdp-<id>))`, which the browser resolves after hydration. See [SSR](../ssr.md).

**Are the numbers the same on Android / iOS / Flutter?** Yes for everything that can be written as JSON (curves, rules, text formulas): a shared 540-case fixture checks every platform (`tests/fixtures/custom-strategy-fixture.json`). Code functions run your own code, so they match as long as the code does.

[Back to the custom docs](README.md)
