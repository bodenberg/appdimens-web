# Getting started

This page installs webdimens, builds one responsive card three ways (classes, CSS custom properties and JavaScript), lists the options of `install()`, and points you to the next page for your stack. It is for web developers who have not used dp and sp before, and for Android developers who want the web form of `16.sdp` in a first working page. The reasoning behind the numbers is in [concepts.md](./concepts.md); this page only uses them.

## Requirements

- A current browser. The runtime needs CSS custom properties, which every modern browser supports.
- Node 18 or later for server rendering, tests and build tools (the package declares `"engines": { "node": ">=18" }`).

## Install

With a package manager:

```bash
npm install webdimens
# or
yarn add webdimens
# or
pnpm add webdimens
```

From a CDN, with no build step:

```html
<script src="https://cdn.jsdelivr.net/npm/webdimens@3/dist/webdimens.global.js"></script>
```

Two CDN bundles are published:

| File | Contents | Use it when |
|---|---|---|
| `dist/webdimens.global.js` | every strategy, `resize`, `units` and the runtime | you want the whole API from a script tag |
| `dist/webdimens.lite.global.js` | the runtime and the scaled strategy (`sdp`, `hdp`, `wdp`, `ssp`, `sem`, `dimen`, `install`, …) | you only need the default strategy and want less to download |

Both expose everything on `window.WebDimens` and call `install()` when the script loads. The lite bundle has no `autoResizeText`, `mm` or `pwsdp`. To start the runtime yourself, add `data-no-install` to the script tag and call `WebDimens.install()` later:

```html
<script src="https://cdn.jsdelivr.net/npm/webdimens@3/dist/webdimens.global.js" data-no-install></script>
<script>
  window.WebDimens.install({ fontScale: 1.2 });
</script>
```

The npm package has one entry per strategy, resize and units module, and one per framework (`webdimens/power`, `webdimens/resize`, `webdimens/react`, …). Each strategy module is imported on its own; see [strategies.md](./strategies.md) and [frameworks.md](./frameworks.md).

## Call install() once

In the application entry point, before the first render:

```js
import { install } from 'webdimens';

install();
```

`install()` does three things:

1. It starts tracking the viewport: window resize, orientation change, page show, device posture and pixel-ratio changes.
2. It writes the CSS custom properties (`--sdp`, `--ssp`, `--hdp`, …) on `:root`.
3. It compiles the class names, `data-dimen` attributes and `<style data-webdimens>` blocks in the document, and keeps the `data-ad-mode`, `data-ad-orientation` and `data-ad-multi-window` attributes on `<html>` up to date.

The call is idempotent. A second call updates the options it is given. The CDN bundles call it for you.

The JavaScript functions such as `sdp(16)` work without `install()`, because they start tracking the viewport on first use. The CSS variables, the classes and the `<html>` attributes exist only after `install()` runs.

## One card, three styles

The card has 16 dp of padding and a 12 dp radius. Its title is 20 sp, which becomes 24 sp in landscape and 40 sp on a TV. The numbers below are for a 600 × 900 CSS px window, device pixel ratio 1, and the browser's default font size (font scale 1).

### 1. Classes

```html
<article class="p:16sdp r:12sdp">
  <h1 class="fs:20ssp fs@landscape:24ssp fs@tv:40ssp">Classes</h1>
</article>
```

The runtime compiles each class name once. `p:16sdp` becomes `.p\:16sdp{padding:calc(16 * var(--sdp))}`. The conditions after `@` are Android qualifiers: `@landscape` becomes `(orientation: landscape)` and `@tv` becomes `:root[data-ad-mode="tv"]`. The full syntax is in [declarative.md](./declarative.md).

Result at 600 × 900: padding 32 px, radius 24 px, title 40 px. On a TV window the title is 80 px.

### 2. CSS custom properties

```css
.card-css {
  padding: calc(16 * var(--sdp));
  border-radius: calc(12 * var(--sdp));
}
.card-css h2 {
  font-size: calc(20 * var(--ssp));
}
@media (orientation: landscape) {
  .card-css h2 { font-size: calc(24 * var(--ssp)); }
}
:root[data-ad-mode="tv"] .card-css h2 {
  font-size: calc(40 * var(--ssp));
}
```

`--sdp` holds the size of one dp in CSS px. At 600 × 900 it is `2px`, so `calc(16 * var(--sdp))` is 32 px. `--ssp` is the same value multiplied by the font scale. Without JavaScript you can load the pure-CSS fallback first, so the page is already scaled while the script loads:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/webdimens@3/css/webdimens.css">
```

The fallback defines `--sdp` as `calc(min(100vw, 100vh) / 300)`. It does not apply the font scale or the aspect-ratio correction, and the runtime's `:root:root` declarations replace it as soon as `install()` runs. More on this in [css.md](./css.md).

### 3. JavaScript

```js
import { dimen, dimens } from 'webdimens';

const card = document.querySelector('#js-card');
Object.assign(card.style, dimens({ padding: '16sdp', borderRadius: '12sdp' }));

const padPx = dimen('16sdp'); // 32, a number for canvas or measurement
```

`dimens()` returns `calc()` strings, so the style follows the viewport without a re-render. `dimen()` returns a number in CSS px and is the right choice for canvas, measurement or layout code. In the CDN bundle the same functions are on `WebDimens`, for example `WebDimens.dimens(...)`.

### The complete page from a CDN

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>webdimens first page</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/webdimens@3/css/webdimens.css">
  <style>
    .card-css { padding: calc(16 * var(--sdp)); border-radius: calc(12 * var(--sdp)); }
    .card-css h2 { font-size: calc(20 * var(--ssp)); }
    @media (orientation: landscape) { .card-css h2 { font-size: calc(24 * var(--ssp)); } }
    :root[data-ad-mode="tv"] .card-css h2 { font-size: calc(40 * var(--ssp)); }
  </style>
  <script src="https://cdn.jsdelivr.net/npm/webdimens@3/dist/webdimens.global.js"></script>
</head>
<body>
  <article class="p:16sdp r:12sdp">
    <h1 class="fs:20ssp fs@landscape:24ssp fs@tv:40ssp">Classes</h1>
  </article>

  <article class="card-css">
    <h2>CSS custom properties</h2>
  </article>

  <article id="js-card">
    <h2>JavaScript</h2>
  </article>

  <script>
    const { dimens } = window.WebDimens;
    Object.assign(document.getElementById('js-card').style, dimens({ padding: '16sdp', borderRadius: '12sdp' }));
  </script>
</body>
</html>
```

### What the same card does on a phone

At 412 × 915 CSS px with device pixel ratio 2.625, the same markup gives padding 21.97 px, radius 16.48 px and a title of 27.47 px. Nothing in the markup changes. Only the window does.

## Options of install()

`install()` accepts the options of `configure()` plus one of its own, `declarative`:

| Option | Type | Default | Purpose |
|---|---|---|---|
| `cssVariables` | `boolean` | `true` on the first `install()` | publish `--sdp`, `--ssp`, … on `:root` |
| `declarative` | `boolean` | `true` | compile classes, `data-dimen`, `<style data-webdimens>` and the `ad-*` modifier classes |
| `cssNonce` | `string` | none | CSP nonce for the fallback `<style>` element (not needed when constructable stylesheets are used) |
| `uiModeType` | `UiModeType` or `(size) => UiModeType` | detected | force the UI mode, for kiosks or TV apps |
| `fontScale` | `number` | browser default font size ÷ 16 | override the text scale |
| `multiWindow` | `boolean` or `(size) => boolean` | detected | force the split-window state (drives the `i` variants and `@mw`) |
| `measure` | `() => { width, height }` | `innerWidth` × layout-viewport height | measure a different viewport, for example in an embedded view |
| `strategies` | `string[]` or `'all'` | `[]` | register strategies whose tokens only appear in hand-written CSS or PostCSS output |

```ts
import { install, UiModeType } from 'webdimens';

install({
  cssVariables: true,
  declarative: true,
  uiModeType: UiModeType.TELEVISION,
  fontScale: 1.2,
  multiWindow: false,
  measure: () => ({ width: innerWidth, height: innerHeight }),
  cssNonce: 'abc123',
});
```

Other functions that belong with `install()`:

| Function | Purpose |
|---|---|
| `uninstall()` | stop tracking and remove the generated CSS and `<html>` attributes |
| `configure(options)` | change the options after install; unspecified keys keep their value |
| `refresh()` | measure the font scale again, for example after the user changed the default font size |
| `setMetrics(snapshot \| null)` | pin a snapshot (server rendering, tests, previews); `null` returns to the live viewport |

These options take effect in a browser. On the server, pin the snapshot with `setMetrics()`; see [ssr.md](./ssr.md).

## Check what the runtime sees

```js
import { getMetrics } from 'webdimens';

const m = getMetrics();
console.log(m.screenWidthDp, m.screenHeightDp, m.orientation, m.fontScale);
```

At 600 × 900 this prints `600 900 PORTRAIT 1`. `getMetrics()` returns the immutable snapshot that every value is computed from. [concepts.md](./concepts.md#the-viewport-snapshot) lists every field.

## Three things that catch people out

1. **Classes need the runtime.** `p:16sdp` does nothing until `install()` runs or the CDN script loads. A class is only compiled when the runtime sees it in the document.
2. **Hand-written CSS for other strategies needs one line.** Tokens seen by the runtime (`dimen('10pwsdp')`, `p:10pwsdp`, `data-dimen`, `ad-power`) register their strategy automatically. A stylesheet that writes `calc(16 * var(--pwsdp))` itself, or PostCSS output, is never parsed at run time: add `install({ strategies: ['power'] })`.
3. **`Px` tokens are for JavaScript.** `dimen('16sdpPx')` returns device pixels and works in `dimen()` and `dimensPx()`. In a class the rule is ignored with a console warning. In `dimens()` it throws. The PostCSS plugin fails the build. See [troubleshooting.md](./troubleshooting.md).

## Next steps by stack

| Your stack | Read next | Then |
|---|---|---|
| Plain HTML, CDN script | [declarative.md](./declarative.md) for classes and `data-dimen` | [css.md](./css.md) |
| HTML or CSS with a build tool (Vite, webpack, Next) | [css.md](./css.md) for the PostCSS plugin | [declarative.md](./declarative.md) |
| Plain JavaScript or TypeScript | [javascript.md](./javascript.md) | [api-reference.md](./api-reference.md) |
| React, Vue, Svelte or Angular | [frameworks.md](./frameworks.md) | [javascript.md](./javascript.md) |
| Server rendering (Next, Nuxt, SvelteKit, Angular SSR) | [ssr.md](./ssr.md) | [declarative.md](./declarative.md) |
| Porting an Android layout | [migration-android.md](./migration-android.md) | [concepts.md](./concepts.md) |

Before you write many units, read [concepts.md](./concepts.md). It explains what `sdpa`, `hdpLw` and `sdpPh` select, and why the same number gives different pixels on different windows.

Next: [Concepts](./concepts.md) · [Back to the index](./README.md)
