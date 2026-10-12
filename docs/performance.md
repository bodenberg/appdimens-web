# Performance

webdimens is designed so that the common operations cost (almost) nothing: resolving a value is one multiply, resizing the
window rewrites a handful of CSS variables once per frame, and the declarative rules are compiled once and never touched again.
This page shows how, the measured numbers, bundle sizes and the practices that keep an app fast.

## How the hot path works

1. **Event → dirty flag.** `resize`, orientation, DPR and posture events only set a flag; nothing is computed in the handler.
2. **Snapshot rebuild, once.** The next read (or the next animation frame) builds an immutable `DimenMetrics` and fills one
   `Float64Array` of 44 factors per registered strategy (11 axis variants × 4 flags). Transcendental math (`pow`, `ln`, `sqrt`)
   runs here, once per window change, never per call.
3. **Accessors.** `sdp(v)` is `if (S.dirty) sync(); return v * table[0];` — no allocation, no object lookup, no branching on
   options. `ssp` adds × font scale, `Px` variants × devicePixelRatio.
4. **CSS.** The runtime rewrites the custom properties (one constructable stylesheet, only when the text changed) and notifies
   subscribers at most once per animation frame.
5. **Declarative rules.** Each distinct class / attribute is compiled once. Resizing does not touch them: they reference the
   variables.

## Measured

`node scripts/bench.mjs` after `npm run build` (Node 22, a 4-vCPU cloud container; 20 M calls each, through an indirect call
so the harness itself costs about 2 ns):

| Call | ns/op | ops/s |
|---|---:|---:|
| baseline `v * 412 / 300` | 2.2 | 460 M |
| `sdp(v)` | 9.3 | 108 M |
| `sdpa(v)` | 9.8 | 103 M |
| `ssp(v)` | 10.8 | 93 M |
| `pwsdp(v)` (power) | 9.1 | 110 M |
| `toDynamicScaledDp(v, HEIGHT, { applyAspectRatio: true })` | 26.7 | 37 M |
| `builder.sdp` (memoized per snapshot) | 17.9 | 56 M |

Declarative runtime, measured in Chromium:

| Scenario | Cost |
|---|---|
| `install()` on a page with 10,000 elements carrying dimension classes | ~26 ms, once |
| 1,000 class toggles | ~3 ms |
| 1,000 new nodes | ~5 ms |
| window resize | 0 ms of JavaScript for the compiled rules (only the variables change) |

Run the micro-benchmark on your machine with `npm run build && npm run bench`.

## Bundle sizes

Minified + gzip, measured with esbuild:

| What you import | Size |
|---|---:|
| `import { sdp } from 'webdimens'` | ≈ 5.3 KB |
| `import { install } from 'webdimens'; install()` (runtime, CSS variables, declarative compiler, all strategy definitions) | ≈ 8.8 KB |
| CDN `webdimens.global.js` (everything, including resize and units) | ≈ 15 KB |
| CDN `webdimens.lite.global.js` (runtime + scaled) | ≈ 12 KB |

The package has no runtime dependencies and is tree-shakable: strategy accessors, facilitators, resize and units are only
included when imported.

## Best practices

- **Prefer CSS forms for layout.** Classes, `data-dimen`, `dimens()` and `var(--sdp)` update without any JavaScript on resize
  and never re-render components.
- **Re-render only what needs numbers.** In React use `useDimen(() => …, deps)` in the components that really need a number
  (canvas, measured layouts), not `useDimens()` at the app root.
- **Keep builders at module scope.** `const gutter = scaledDp(16).screen(…)` once; reading `.sdp` is memoized per snapshot.
- **`Px` only for device pixels.** Canvas and WebGL; never for CSS.
- **Use `subscribe()` for imperative updates** (canvas redraws) instead of your own `resize` listeners: it is already batched to
  one call per frame and only fires when the snapshot really changed.
- **Avoid forced layout in loops.** `fittingTextSize` / `autoResizeText` measure the DOM (a binary search of ≈ log₂(steps)
  layouts); for many labels prefer `fittingTextPx` (canvas, no reflow).
- **Register strategies you only use in hand-written CSS** with `install({ strategies })`; everything else registers on first
  use, and only registered strategies cost anything per resize.

Next: [Recipes](./recipes.md) · [Back to the index](./README.md)
