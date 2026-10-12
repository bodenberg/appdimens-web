# Frameworks

O webdimens funciona com qualquer framework porque sua saída principal é CSS: classes de dimensão, `data-dimen` e variáveis CSS
não precisam de nenhuma integração com framework. Os bindings abaixo são para **valores JavaScript** (`sdp(16)`, `dimen('16sdp')`)
que precisam ser atualizados quando a janela muda, e para instalar o runtime no ciclo de vida do framework.

| Uso | Re-renderiza ao redimensionar? |
|---|---|
| `className="p:16sdp"`, `data-dimen`, `calc(16 * var(--sdp))`, `style={dimens({…})}` | não — CSS puro |
| `sdp(16)`, `dimen('16sdp')`, `dimensPx({…})`, builder `.sdp` | sim — use os bindings |

## React

```tsx
// main.tsx — uma vez
import { install } from 'webdimens';
install();
```

```tsx
import { dimen, dimens, sdp, ssp } from 'webdimens';
import { useDimens, useDimen, useDimensVersion, useDimenScope } from 'webdimens/react';

export function Card({ size }: { size: number }) {
  return (
    <article className="p:16sdp r:12sdp p@sw600:24sdp">                {/* CSS: não precisa re-renderizar */}
      <h2 style={dimens({ fontSize: '20ssp', marginBottom: '8sdp' })}>Title</h2>
      <Avatar size={size} />
    </article>
  );
}

function Avatar({ size }: { size: number }) {
  const px = useDimen(() => dimen(`${size}sdp`), [size]);   // memoizado por snapshot e por `size`
  return <img width={px} height={px} alt="" src="/avatar.png" />;
}

function Debug() {
  const m = useDimens();             // re-renderiza (no máximo uma vez por frame) quando a janela muda
  return <pre>{m.screenWidthDp}×{m.screenHeightDp} · sdp(16) = {sdp(16)}</pre>;
}
```

| Hook | Retorna |
|---|---|
| `useDimens()` | o `DimenMetrics` atual; inscreve o componente (`useSyncExternalStore`) |
| `useDimensVersion()` | um número que muda com o snapshot (para suas próprias dependências de `useMemo` / `useEffect`) |
| `useDimen(compute, deps?)` | `compute()` memoizado por snapshot; passe `deps` quando ele lê props ou state |
| `useWebDimens(options?)` | chama `install(options)` uma vez a partir de um componente e retorna as métricas |
| `useDimenScope(ref, options?)` | um escopo de elemento ([Runtime](./runtime.md#escopos-por-elemento)); acompanha `ref.current` entre renders e desconecta ao desmontar |

```tsx
function Panel() {
  const ref = useRef<HTMLDivElement>(null);
  const scope = useDimenScope(ref);             // var(--sdp) dentro segue o tamanho do painel
  return <div ref={ref} className="p:16sdp">{scope ? scope.dp(16).toFixed(1) : '…'}</div>;
}
```

### Next.js (App Router)

```tsx
// app/webdimens.tsx
'use client';
import { useWebDimens } from 'webdimens/react';

export function WebDimensRuntime() {
  useWebDimens();          // instala só no navegador; não faz nada no servidor
  return null;
}
```

```tsx
// app/layout.tsx
import 'webdimens/css';    // fallback só em CSS: o primeiro paint já vem escalado
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

Componentes de servidor podem usar classes, `dimens()` e variáveis CSS livremente. Leia [SSR](./ssr.md) antes de renderizar
números JS no servidor. Para `padding: 16sdp` em arquivos CSS, adicione o plugin PostCSS (`postcss.config.mjs` com
`plugins: { 'webdimens/postcss': {} }`, veja [CSS](./css.md#plugin-postcss)).

## Vue 3

```ts
// main.ts
import { createApp } from 'vue';
import { WebDimens } from 'webdimens/vue';
import App from './App.vue';

createApp(App).use(WebDimens /*, { fontScale: 1.1 } */).mount('#app');   // install() no navegador
```

```vue
<script setup lang="ts">
import { sdp, ssp } from 'webdimens';
import { useDimens, useDimen } from 'webdimens/vue';

const metrics = useDimens();                 // Readonly<Ref<DimenMetrics>>
const avatar = useDimen(() => sdp(48));      // ComputedRef<number>, recalculado a cada mudança de snapshot
const title = useDimen(() => ssp(20));       // crie os composables aqui, nunca dentro do template
</script>

<template>
  <section class="p:16sdp p@landscape:12sdp_24sdp">
    <h2 :style="{ fontSize: `${title}px` }">Title</h2>
    <img :width="avatar" :height="avatar" src="/a.png" alt="" />
    <small>{{ metrics.screenWidthDp }} dp wide</small>
  </section>
</template>

<style scoped>
/* com o plugin PostCSS */
.title { font-size: 20ssp; }
</style>
```

`useDimens()` libera sua inscrição junto com o componente (ou com o `effectScope`); chamado fora de um escopo, ele vive enquanto
a página existir.

### Nuxt

Registre o plugin apenas no cliente: `plugins/webdimens.client.ts` → `export default defineNuxtPlugin((nuxt) => nuxt.vueApp.use(WebDimens))`,
adicione `'webdimens/css'` em `css` no `nuxt.config` e `webdimens/postcss` em `postcss.plugins`.

## Svelte e SvelteKit

O adaptador implementa o contrato de store, então funciona com `$store` no Svelte 3, 4 e 5 sem importar o Svelte.

```svelte
<script>
  import { onMount } from 'svelte';
  import { install, sdp, ssp } from 'webdimens';
  import { metrics, dimen } from 'webdimens/svelte';

  onMount(() => install());               // ou uma vez no layout raiz
  const pad = dimen(() => sdp(16));       // store, recalculado a cada mudança de snapshot
  const title = dimen(() => ssp(20));
</script>

<section class="r:12sdp" style="padding: {$pad}px">
  <h2 style="font-size: {$title}px">Hello</h2>
  <small>{$metrics.screenWidthDp} dp</small>
</section>
```

SvelteKit: chame `install()` no `onMount` do `+layout.svelte` (é exclusivo do navegador), importe `webdimens/css` no layout para
o primeiro paint e adicione `webdimens/postcss` ao `postcss.config.js` para os blocos `<style>`.

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

`injectDimens()` / `injectDimen()` precisam rodar em um contexto de injeção (inicializadores de campos, construtores); eles se
desinscrevem pelo `DestroyRef`. `provideWebDimens()` instala o runtime quando o injector do ambiente inicia (somente no navegador,
então é seguro com Angular SSR).

## HTML puro e o bundle de CDN

```html
<script src="https://cdn.jsdelivr.net/npm/webdimens@3/dist/webdimens.global.js"></script>
<div class="p:16sdp fs:14ssp">…</div>
<script>
  const { sdp, dimen, subscribe } = window.WebDimens;
  subscribe((m) => console.log('window changed', m.screenWidthDp));
</script>
```

O bundle se instala sozinho ao carregar; adicione `data-no-install` à tag do script para chamar `WebDimens.install({...})`
por conta própria. `webdimens.lite.global.js` tem apenas o runtime e a estratégia escalada (sem resize, unidades nem as funções
das outras estratégias).

## Web Components e Shadow DOM

Propriedades customizadas CSS herdam para dentro de shadow roots, então `calc(16 * var(--sdp))` funciona dentro de componentes.
O compilador de classes analisa apenas o documento principal; dentro de um shadow root, escreva expressões `var()`, use a saída
do PostCSS ou adote uma folha criada com `dimenClassesToCss([...])`:

```js
const sheet = new CSSStyleSheet();
sheet.replaceSync(dimenClassesToCss(['p:16sdp', 'fs:14ssp']));
this.shadowRoot.adoptedStyleSheets = [sheet];
```

Próximo: [SSR](./ssr.md) · [Voltar ao índice](./README.md)
