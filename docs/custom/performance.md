# Performance

> **Languages:** English · [Português (BR)](../pt-BR/custom/performance.md)

Custom strategies cost the same as the built-ins when they only depend on the screen. Which form you pick decides the lane.

| Form | Per window snapshot | Per value | `css()` |
|---|---|---|---|
| `customScaleStrategy(…)`, any curve, rules, factor bounds, aspect ratio | function / curve once | one multiply | CSS variable |
| text formula shaped `base * E` (E reads no value) | `E` once | one multiply | CSS variable |
| `scalingFormula((s) => …)`, other text formulas, `transform`, `valueClamp` | | formula / function on every call | px literal of the current viewport |

## How it works

- **Memo per snapshot.** Each strategy keeps the last resolved snapshot (rules applied, factor computed). A new snapshot (resize, rotation, font scale, UI mode, multi-window) resolves again once. `resolveScreen(screen)` is not memoized.
- **One multiply.** A screen-only strategy turns `cdp(16, product)` into a memo check plus one multiply.
- **Value-dependent lane.** Value bounds, code formulas, transforms and non-proportional text formulas add a few operations per call; there is no per-value cache on the web, the work is evaluated each time.
- **CSS variables.** `--cdp-<id>` / `--csp-<id>` are rewritten only when the snapshot changes (once per frame at most). Layout written as `brand.css(16)` or `16cdp-brand` follows the viewport with no JavaScript per value and no re-render, which is the cheapest path.
- **Fast path for text.** `base * E` is detected when the formula is parsed; the result is bit for bit the same as evaluating it per value.
- **Tree-shaking.** `webdimens/custom` has no import-time side effects; the CSS publisher and the literal resolver start on the first registration, default change or `css()` call.

## Guidelines

1. Prefer a factor (`customScaleStrategy`, a curve, rules) over a per-value formula when the math is "base × something about the screen".
2. Prefer CSS (`s.css(16)`, `16cdp-brand`, `var(--cdp-brand)`) for layout; use `cdp()` numbers for canvas and measurements.
3. Use `valueClamp` only for real absolute limits (tap targets ≥ 48 px, max text size).
4. Declare strategies once: a module-level `const`, one `strategies.ts` module, or a JSON document loaded at startup.
5. Keep functions pure and cheap. Factor functions run once per snapshot; formula functions run on every call.
6. Inline text formulas (`cdp(16, '…')`) are shared per text, so they are fine in render functions. Building strategies from dynamic strings in a loop is not: past 256 distinct texts each call parses a new strategy.

[Back to the custom docs](README.md)
