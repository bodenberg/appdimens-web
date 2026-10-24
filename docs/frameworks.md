# Frameworks

webdimens works with any framework because its main output is CSS: dimension classes, `data-dimen` and CSS variables need no
framework integration at all. The bindings below are for **JavaScript values** (`sdp(16)`, `dimen('16sdp')`) that must update
when the window changes, and for installing the runtime in the framework's lifecycle.

| Use | Re-render on resize? |
|---|---|
| `className="p:16sdp"`, `data-dimen`, `calc(16 * var(--sdp))`, `style={dimens({…})}` | no — pure CSS |
| `sdp(16)`, `dimen('16sdp')`, `dimensPx({…})`, builder `.sdp` | yes — use the bindings |

## React

```tsx
// main.tsx — once
import { install } from 'webdimens';
install();
```

```tsx
import { dimen, dimens, sdp, ssp } from 'webdimens';
import { useDimens, useDimen, useDimensVersion, useDimenScope } from 'webdimens/react';

export function Card({ size }: { size: number }) {
  return (
    <article className="p:16sdp r:12sdp p@sw600:24sdp">                {/* CSS: no re-render needed */}
      <h2 style={dimens({ fontSize: '20ssp', marginBottom: '8sdp' })}>Title</h2>
      <Avatar size={size} />
    </article>
  );
}

function Avatar({ size }: { size: number }) {
  const px = useDimen(() => dimen(`${size}sdp`), [size]);   // memoized per snapshot and per `size`
  return <img width={px} height={px} alt="" src="/avatar.png" />;
}

function Debug() {
  const m = useDimens();             // re-renders (at most once per frame) when the window changes
  return <pre>{m.screenWidthDp}×{m.screenHeightDp} · sdp(16) = {sdp(16)}</pre>;
}
```

| Hook | Returns |
|---|---|
| `useDimens()` | the current `DimenMetrics`; subscribes the component (`useSyncExternalStore`) |
| `useDimensVersion()` | a number that changes with the snapshot (for your own `useMemo` / `useEffect` deps) |
| `useDimen(compute, deps?)` | `compute()` memoized per snapshot; pass `deps` when it reads props or state |
| `useWebDimens(options?)` | calls `install(options)` once from a component and returns the metrics |
| `useDimenScope(ref, options?)` | an element scope ([Runtime](./runtime.md#element-scopes)); follows `ref.current` across renders, disconnects on unmount |

```tsx
function Panel() {
  const ref = useRef<HTMLDivElement>(null);
  const scope = useDimenScope(ref);             // var(--sdp) inside follows the panel size
  return <div ref={ref} className="p:16sdp">{scope ? scope.dp(16).toFixed(1) : '…'}</div>;
}
```

### Next.js (App Router)

```tsx
// app/webdimens.tsx
'use client';
import { useWebDimens } from 'webdimens/react';

export function WebDimensRuntime() {
  useWebDimens();          // installs in the browser only; no-op on the server
  return null;
}
```

```tsx
// app/layout.tsx
import 'webdimens/css';    // pure-CSS fallback: first paint already scaled
import { WebDimensRuntime } from './webdimens';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <WebDimensRuntime />
        {children}
      </body>
    </html>
  );
}
```

Server components can use classes, `dimens()` and CSS variables freely. Read [SSR](./ssr.md) before rendering JS numbers on the
server. For `padding: 16sdp` in CSS files add the PostCSS plugin (`postcss.config.mjs` with
`plugins: { 'webdimens/postcss': {} }`, see [CSS](./css.md#postcss-plugin)).

## Vue 3

```ts
// main.ts
import { createApp } from 'vue';
import { WebDimens } from 'webdimens/vue';
import App from './App.vue';

createApp(App).use(WebDimens /*, { fontScale: 1.1 } */).mount('#app');   // install() in the browser
```

```vue
<script setup lang="ts">
import { sdp, ssp } from 'webdimens';
import { useDimens, useDimen } from 'webdimens/vue';

const metrics = useDimens();                 // Readonly<Ref<DimenMetrics>>
const avatar = useDimen(() => sdp(48));      // ComputedRef<number>, recomputed on every snapshot change
const title = useDimen(() => ssp(20));       // create composables here, never inside the template
</script>

<template>
  <section class="p:16sdp p@landscape:12sdp_24sdp">
    <h2 :style="{ fontSize: `${title}px` }">Title</h2>
    <img :width="avatar" :height="avatar" src="/a.png" alt="" />
    <small>{{ metrics.screenWidthDp }} dp wide</small>
  </section>
</template>

<style scoped>
/* with the PostCSS plugin */
.title { font-size: 20ssp; }
</style>
```

`useDimens()` releases its subscription with the component (or `effectScope`); called outside a scope it lives for the page.

### Nuxt

Register the plugin client-side: `plugins/webdimens.client.ts` → `export default defineNuxtPlugin((nuxt) => nuxt.vueApp.use(WebDimens))`,
add `'webdimens/css'` to `css` in `nuxt.config`, and `webdimens/postcss` under `postcss.plugins`.

## Svelte and SvelteKit

The adapter implements the store contract, so it works with `$store` in Svelte 3, 4 and 5 without importing Svelte.

```svelte
<script>
  import { onMount } from 'svelte';
  import { install, sdp, ssp } from 'webdimens';
  import { metrics, dimen } from 'webdimens/svelte';

  onMount(() => install());               // or once in your root layout
  const pad = dimen(() => sdp(16));       // store, recomputed on every snapshot change
  const title = dimen(() => ssp(20));
</script>

<section class="r:12sdp" style="padding: {$pad}px">
  <h2 style="font-size: {$title}px">Hello</h2>
  <small>{$metrics.screenWidthDp} dp</small>
</section>
```

SvelteKit: call `install()` in `onMount` of `+layout.svelte` (it is browser-only), import `webdimens/css` in the layout for
the first paint, and add `webdimens/postcss` to `postcss.config.js` for `<style>` blocks.

## Angular (16+)

```ts
// main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { provideWebDimens } from 'webdimens/angular';
import { AppComponent } from './app/app.component';

bootstrapApplication(AppComponent, { providers: [provideWebDimens(/* { fontScale: 1.1 } */)] });
```

```ts
import { Component } from '@angular/core';
import { sdp, ssp } from 'webdimens';
import { injectDimens, injectDimen } from 'webdimens/angular';

@Component({
  selector: 'app-card',
  standalone: true,
  template: `
    <section class="p:16sdp p@tv:40sdp" [style.gap.px]="gap()">
      <h2 [style.font-size.px]="title()">Hello</h2>
      <small>{{ metrics().screenWidthDp }} dp</small>
    </section>
  `,
  styles: [`h2 { letter-spacing: calc(0.5 * var(--sdp)); }`],
})
export class CardComponent {
  metrics = injectDimens();                 // Signal<DimenMetrics>
  gap = injectDimen(() => sdp(8));          // Signal<number>
  title = injectDimen(() => ssp(20));
}
```

`injectDimens()` / `injectDimen()` must run in an injection context (field initializers, constructors); they unsubscribe through
`DestroyRef`. `provideWebDimens()` installs the runtime when the environment injector starts (browser only, so it is safe
with Angular SSR).

## Custom strategies in every framework

| Framework | Scope | Use |
|---|---|---|
| React | `<ScalingStrategyProvider strategy={brand}>` | `const s = useScalingStrategy(); s.dp(16)` |
| Vue | `provideScalingStrategy(brand)` | `const s = useScalingStrategy(); s.dp(16)` · `useCdp(16)` |
| Svelte | — | `const brand = scalingStrategy('brand')` → `{$brand.dp(16)}` |
| Angular | `provideScalingStrategy(brand)` | `s = injectScalingStrategy()` → `s().dp(16)` |

All of them re-render on snapshot changes. For SSR-safe styles prefer `brand.css(16)` (CSS variables). See [Custom strategies](./custom.md).

## Plain HTML and the CDN bundle

```html
<script src="https://cdn.jsdelivr.net/npm/webdimens@3/dist/webdimens.global.js"></script>
<div class="p:16sdp fs:14ssp">…</div>
<script>
  const { sdp, dimen, subscribe } = window.WebDimens;
  subscribe((m) => console.log('window changed', m.screenWidthDp));
</script>
```

The bundle installs itself on load; add `data-no-install` to the script tag to call `WebDimens.install({...})` yourself.
`webdimens.lite.global.js` has the runtime and the scaled strategy only (no resize, units or other strategies' functions).

## Web Components and Shadow DOM

CSS custom properties inherit into shadow roots, so `calc(16 * var(--sdp))` works inside components. The class compiler scans the
main document only, so inside a shadow root write `var()` expressions, use the PostCSS output, or adopt a sheet built with
`dimenClassesToCss([...])`:

```js
const sheet = new CSSStyleSheet();
sheet.replaceSync(dimenClassesToCss(['p:16sdp', 'fs:14ssp']));
this.shadowRoot.adoptedStyleSheets = [sheet];
```

Next: [SSR](./ssr.md) · [Back to the index](./README.md)
