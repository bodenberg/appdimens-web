# Examples

Open the HTML files directly in a browser after `npm run build` (they load `../dist/webdimens.global.js`). Every page is
loaded in Chromium by `scripts/examples-check.mjs` in CI.

| File | Shows |
|---|---|
| [vanilla.html](./vanilla.html) | CDN global, CSS variables, JS values, builder, auto-resize, declarative classes |
| [declarative.html](./declarative.html) | classes `p:16sdp`, conditions `@landscape` `@sw600` `@tv` `@tv@sw600`, `data-dimen`, `<style data-webdimens>`, modifiers `ad-a` / `ad-power` / `ad-fluid`, forcing UI mode and multi-window |
| [strategies.html](./strategies.html) | the 12 strategies side by side, live |
| [canvas.html](./canvas.html) | a canvas chart drawn with `Px` (device pixel) variants |
| [scope.html](./scope.html) | `createDimenScope`: tokens that follow a resizable panel instead of the window |
| [resize.html](./resize.html) | `autoResizeText` with single-line, `maxLines: 2` and editable text |
| [css-only.html](./css-only.html) | pure-CSS fallback tokens, no JavaScript |
| [custom.html](./custom.html) | custom strategies (`defineScalingStrategy`, presets, `--cdp-<id>` CSS variables, `explain()`) |
| [postcss/](./postcss/) | `padding: 16sdp` and `@dimen` blocks compiled at build time |
| [react-example.tsx](./react-example.tsx) · [vue-example.vue](./vue-example.vue) · [svelte-example.svelte](./svelte-example.svelte) · [angular-example.ts](./angular-example.ts) | framework snippets |

Full documentation: [docs/](../docs/README.md).
