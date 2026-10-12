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
- **Write units instead of px**:
  - classes `p:16sdp`, `fs@landscape:24ssp`, `p@tv@sw600:48sdp`, `m:8sdp_16sdp`, `--gap:12sdp`, `!` for `!important`;
  - `data-dimen="padding: 8sdp 16sdp; font-size@tv: 28ssp"`; `<style data-webdimens>` blocks;
  - Android-qualifier conditions (`@landscape`/`@portrait`, `@sw600`/`@w600`/`@h600`, `@tv` … `@fold-half`, `@mw`) with the `.screen()` priority order;
  - modifier classes `ad-a`, `ad-i`, `ad-ia`, `ad-<strategy>` (flags / strategy for a subtree via custom-property redirection);
  - `<html data-ad-mode / data-ad-orientation / data-ad-multi-window>` kept in sync;
  - `webdimens/postcss` plugin (`padding: 16sdp`, nested `@dimen <conditions> { … }`);
  - JS: `dimen('16sdp')`, `dimenCss()`, `dimens({...})` (responsive style objects), `dimensPx()`, `parseToken()`, `dimenClassesToCss()` for SSR.
- Agent skills (`skills/SKILL.md`, `reference.md`, `library-map.md`) and `LLMS.txt`, shipped in the package.
- Parity test-suite against an independent transcription of the Kotlin kernels; real-browser smoke test.
