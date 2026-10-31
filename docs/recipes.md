# Recipes

Complete, copy-pasteable solutions for common layouts. Each assumes the runtime is installed (`install()` or the CDN script).

## Responsive card

```html
<article class="card p:16sdp p@sw600:24sdp r:12sdp gap:8sdp">
  <img class="size:48sdp r:24sdp" src="/avatar.png" alt="">
  <h2 class="fs:18ssp fs@sw600:22ssp">Ada Lovelace</h2>
  <p class="fs:14ssp lh:20ssp">First programmer.</p>
  <button class="h:48sdp px:16sdp r:8sdp fs:14ssp">Follow</button>
</article>
<style>
  .card { display: grid; justify-items: start; border: 1px solid #ddd; }   /* 1px: hairlines stay fixed */
</style>
```

On a 360 dp phone the padding is 19.2 px and the avatar 57.6 px; on a 600 dp tablet the `@sw600` padding gives 48 px.

## Typography scale

```css
/* tokens.css — with the PostCSS plugin */
:root {
  --text-xs: 12ssp;
  --text-sm: 14ssp;
  --text-md: 16ssp;
  --text-lg: 20ssp;
  --text-xl: 28ssp;
}
h1 { font-size: var(--text-xl); line-height: 1.2; }
body { font-size: var(--text-md); }
```

Without PostCSS write `--text-md: calc(16 * var(--ssp));`. `ssp` follows the user's font-size preference; switch a block to
bounded growth with `class="ad-fluid"` (0.8× to 1.2× of the design size).

## Design tokens from webdimens

```css
:root {
  --space-1: calc(4 * var(--sdp));
  --space-2: calc(8 * var(--sdp));
  --space-3: calc(12 * var(--sdp));
  --space-4: calc(16 * var(--sdp));
  --radius-sm: calc(6 * var(--sdp));
  --radius-lg: calc(16 * var(--sdp));
  --touch-min: max(calc(48 * var(--sdp)), 9mm);   /* never below 9 mm physically */
}
.button { min-height: var(--touch-min); padding: var(--space-2) var(--space-4); border-radius: var(--radius-sm); }
```

Every component built on these tokens scales with the window, and a design-system change is one edit.

## Spec handoff (Figma / Android → web)

A spec in dp at a 360-dp-wide phone frame ports 1:1:

| Spec | Web |
|---|---|
| padding 16 dp, radius 12 dp | `class="p:16sdp r:12sdp"` |
| body 14 sp | `fs:14ssp` |
| row height 56 dp | `h:56sdp` |
| hairline 1 px | `border: 1px solid` (not scaled) |

AppDimens' reference is 300 dp, so on the 360-dp frame itself the web values are 1.2× the spec (16sdp = 19.2 px). That is the
same result the Android app shows on that phone.

## TV / 10-foot UI

```html
<nav class="gap:8sdp gap@tv:24sdp">
  <a class="p:8sdp_12sdp p@tv:16sdp_32sdp fs:14ssp fs@tv:28ssp r:8sdp" href="/">Home</a>
  <a class="p:8sdp_12sdp p@tv:16sdp_32sdp fs:14ssp fs@tv:28ssp r:8sdp" href="/movies">Movies</a>
</nav>
<style>
  :root[data-ad-mode="tv"] a:focus { outline: calc(3 * var(--sdp)) solid #fff; }   /* visible remote-control focus */
</style>
<script type="module">
  import { install, UiModeType } from 'webdimens';
  // TV builds of the app know they run on a TV: do not rely on user-agent detection.
  install({ uiModeType: UiModeType.TELEVISION });
</script>
```

## Foldables

```html
<main class="p:16sdp p@fold-open:32sdp" data-dimen="gap: 12sdp; gap@fold-half: 0">
  <section class="pane">List</section>
  <section class="pane">Details</section>
</main>
<style>
  main { display: grid; }
  :root[data-ad-mode="fold-half"] main { grid-template-columns: 1fr 1fr; }   /* hinge between the panes */
</style>
```

Foldable postures come from the Viewport Segments / Device Posture APIs where the browser supports them.

## Landscape-specific spacing and tablet breakpoints

```html
<section class="grid p:12sdp p@landscape:12sdp_24sdp p@sw600:24sdp p@sw840:32sdp gap:8sdp gap@sw600:16sdp">…</section>
<style>
  .grid { display: grid; grid-template-columns: 1fr; }
  @media (min-width: 600px) and (min-height: 600px) { .grid { grid-template-columns: 1fr 1fr; } }  /* = @sw600 */
  @media (min-width: 840px) and (min-height: 840px) { .grid { grid-template-columns: repeat(3, 1fr); } }
</style>
```

`@sw600` / `@sw840` are Android's smallest-width buckets; larger thresholds win automatically.

## Canvas chart

```js
import { hdp, sdpPx, sspPx, subscribe } from 'webdimens';

const canvas = document.querySelector('canvas');
function draw() {
  const h = hdp(220);
  canvas.style.height = `${h}px`;
  canvas.width = canvas.clientWidth * devicePixelRatio;
  canvas.height = h * devicePixelRatio;
  const ctx = canvas.getContext('2d');
  ctx.lineWidth = sdpPx(2);
  ctx.font = `${sspPx(12)}px system-ui`;
  // … draw with device-pixel sizes
}
draw();
subscribe(draw);    // redraw once per frame when the window changes
```

Full example: [examples/canvas.html](../examples/canvas.html).

## Resizable dashboard panel

```html
<div id="widget" style="resize: both; overflow: auto; width: 320px; height: 240px">
  <div class="kpi" style="padding: calc(12 * var(--sdp)); font-size: calc(24 * var(--ssp))">42</div>
</div>
<script type="module">
  import { createDimenScope } from 'webdimens';
  createDimenScope(document.getElementById('widget'));   // inside the widget, --sdp follows the widget size
</script>
```

## Auto-fitting headline

```html
<header style="display: grid; grid-template-columns: minmax(0, 1fr)">
  <h1 id="hero" style="height: 20vh; overflow: hidden; line-height: 1.1">A headline of any length</h1>
</header>
<script type="module">
  import { autoResizeText } from 'webdimens/resize';
  autoResizeText(document.getElementById('hero'), { min: 20, max: 96, maxLines: 2 });
</script>
```

## Mixing strategies per section

```html
<body class="p:16sdp">                         <!-- scaled -->
  <aside class="ad-power p:16sdp">…</aside>    <!-- power: grows less on large screens -->
  <article class="ad-fluid fs:16ssp">…</article> <!-- fluid text: 0.8×–1.2× -->
  <footer class="ad-a p:16sdp">…</footer>      <!-- aspect-ratio corrected -->
</body>
```

The tokens stay the same (`p:16sdp`); the class on the container changes their meaning. Strategy classes register their
strategy automatically.

## Minimum physical sizes

```css
.icon-button {
  width: max(calc(40 * var(--sdp)), 9mm);    /* scales, but never below 9 mm */
  height: max(calc(40 * var(--sdp)), 9mm);
}
```

Next: [Troubleshooting](./troubleshooting.md) · [Back to the index](./README.md)

## One scaling law for a whole design system

Ship one `appdimens-strategies.json` with your design tokens and load it on every platform (web, Android, iOS, Flutter…):

```ts
import { loadScalingStrategies, cdp } from 'webdimens/custom';
loadScalingStrategies(await (await fetch('/appdimens-strategies.json')).text());   // sets "default"
const pad = cdp(16);              // default strategy from the file
```

```css
.card { padding: 16cdp; font-size: 14csp-brandText; }   /* PostCSS */
```

TV, watch or car tweaks live as rules in the same file (`{ "when": { "device": "tv" }, "set": { … } }`), so no call site changes. See [Custom strategies](./custom.md).
