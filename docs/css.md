# CSS, Sass and PostCSS

Everything webdimens does in CSS rests on custom properties: `install()` publishes the size of one unit per token
(`--sdp`, `--ssp`, `--pwsdp`…), and every other form — plain `calc()`, the pure-CSS fallback, Sass functions and the PostCSS
plugin — writes `calc(N * var(--token))`. This page covers each form and when to use it.

## The custom properties

After `install()` (or the CDN script), `:root` carries one property per CSS token of every registered strategy, holding the
size of **one unit** in CSS px. On a 600 × 900 window with font scale 1.25:

| Property | Value | Meaning |
|---|---|---|
| `--sdp` / `--hdp` / `--wdp` | `2px` / `3px` / `2px` | 1 dp on the smallest-width / height / width axis |
| `--sdpa`, `--sdpi`, `--sdpia`, `--hdpLw`, `--sdpPh`, … | | every `dp` variant: flags `a` `i` `ia` and inverters |
| `--ssp` / `--hsp` / `--wsp` (+ `a` `i` `ia`) | `2.5px` / … | text: × font scale |
| `--sem` / `--hem` / `--wem` (+ `a` `i` `ia`) | `2px` / … | text without font scale |
| `--pwsdp`, `--fsdp`, `--logsdp`, … | | the same families for each registered strategy (see below) |
| `--ad-w` `--ad-h` `--ad-sw` | `600px` `900px` `600px` | viewport width, height, smallest width |
| `--ad-density` `--ad-dpi` | `2` `320` | devicePixelRatio and dpi (× 160) |
| `--ad-font-scale` | `1.25` | font scale |
| `--ad-landscape` `--ad-multi-window` | `0` / `1` | numeric flags usable in `calc()` |

A strategy is registered automatically when the runtime sees one of its tokens (JS, class, `data-dimen`, `ad-<id>`). CSS the
runtime never parses — hand-written `var(--fsdp)` or PostCSS output — needs `install({ strategies: ['fluid'] })` (or `'all'`).
`sp`/`em` variants with inverters and `Px` variants are JavaScript-only. The values are written with a
constructable stylesheet (CSP-safe; falls back to a `<style>` element with `cssNonce`) using the selector `:root:root`, so they
override the fallback stylesheet below. They are rewritten at most once per animation frame, only when the snapshot changes.

## Writing calc() by hand

```css
.card {
  padding: calc(16 * var(--sdp));              /* 16sdp */
  border-radius: calc(12 * var(--sdpa));       /* 12sdpa */
  gap: calc(8 * var(--sdp)) calc(4 * var(--hdp));
  font-size: calc(14 * var(--ssp));            /* 14ssp */
  width: max(calc(120 * var(--wdp)), 240px);   /* mix freely with CSS */
}
@media (orientation: landscape) {
  .card { padding: calc(24 * var(--sdp)); }
}
:root[data-ad-mode="tv"] .card { font-size: calc(28 * var(--ssp)); }
```

`cssDimen()` builds the same string in JavaScript: `cssDimen('sdpa', 16)` → `"calc(16 * var(--sdpa))"`.

### Design tokens on top

```css
:root {
  --space-1: calc(4 * var(--sdp));
  --space-2: calc(8 * var(--sdp));
  --space-4: calc(16 * var(--sdp));
  --text-body: calc(14 * var(--ssp));
  --radius-card: calc(12 * var(--sdp));
}
.card { padding: var(--space-4); font-size: var(--text-body); border-radius: var(--radius-card); }
```

Because `--sdp` changes on resize, every token derived from it follows.

## Pure-CSS fallback (no JavaScript, first paint)

Fallback stylesheets define the tokens with viewport units, so pages are scaled before the script runs, or without JavaScript:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/webdimens@3/css/webdimens.css">
```

```js
// bundlers
import 'webdimens/css';                      // scaled tokens (css/webdimens.css)
import 'webdimens/css/strategies/fluid.css'; // one strategy
import 'webdimens/css/all.css';              // every strategy
```

| Strategy | Pure-CSS value | Quality |
|---|---|---|
| scaled, percent | `calc(min(100vw, 100vh) / 300)` (h: `100vh`, w: `100vw`) | exact without the `a` correction |
| fluid | `clamp(0.8px, 0.8px + (min(100vw, 100vh) - 320px) * 0.000892857, 1.2px)` | exact without `a` |
| fill / fit | `max/min(min(100vw, 100vh) / 300, max(100vw, 100vh) / 533)` | exact without `a` |
| interpolated | `calc(0.5px + min(100vw, 100vh) / 600)` | exact without `a` |
| perimeter | `calc((100vw + 100vh) / 833)` | exact without `a` |
| diagonal | `calc(hypot(100vw, 100vh) / 611.6305)` inside `@supports (width: hypot(1px, 1px))` | exact without `a` where `hypot()` is supported |
| power, auto | linear approximation | approximate |
| logarithmic | `1px` | placeholder |
| density | `1px`, then steps from `@media (min-resolution: 1.25dppx … 4dppx)` | stepped |

Limits of the fallback: `sp` equals `dp` (no font scale), `a` variants equal the plain ones, inverters use orientation media
queries, and `vw`/`vh` differ slightly from the runtime's measurement (scrollbars, mobile URL bars). The runtime replaces all
values as soon as it starts.

**CSS-only usage.** For linear strategies the fallback alone is enough: link `webdimens/css`, write `calc(16 * var(--sdp))`,
and skip JavaScript entirely ([examples/css-only.html](../examples/css-only.html)). Classes, `data-dimen`, conditions on UI
mode and modifier classes need the runtime.

## Sass

Every CSS token is a Sass function that returns the `calc()` expression:

```scss
@use 'webdimens/scss' as d;

.card {
  padding: d.sdp(16);                 // calc(16 * var(--sdp))
  font-size: d.ssp(14);               // calc(14 * var(--ssp))
  margin: d.pwhdpa(8);                // calc(8 * var(--pwhdpa))
  gap: d.dimen(sdpLw, 4);             // generic form: calc(4 * var(--sdpLw))
}
```

The file is `scss/_webdimens.scss`. With a direct path: `@use 'node_modules/webdimens/scss/webdimens' as d;`. Sass only
writes the expressions; the values still come from the runtime or the fallback CSS.

## PostCSS plugin

Write units directly in any CSS file and compile them at build time (zero runtime cost for the conversion):

```js
// postcss.config.mjs
import webdimens from 'webdimens/postcss';

export default { plugins: [webdimens()] };
```

```css
.card {
  padding: 8sdp 16sdp;
  font-size: 14ssp;
  margin: max(8sdp, 4px) auto;
  background: url(/img/16sdp.png);      /* url() and quoted strings are never rewritten */

  @dimen landscape { padding: 12sdp 24sdp; }
  @dimen sw600 { padding: 24sdp 32sdp; }
  @dimen tv { font-size: 28ssp; }
  @dimen tv sw600 { padding: 48sdp; }
}
```

Output (verbatim from the plugin; the formatting is PostCSS's, the CSS is valid):

```css
.card {
  padding: calc(8 * var(--sdp)) calc(16 * var(--sdp));
  font-size: calc(14 * var(--ssp));
  margin: max(calc(8 * var(--sdp)), 4px) auto;
  background: url(/img/16sdp.png)      /* url() and quoted strings are never rewritten */
}
@media (orientation: landscape) {
  .card { padding: calc(12 * var(--sdp)) calc(24 * var(--sdp))
  }
}
@media (min-width: 600px) and (min-height: 600px) {
  .card { padding: calc(24 * var(--sdp)) calc(32 * var(--sdp))
  }
}
:root[data-ad-mode="tv"] .card { font-size: calc(28 * var(--ssp))
}
@media (min-width: 600px) and (min-height: 600px) {
  :root[data-ad-mode="tv"] .card { padding: calc(48 * var(--sdp))
  }
}
```

- `@dimen <conditions> { … }` takes the same conditions as classes (`landscape`, `portrait`, `sw600`, `w840`, `h480`, UI modes,
  `mw`, combinations separated by spaces). It must be nested in a style rule.
- Generated blocks are emitted after their parent **in Android priority order** (mode + qualifier > mode > qualifier, larger
  threshold later > orientation), whatever order you wrote them in.
- JavaScript-only tokens (`2sdpPx`) and unknown conditions fail the build with a clear error.
- Option: `webdimens({ atRule: 'screen' })` renames `@dimen`.
- The `@tv` / `@mw` rules need the runtime at run time (it sets `<html data-ad-mode>`); media-query conditions work with the
  fallback CSS alone.

### Setup per tool

| Tool | Where |
|---|---|
| Vite | `postcss.config.mjs` at the project root (picked up automatically) |
| Next.js | `postcss.config.mjs` with `plugins: { 'webdimens/postcss': {} }` (the CommonJS build exports the plugin function itself) |
| webpack | `postcss-loader` with the same config file |
| CLI | `npx postcss input.css -o output.css` (see [examples/postcss/](../examples/postcss/)) |

```js
// Next.js postcss.config.mjs (string form)
export default { plugins: { 'webdimens/postcss': {} } };
```

The plugin object is typed to be assignable to PostCSS's own `Plugin` type, so TypeScript configs work without casts.

## Coexisting with other tools

- **Tailwind CSS**: dimension classes only claim class names whose value contains a unit token, so `hover:bg-red-500` or
  `md:p-4` are untouched. You can also use the tokens inside Tailwind arbitrary values: `p-[calc(16*var(--sdp))]`.
- **CSS Modules / scoped styles**: custom properties inherit normally; write `calc(16 * var(--sdp))` or use the PostCSS plugin.
  Hashed class names do not matter: the plugin only rewrites declaration values and `@dimen` blocks.
- **Shadow DOM**: custom properties inherit into shadow roots, so `var(--sdp)` works inside web components. The class compiler
  only scans the main document; inside a shadow root use `var()` or the PostCSS output.

Next: [JavaScript API](./javascript.md) · [Back to the index](./README.md)
