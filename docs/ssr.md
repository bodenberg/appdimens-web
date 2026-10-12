# SSR and first paint

How to render pages on the server (Next.js, Nuxt, SvelteKit, Angular SSR, Astro, plain Node) without layout jumps or hydration
mismatches. The short version: **render CSS, not numbers.** Classes, `data-dimen`, `dimens()` and CSS variables produce the
same markup on the server and in the browser; only the variables' values differ, and those are applied by the browser.

## What happens on the server

There is no `window`, so the snapshot is the **300 × 533 reference** (`sdp(16)` = 16) unless you pin another one. Calling
`install()` on the server is safe: it registers the scaled strategy and does nothing else.

```js
import { install, sdp, getMetrics, setMetrics } from 'webdimens';

install();                 // no-op in Node apart from registration
sdp(16);                   // 16 — the 300 × 533 reference
getMetrics();              // 300 × 533

setMetrics({ screenWidthDp: 412, screenHeightDp: 915 });   // when you know the viewport (client hints, device class)
sdp(16);                   // 21.97
```

## Hydration-safe choices

| Technique | Server output | Safe? |
|---|---|---|
| Dimension classes (`class="p:16sdp"`) | the class name | yes — compiled in the browser; pre-compile for the first paint (below) |
| `data-dimen="…"` | the attribute | yes — same as classes |
| `style={dimens({ padding: '16sdp' })}` | `calc(16 * var(--sdp))` | yes — identical string on both sides |
| `calc(16 * var(--sdp))` in CSS, PostCSS output | CSS | yes |
| `sdp(16)`, `dimen('16sdp')`, `dimensPx()` in render | a number | **no** — 16 on the server, the real value in the browser |

For JavaScript numbers, render them after mount (`useEffect` / `onMount` / `afterNextRender`), or with the framework bindings,
which use the server snapshot for the first render (`useDimens()` uses `useSyncExternalStore` with a server snapshot).

## First paint without a flash

Until the runtime starts, `var(--sdp)` and the class rules do not exist. Two things make the first paint correct:

1. **Load the pure-CSS fallback** (`webdimens/css`, or `css/all.css` for every strategy). It defines the variables with viewport
   units, exact for the linear strategies, so `calc(16 * var(--sdp))`, `dimens()` and PostCSS output are right before any script
   runs. See [CSS](./css.md#pure-css-fallback-no-javascript-first-paint).
2. **Pre-compile the dimension classes** so their rules are in the server HTML.

### Pre-compiling classes at build time

```js
// scripts/dimen-classes.mjs — collect dimension classes from the sources and write one CSS file
import { readFileSync, writeFileSync } from 'node:fs';
import { globSync } from 'node:fs';                 // Node 22+; or use the `glob` package
import { dimenClassesToCss } from 'webdimens';

const classes = new Set();
const attributes = new Set();
for (const file of globSync('src/**/*.{html,jsx,tsx,vue,svelte}')) {
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(/class(?:Name)?="([^"]+)"/g)) m[1].split(/\s+/).forEach((c) => classes.add(c));
  for (const m of text.matchAll(/data-dimen="([^"]+)"/g)) attributes.add(m[1]);
}
writeFileSync('src/styles/dimen-classes.css', dimenClassesToCss(classes, attributes));
```

`dimenClassesToCss()` ignores every class that is not a dimension class, so you can feed it all class names. Import the
generated file next to `webdimens/css`. The runtime still compiles classes added at run time (the rules are identical, so a
duplicate is harmless).

```js
dimenClassesToCss(['p:16sdp', 'fs@tv:28ssp', 'flex', 'hover:underline']);
// .p\:16sdp{padding:calc(16 * var(--sdp))}
// :root[data-ad-mode="tv"] .fs\@tv\:28ssp{font-size:calc(28 * var(--ssp))}
```

## Exact values on the server (optional)

When the server knows the viewport — `Sec-CH-Viewport-Width` / `Sec-CH-Viewport-Height` client hints, an app shell per device
class, or a previous visit's cookie — inline the exact variables:

```js
import { cssDeclarations, DimenMetrics } from 'webdimens';

const metrics = new DimenMetrics({ screenWidthDp: 412, screenHeightDp: 915 });
const style = `<style>:root{${cssDeclarations(metrics)}}</style>`;
// :root{--ad-w:412px;--ad-h:915px;--ad-sw:412px;…;--sdp:1.3733px;…}
```

Pin the same snapshot with `setMetrics(metrics)` for the render if you also use JavaScript numbers, and reset it per request
(the snapshot is module state). The browser runtime takes over after hydration with the real measurements.

## Checklist

- [ ] `webdimens/css` (or `css/all.css`) loaded before the content
- [ ] Dimension classes pre-compiled, or only CSS forms used for above-the-fold content
- [ ] No `sdp()` / `dimen()` numbers in server-rendered markup (or rendered after mount)
- [ ] `install()` called in a browser-only place (`useWebDimens()`, a `.client` plugin, `onMount`, `provideWebDimens()`)
- [ ] Strategies used only in CSS listed in `install({ strategies: [...] })`

Next: [Runtime](./runtime.md) · [Back to the index](./README.md)
