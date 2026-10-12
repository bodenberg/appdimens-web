# webdimens documentation

webdimens is the web port of [AppDimens Dynamic](https://github.com/bodenberg/appdimens-dynamic) 3.2.0 for Android: responsive
`dp` / `sp` with the same math and the same names (`sdp`, `hdp`, `wdp`, `ssp`, `sem`, `16sdp` in classes and CSS…). These pages cover
every feature with runnable examples.

> **Languages:** English · [Português (BR)](./pt-BR/README.md) · Package: [npmjs.com/package/webdimens](https://www.npmjs.com/package/webdimens)

## Start here

| If you want to… | Read |
|---|---|
| Install and get a first responsive page in 5 minutes | [Getting started](./getting-started.md) |
| Understand dp / sp / px on the web, axes, flags and the token grammar | [Concepts](./concepts.md) |
| Port an Android (Compose / Views) layout | [Migrating from Android](./migration-android.md) |

## Using the library

| Topic | Page |
|---|---|
| Classes `p:16sdp`, `data-dimen`, conditions `@landscape` `@sw600` `@tv`, modifiers `ad-a` `ad-i` `ad-power` | [Declarative units](./declarative.md) |
| CSS variables, pure-CSS fallback, Sass, PostCSS (`padding: 16sdp`, `@dimen`) | [CSS, Sass and PostCSS](./css.md) |
| `sdp()`, `dimen('16sdp')`, `dimens({…})`, facilitators, builders | [JavaScript API](./javascript.md) |
| The 12 scaling strategies, formulas and a comparison table | [Strategies](./strategies.md) |
| React, Next.js, Vue, Nuxt, Svelte, SvelteKit, Angular, CDN | [Frameworks](./frameworks.md) |
| Server rendering and first paint | [SSR](./ssr.md) |
| `install()` options, events, snapshots, UI mode, element scopes | [Runtime](./runtime.md) |
| Auto-fit text and boxes | [Resize](./resize.md) |
| mm / cm / inch and literal `space*` percentages | [Units and space](./units.md) |

## Reference and help

| | |
|---|---|
| Every export of every entry point | [API reference](./api-reference.md) |
| Ready-made solutions (cards, typography, TV, foldables, canvas, dashboards…) | [Recipes](./recipes.md) |
| How fast it is and how to keep it fast | [Performance](./performance.md) |
| Something does not work | [Troubleshooting](./troubleshooting.md) |
| Develop, test and release the library | [Contributing](./contributing.md) |
| Runnable demo pages | [examples/](../examples/README.md) |
| Agent skills (AI assistants) | [skills/SKILL.md](../skills/SKILL.md) |

## The library in one screen

```html
<script src="https://cdn.jsdelivr.net/npm/webdimens@3/dist/webdimens.global.js"></script>

<!-- 16 dp of padding that scales with the viewport, like 16.sdp on Android -->
<section class="p:16sdp r:12sdp ad-a">
  <h1 class="fs:20ssp fs@landscape:24ssp fs@sw600:28ssp fs@tv:40ssp">Hello</h1>
  <p data-dimen="font-size: 14ssp; margin-top: 8sdp">Units instead of px.</p>
</section>

<style>
  .card { padding: calc(16 * var(--sdp)); }   /* or `padding: 16sdp` with the PostCSS plugin */
</style>

<script>
  WebDimens.dimen('16sdp');   // → number of CSS px for the current window
</script>
```

Formulas, names and priorities follow the Android library. Where the web differs (viewport vs display, `Px` naming order, `@mw`),
the pages say so explicitly.
