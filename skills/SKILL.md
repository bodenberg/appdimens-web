---
name: webdimens-workflow
description: Use this skill for any responsive sizing question on the web — making a site or web app scale correctly across phones, tablets, desktops, TVs and foldables — and whenever the user mentions webdimens, appdimens, AppDimens Dynamic for web, sdp, hdp, wdp, ssp, sem, "16sdp"-style units, dimension classes like `p:16sdp`, data-dimen, ad-a / ad-i modifier classes, the webdimens PostCSS plugin, or porting Android dp/sp layouts to CSS/JS. Covers install, choosing a usage form (classes, data-dimen, CSS/PostCSS, JS, frameworks), conditions (orientation, sw/w/h qualifiers, UI mode, multi-window), flags, strategies, resize and SSR.
---

# webdimens — project workflow

**Library:** `webdimens` 3.2.0 — web port of AppDimens Dynamic 3.2.0 (Android). Same math, same names.
**Install:** `npm i webdimens` (or `yarn add` / `pnpm add`) · CDN `https://cdn.jsdelivr.net/npm/webdimens@3.2.0/dist/webdimens.global.js`.
**Reference:** [reference.md](reference.md) (complete API) · [library-map.md](library-map.md) (modules, Android ↔ web).

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
- Other strategies only when visual QA asks for another curve: power `pw` (softer on big screens), fluid `f` (bounded 0.8–1.2×), auto `a`, logarithmic `log` (strong damping), interpolated `i`, percent `p` (+ literal `spaceW(10)`), diagonal `dg`, perimeter `pr`, fill `fl`, fit `ft`, density `d`. Import the module (`import 'webdimens/power'`) before using its tokens — classes/`dimen()` with an unregistered strategy have no CSS variable / throw a clear error.
- Subtree switch without renaming tokens: `class="ad-power"`, flags: `ad-a`, `ad-i`, `ad-ia`.

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

1. Never mix px and dimension units for the same token family in one component without a reason; convert `16px` → `16sdp` 1:1 when porting an Android/Figma spec at 300–360 dp width.
2. Prefer CSS forms for layout (no re-render, SSR-safe). Use JS numbers only for canvas/measurement, wrapped in `useDimens()` / `useDimen()` (React) or the framework equivalent.
3. `Px` suffix = **device** pixels (× devicePixelRatio) — only for canvas/WebGL. CSS px = no suffix.
4. Don't recommend `i` variants or `@mw` unless the user asks about split-screen behaviour.
5. Keep diffs small; run `npm test` (and `node scripts/browser-check.mjs` for layout changes) in this repo.

## Output style

For each recommendation state: usage form, token (strategy + axis + flags), conditions, and which acceptance criterion it serves.
