# Changelog

## 3.2.0 — port of AppDimens Dynamic 3.2.0

Full rewrite. The web library now mirrors [appdimens-dynamic](https://github.com/bodenberg/appdimens-dynamic) 3.2.0 (Android).
The 2.x API (BALANCED/13-strategy builder, `Fixed` / `Dynamic` / `Fluid` classes) has been removed.

- `DimenMetrics` immutable viewport snapshot with the Android derived factors (scale, AR, power/log/diagonal/perimeter/interpolated).
- Runtime (`DimenCache` analogue): event-driven invalidation, precomputed per-strategy factor tables, one-multiply accessors.
- 12 strategies with the Android names and suffix rules (`sdp`, `sdpa`, `sdpi`, `sdpia`, `Px`, inverters `Ph/Lh/Pw/Lw`, `sp`/`em`): scaled, percent, power, fluid, auto, diagonal, fill, fit, interpolated, logarithmic, perimeter, density — 3,828 generated API names.
- Facilitators `Rotate` / `Mode` / `Qualifier` / `Screen` (+ `Px`, sp, h/w axes), `plain*` branches, `toDynamic<Strategy>Dp/Px/Sp/SpPx`.
- Builders `scaledDp()` / `<strategy>Dp()` with `.screen()` priority rules identical to Android, memoized per snapshot.
- CSS custom properties for every token (constructable stylesheet, CSP-safe), pure-CSS fallback stylesheets, SCSS functions.
- Element scopes (`createDimenScope`) — per-container snapshots.
- `webdimens/resize` (step table + binary search, DOM and canvas text fitting, bounds) and `webdimens/units` (mm / cm / inch).
- Percent literal `space*` API.
- React, Vue 3, Svelte and Angular (signals) bindings; CDN global bundles (full ≈10 KB gzip, lite ≈7 KB gzip).
- Parity test-suite against an independent transcription of the Kotlin kernels; real-browser smoke test.
