# Strategies

A strategy is the curve that turns a dp value into CSS px as the window grows. webdimens ships the 12 strategies of AppDimens
Dynamic with identical formulas and name prefixes. **Start with scaled** (`sdp`); switch only where visual QA shows the
curve is wrong for a part of the UI.

## Comparison

16 dp through every strategy on reference windows (generated from the real build by `npm run strategy-table`):

`s` axis, no flags:

| Strategy (16 dp) | Small phone 320×640 | Phone 412×915 | Tablet 768×1024 | Laptop 1280×800 | TV 1920×1080 |
|---|---:|---:|---:|---:|---:|
| `sdp` scaled | 17.1 | 22.0 | 41.0 | 42.7 | 57.6 |
| `psdp` percent | 17.1 | 22.0 | 41.0 | 42.7 | 57.6 |
| `pwsdp` power | 16.8 | 20.3 | 32.4 | 33.4 | 41.8 |
| `fsdp` fluid | 12.8 | 14.1 | 19.2 | 19.2 | 19.2 |
| `asdp` auto | 17.1 | 22.0 | 29.9 | 30.2 | 32.6 |
| `logsdp` logarithmic | 16.4 | 18.0 | 22.0 | 22.3 | 24.2 |
| `isdp` interpolated | 16.5 | 19.0 | 28.5 | 29.3 | 36.8 |
| `dgsdp` diagonal | 18.7 | 26.3 | 33.5 | 39.5 | 57.6 |
| `prsdp` perimeter | 18.4 | 25.5 | 34.4 | 40.0 | 57.6 |
| `flsdp` fill | 19.2 | 27.5 | 41.0 | 42.7 | 57.6 |
| `ftsdp` fit | 17.1 | 22.0 | 30.7 | 38.4 | 57.6 |
| `dsdp` density | 32.0 | 42.0 | 32.0 | 16.0 | 16.0 |

`a` (aspect ratio) variants:

| Strategy (16 dp) | Small phone 320×640 | Phone 412×915 | Tablet 768×1024 | Laptop 1280×800 | TV 1920×1080 |
|---|---:|---:|---:|---:|---:|
| `sdpa` scaled | 17.2 | 23.0 | 35.2 | 40.4 | 57.6 |
| `psdpa` percent | 17.2 | 23.0 | 35.2 | 40.4 | 57.6 |
| `pwsdpa` power | 16.8 | 20.3 | 32.4 | 33.4 | 41.8 |
| `fsdpa` fluid | 12.8 | 14.1 | 19.2 | 19.2 | 19.2 |
| `asdpa` auto | 17.1 | 22.0 | 29.9 | 30.2 | 32.6 |
| `logsdpa` logarithmic | 16.4 | 18.0 | 22.0 | 22.3 | 24.2 |
| `isdpa` interpolated | 16.5 | 19.0 | 28.5 | 29.3 | 36.8 |
| `dgsdpa` diagonal | 18.7 | 26.3 | 33.5 | 39.5 | 57.6 |
| `prsdpa` perimeter | 18.4 | 25.5 | 34.4 | 39.9 | 57.6 |
| `flsdpa` fill | 19.2 | 27.5 | 40.9 | 42.7 | 57.6 |
| `ftsdpa` fit | 17.1 | 22.0 | 30.7 | 38.4 | 57.6 |
| `dsdpa` density | 32.0 | 42.0 | 32.0 | 16.0 | 16.0 |

The satellite strategies' `a` variants barely differ from the plain ones because their correction is
`1 + k × ln(AR / 1.78)` with `k = 0.08 / 30`; scaled and percent use `1 + (d − 300) × (1/300 + k × ln(AR / 1.78))`, which moves
more. On a 16:9 TV (`AR ≈ 1.78`) every correction is neutral. Only density depends on devicePixelRatio
(2, 2.625, 2, 1, 1 on the windows above). A live version of this table is [examples/strategies.html](../examples/strategies.html).

## Choosing

| Need | Strategy |
|---|---|
| General UI, the Android default | **scaled** `sdp` |
| Large screens feel too big with linear growth | **power** `pwsdp`, **auto** `asdp`, **logarithmic** `logsdp` |
| Bounded growth (0.8× to 1.2×), e.g. body text | **fluid** `fsdp` |
| Halfway between fixed and linear | **interpolated** `isdp` |
| Follow the screen diagonal / perimeter (ultrawide, kiosks) | **diagonal** `dgsdp`, **perimeter** `prsdp` |
| Cover / contain against the 300 × 533 reference | **fill** `flsdp`, **fit** `ftsdp` |
| Classic density scaling | **density** `dsdp` |
| Literal percentage of the window | `spaceW(10)` from `webdimens/percent` (see [Units and space](./units.md)) |

Every strategy has the same suffix rules (`h`/`w` axes, `sp`/`em`, flags, inverters, `Px`), facilitators (`pwsdpRotate`…),
generic resolvers (`toDynamicPowerDp`…) and builder (`powerDp(16).pwsdp`). In the formulas, `d` is the axis length in dp
(smallest width for `s`), `w`/`h` the window, `min`/`max` its sides.

## Scaled — `webdimens` · prefix `''`

```
sdp(v) = v × d / 300
sdpa(v) = v × (1 + (d − 300) × (1/300 + k × ln(AR / 1.78)))
```

Linear, identical to Android's default. `import { sdp } from 'webdimens'` · class `p:16sdp` · CSS `calc(16 * var(--sdp))`.

## Percent — `webdimens/percent` · prefix `p`

```
psdp(v) = v × d / 300          (a: same law as scaled)
```

Numerically the same curve as scaled, kept as its own token family so a subtree can switch with `ad-percent`. The module also
exports the literal `space*` API (`spaceW(10)` = 10 % of the width). `import { psdp, spaceW } from 'webdimens/percent'`.

## Power — `webdimens/power` · prefix `pw`

```
pwsdp(v) = v × (d / 300)^0.75
```

Sublinear: grows less than scaled on tablets and desktops. Good for spacing in apps that also run on large screens.
`pwsdp(16)` on 600 × 900 → 26.91 (scaled: 32).

## Fluid — `webdimens/fluid` · prefix `f`

```
factor = 0.8                                 if d ≤ 320
factor = 0.8 + 0.4 × (d − 320) / 448         if 320 < d < 768
factor = 1.2                                 if d ≥ 768
```

Bounded between 0.8× and 1.2× of the design value: never tiny, never huge. Useful for body text and fine details.

## Auto — `webdimens/auto` · prefix `a`

```
factor = d / 300                                         if d ≤ 480
factor = 1.6 + 0.4 × ln(1 + (d − 480) / 300)             if d > 480
```

Linear like scaled on phones, logarithmic after 480 dp: a phone/tablet "knee".

## Logarithmic — `webdimens/logarithmic` · prefix `log`

```
factor = 1 + 0.4 × ln(d / 300)               if d > 300
factor = 1 − 0.4 × ln(300 / d)               if d ≤ 300
```

Strong damping on every screen size.

## Interpolated — `webdimens/interpolated` · prefix `i`

```
factor = 1 + (d / 300 − 1) × 0.5
```

Halfway between a fixed value and scaled.

## Diagonal — `webdimens/diagonal` · prefix `dg`

```
factor = √(w² + h²) / 611.63                 (axis independent)
```

Follows the window diagonal; the reference diagonal is √(300² + 533²).

## Perimeter — `webdimens/perimeter` · prefix `pr`

```
factor = (w + h) / 833                       (axis independent)
```

## Fill — `webdimens/fill` · prefix `fl`

```
factor = max(min / 300, max / 533)           (axis independent)
```

"Cover": scales so the reference 300 × 533 frame fills the window.

## Fit — `webdimens/fit` · prefix `ft`

```
factor = min(min / 300, max / 533)           (axis independent)
```

"Contain": scales so the reference frame fits inside the window.

## Density — `webdimens/density` · prefix `d`

```
factor = devicePixelRatio                    (axis independent)
```

The classic Android density scaling (`densityDpi / 160`); on the web it is the device pixel ratio, so values do not depend on
the window size. Rarely what a web layout wants; provided for parity.

## Custom — `webdimens/custom` · `cdp` / `csp`

When none of the twelve curves fits, define your own: reference frame, axis, curve (`linear`, `power`, `logarithmic`, `interpolated`, `constant`, `breakpoints`, a free-form text `expression`, or a function; plus a per-value `formula`), factor and value bounds, font-scale policy, and rules per device class / screen range / orientation. Use it as `cdp(16, brand)`, `brand.css(16)` or `16cdp-brand`. The same JSON works on every AppDimens platform. See [Custom strategies](./custom.md).

## Using several strategies

Every strategy definition ships with the core, and a strategy **registers itself on first use** — a JS token
(`dimen('16pwsdp')`), a class or `data-dimen` value (`p:16pwsdp`) or a modifier class (`ad-power`). Registering publishes its CSS
variables (`--pwsdp`…) and its modifier class. The CDN bundle registers all twelve.

```js
import { install, dimen } from 'webdimens';
import { pwsdp } from 'webdimens/power';      // import a module only for its named functions

dimen('10logsdp');                             // works without importing webdimens/logarithmic
install({ strategies: ['fluid'] });            // CSS the runtime never parses: hand-written var(--fsdp), PostCSS output
```

- `install({ strategies: [...] })` (ids: `scaled`, `percent`, `power`, `fluid`, `auto`, `diagonal`, `fill`, `fit`, `interpolated`,
  `logarithmic`, `perimeter`, `density`, or `'all'`) is only needed when a strategy's variables are used by CSS the runtime never
  sees. `register(FLUID)` does the same with the definition each module exports.
- Switch a subtree without renaming tokens: `<aside class="ad-power">…class="p:16sdp"…</aside>` makes `--sdp` mean power
  inside (see [Declarative units](./declarative.md#modifier-classes)).

Next: [Frameworks](./frameworks.md) · [Back to the index](./README.md)
