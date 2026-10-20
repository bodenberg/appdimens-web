---
name: webdimens-workflow
description: Use this skill for any responsive sizing question on the web — making a site or web app scale correctly across phones, tablets, desktops, TVs and foldables — and whenever the user mentions webdimens, appdimens, AppDimens Dynamic for web, sdp, hdp, wdp, ssp, sem, "16sdp"-style units, dimension classes like `p:16sdp`, data-dimen, ad-a / ad-i modifier classes, the webdimens PostCSS plugin, or porting Android dp/sp layouts to CSS/JS, or defining a custom scaling strategy (own scaling config, per-device rules, cdp/csp, defineScalingStrategy, scaling JSON shared across platforms). Covers install, choosing a usage form (classes, data-dimen, CSS/PostCSS, JS, frameworks), conditions (orientation, sw/w/h qualifiers, UI mode, multi-window), flags, strategies, resize and SSR.
---

# webdimens — project workflow

**Library:** `webdimens` 3.2.0 — web port of AppDimens Dynamic 3.2.0 (Android). Same math, same names.
**Install:** `npm i webdimens` (or `yarn add` / `pnpm add`) · CDN `https://cdn.jsdelivr.net/npm/webdimens@3/dist/webdimens.global.js`.
**Reference:** [reference.md](reference.md) (complete API) · [library-map.md](library-map.md) (modules, Android ↔ web) · full docs in [docs/](../docs/README.md) (recipes: docs/recipes.md, troubleshooting: docs/troubleshooting.md).

---

## Core idea (explain this first when users are new)

A value written in **dp** at a 300 dp reference is scaled by the current viewport, exactly like Android `16.sdp`:
`sdp(16) = 16 × min(width, height) / 300` CSS px. `hdp` uses height, `wdp` width; `ssp` is text (× user font scale),
`sem` is text without font scale. The user writes **units instead of px**: `16sdp`, `14ssp`, `12sspa`, `8hdpLw`.

## Phase 0 — Baseline (ask only what is unknown)

1. **Stack:** plain HTML, React, Vue, Svelte, Angular, other? Build tool with PostCSS (Vite/Next/webpack) or none?
2. **SSR?** (Next/Nuxt/SvelteKit/Angular SSR) → prefer CSS forms (classes, `data-dimen`, `dimens()`, PostCSS), not JS numbers.
3. **Scope:** whole app or specific components/screens?
4. **Acceptance criteria** per screen in plain language ("comfortable padding on a 10-inch tablet", "TV title readable from 3 m").

## Phase 1 — Pick the usage form (prefer the first that fits)

| Situation | Use | Example |
|---|---|---|
| Markup you control, no CSS file wanted | **classes** | `class="p:16sdp fs:14ssp fs@tv:28ssp"` |
| Many declarations on one element | **`data-dimen`** | `data-dimen="padding: 8sdp 16sdp; font-size@landscape: 18ssp"` |
| Component/global CSS files with a build | **PostCSS plugin** | `padding: 16sdp; @dimen sw600 { padding: 32sdp; }` |
| CSS without build | `<style data-webdimens>` or `calc(16 * var(--sdp))` | |
| Sass | `@use 'webdimens/scss' as d; padding: d.sdp(16)` | |
| Inline styles in React/Vue | **`dimens()`** (responsive, SSR-safe) | `style={dimens({ padding: '16sdp' })}` |
| Canvas, measurements, JS math | `dimen('2sdpPx')`, `sdpPx(2)`, `sdp(16)` | re-render with `useDimens()` |

Always call `install()` once in the app entry (the CDN script does it automatically). Frameworks: `useWebDimens()` (React),
`app.use(WebDimens)` (Vue), `provideWebDimens()` (Angular), `install()` in Svelte `main`.

## Phase 2 — Strategy and axis

- **Default: scaled** (`sdp`, `hdp`, `wdp`, `ssp`). Recommend it first.
- `sdp` for spacing / radii / icons; `hdp` vertical rhythm; `wdp` width-driven columns; `ssp` text; `sem` text that must ignore the user's font setting (rare — prefer `ssp` for accessibility).
- `a` suffix (`sdpa`) when very wide/tall windows look too large/small; `i` suffix only for split-screen policies.
- Other strategies only when visual QA asks for another curve: power `pw` (softer on big screens), fluid `f` (bounded 0.8–1.2×), auto `a`, logarithmic `log` (strong damping), interpolated `i`, percent `p` (+ literal `spaceW(10)`), diagonal `dg`, perimeter `pr`, fill `fl`, fit `ft`, density `d`. Strategies register automatically the first time one of their tokens is used (`dimen('10pwsdp')`, `p:10pwsdp`, `data-dimen`, `class="ad-power"`). For tokens the runtime never sees — hand-written `var(--pwsdp)` or PostCSS output — add `install({ strategies: ['power'] })` (or `'all'`). Import the module only for its named functions (`pwsdp`, `powerDp`).
- Subtree switch without renaming tokens: `class="ad-power"`, flags: `ad-a`, `ad-i`, `ad-ia`.
- **Custom strategy** (`webdimens/custom`) only when no built-in passes QA, or one law must be shared with other platforms or apps:
  1. Start from a built-in or preset: `BuiltInStrategies.POWER.extend('x', …)`, `CustomPresets.TABLET_FRIENDLY`, `"extends"`.
  2. Keep one source: a JSON file loaded with `loadScalingStrategies`, or one module that calls `defineScalingStrategy`. Reuse the ids from `appdimens.config.json` (`customStrategies`) when present.
  3. Express device or screen differences as `rules` (`when: { device: 'tv' }`, `when: { width: { min: 1024 } }`), never as `if`s at call sites.
  4. Use `cdp(16, brand)` / `csp(14, brand)` in JS, and `brand.css(16)` / `16cdp-brand` for responsive SSR-safe CSS. In frameworks use `useScalingStrategy()`.
  5. `valueClamp` / `transform` make the strategy value-dependent, so `css()` falls back to px literals. Use them only for hard limits.
  6. Verify with `brand.explain()` on a phone, a tablet and a desktop width.

## Phase 3 — Conditions (Android qualifiers)

Classes / `data-dimen` / `@dimen`: `@landscape` `@portrait`, `@sw600` `@w840` `@h480` (≥ dp), `@tv` `@car` `@watch` `@desk` `@vr`
`@fold-open` `@fold-half` … , `@mw`. Combine with `@a@b`. Priority (independent of order): mode + qualifier > mode > qualifier
(larger threshold wins) > orientation > default — identical to Android `.screen()`.
JS equivalents: `sdpRotate`, `sdpMode`, `sdpQualifier`, `sdpScreen`, or the builder `scaledDp(16).screen(...)`.
Force a UI mode in kiosks/TV apps: `install({ uiModeType: UiModeType.TELEVISION })`.

## Phase 4 — Resize (fit-to-container, not global scaling)

Text that must fit a box: `autoResizeText(el, { min: 12, max: 34, maxLines: 2 })` from `webdimens/resize`; canvas/no-reflow:
`fittingTextPx({ text, maxWidth, font })`. The box must be constrained (in grid/flex: `min-width: 0` / `minmax(0, 1fr)`).

## Rules

1. Never mix px and dimension units for the same token family in one component without a reason. Port Android `16.sdp` as `16sdp` 1:1, and keep literal px for values that must not scale with the viewport.
2. Prefer CSS forms for layout (no re-render, SSR-safe). Use JS numbers only for canvas/measurement, wrapped in `useDimens()` / `useDimen()` (React) or the framework equivalent.
3. `Px` suffix = **device** pixels (× devicePixelRatio) — only for canvas/WebGL. CSS px = no suffix.
4. Don't recommend `i` variants or `@mw` unless the user asks about split-screen behaviour.
5. Keep diffs small; run `npm test` (and `node scripts/browser-check.mjs` for layout changes) in this repo.
6. `Px` tokens and `sp`/`em` tokens with an inverter (`16sdpPx`, `14sspLw`, `semPh`) are JS-only. Use them with `dimen()`, `dimensPx()` or the `…Px` functions, never in classes, `data-dimen`, `dimens()` or CSS.
7. Literals are recognised as whole words (also next to `*`: `calc(8sdp*2)` works); text inside `url(...)` and quoted strings is never rewritten.

## Output style

For each recommendation state: usage form, token (strategy + axis + flags), conditions, and which acceptance criterion it serves.
