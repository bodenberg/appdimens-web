# Custom strategies: agent reference

Use when the user wants their own scaling (a formula, per-device rules, a shared JSON) instead of a built-in. Entry: `webdimens/custom`. Docs: `docs/custom/` (start at [docs/custom/README.md](../docs/custom/README.md)).

## Decide the form

1. **A built-in passes visual QA?** Keep it. Custom strategies are for when none fits.
2. **The user describes math** ("scale by width over 360, between 0.85 and 1.8"):
   - multiplies every value → `customScaleStrategy(({ width, clamp }) => clamp(width / 360, 0.85, 1.8))`
   - computes the final value from `base` → `scalingFormula(({ base, sw, pow }) => base * pow(sw / 360, 0.8))`
3. **The formula must live in JSON / remote config / design tokens** → text: `scalingFormula('base * pow(sw / 360, 0.8)')`, `cdp(16, '…')`, JSON `"formula"`.
4. **Different behavior per device / width range / orientation, bounds, font-scale cap** → `defineScalingStrategy({ id, …, rules: [{ when: { device: 'tablet' }, set: {…} }] })` or the JSON document.
5. **Several apps or platforms share it** → the JSON document, loaded once (`loadScalingStrategies(await (await fetch('/appdimens-strategies.json')).text())`).

## Cheat sheet

```ts
import { cdp, csp, cdpCss, customScaleStrategy, scalingFormula, defineScalingStrategy,
  setDefaultScalingStrategy, loadScalingStrategies, CustomPresets, BuiltInStrategies } from 'webdimens/custom';
// cdp(16, s): CSS px · cdpPx: device px · csp / cspPx: text · cdpCss / s.css(16): calc(16 * var(--cdp-<id>))

const product = customScaleStrategy(({ width, clamp }) => clamp(width / 360, 0.85, 1.8));
const hud = scalingFormula(({ base, sw, pow }) => base * pow(sw / 360, 0.8));
const brand = defineScalingStrategy({
  id: 'brand', reference: { width: 360, height: 640 }, curve: { type: 'power', exponent: 0.8 },
  clamp: { min: 0.85, max: 1.6 }, fontScale: { max: 1.3 },
  rules: [{ when: { device: ['tablet', 'desktop'] }, set: { curve: { type: 'logarithmic', k: 0.4 } } }],
});
setDefaultScalingStrategy(brand);            // cdp(16) / 16cdp / var(--cdp) without an id
// CSS / PostCSS / dimens(): 16cdp-brand · 14csp-brand · var(--cdp-brand)
// React: <ScalingStrategyProvider strategy={brand}> + useScalingStrategy() · Vue: provideScalingStrategy / useScalingStrategy / useCdp
// Svelte: scalingStrategy('brand') store · Angular: provideScalingStrategy(brand) + injectScalingStrategy()
```

Scope names (code and text): `base` (formula only) `sw width height shortSide longSide diagonal perimeter aspectRatio ratio density fontScale`, flags `phone tablet desktop tv watch car vr landscape portrait multiWindow` (booleans in code, 1/0 in text), code-only `device screen`, math `pow sqrt ln log10 exp abs round min max clamp lerp smoothstep`. `ratio = sw / 300`, so `base * ratio` = `sdp`.

## Rules an agent must follow

- **Declare strategies once** (module-level `const`, one `strategies.ts`, or JSON). Never build `customScaleStrategy(…)` / `scalingFormula((s) => …)` inside a render function or per-instance `setup`; wrap in `useMemo` if it must be local. Inline text (`cdp(16, '…')`) is shared per text and is fine.
- **Functions are pure**: no state, settings, time or DOM inside. Different state → different strategy or a rule.
- **Prefer a factor** when the math is `base × screen-term`: `customScaleStrategy`, a curve, or text shaped `base * (…)` all cost one multiply and keep `css()` as a CSS variable. `base * sw / 360` misses the text fast path; write `base * (sw / 360)`.
- **Prefer CSS for layout** (`s.css(16)`, `16cdp-brand`): no re-render, SSR-safe. Value-dependent strategies (`valueClamp`, code formulas, `transform`) return px from `css()`.
- **Value bounds** (`valueClamp`) only for real absolute limits (tap targets, max text); they must be ≥ 0.
- **Text vs code**: code functions cannot be exported to JSON; use text when the user mentions JSON, remote config, A/B tests or other platforms.
- **Device rules vs width rules**: a fine pointer counts as `desktop`; when only size matters, use `when: { width: { min: 1024 } }`.
- A string strategy is an id first, then a formula: `cdp(16, 'brnd')` (typo) throws `No scaling strategy 'brnd'`.

## Verify

- `brand.explain()` (or `useScalingStrategy().explain()`) prints the axis, curve, factor, applied rules and formula.
- JSON files: `npx appdimens-skills kit custom check <file>` and `kit custom explain --formula "<text>" --devices medium-phone,medium-tablet`.
- Errors carry the JSON path or the formula position (`TypeError` / `RangeError` / `SyntaxError`); see [docs/custom/troubleshooting.md](../docs/custom/troubleshooting.md).
