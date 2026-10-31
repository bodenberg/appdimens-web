# Receitas

Soluções completas, prontas para copiar, para layouts comuns. Cada uma assume que o runtime está instalado (`install()` ou o script do CDN).

## Card responsivo

```html
<article class="card p:16sdp p@sw600:24sdp r:12sdp gap:8sdp">
  <img class="size:48sdp r:24sdp" src="/avatar.png" alt="">
  <h2 class="fs:18ssp fs@sw600:22ssp">Ada Lovelace</h2>
  <p class="fs:14ssp lh:20ssp">First programmer.</p>
  <button class="h:48sdp px:16sdp r:8sdp fs:14ssp">Follow</button>
</article>
<style>
  .card { display: grid; justify-items: start; border: 1px solid #ddd; }   /* 1px: linhas finas permanecem fixas */
</style>
```

Em um celular de 360 dp o padding é 19.2 px e o avatar 57.6 px; em um tablet de 600 dp o padding de `@sw600` resulta em 48 px.

## Escala tipográfica

```css
/* tokens.css — com o plugin PostCSS */
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

Sem PostCSS, escreva `--text-md: calc(16 * var(--ssp));`. `ssp` segue a preferência de tamanho de fonte do usuário; troque um bloco para crescimento limitado com `class="ad-fluid"` (de 0.8× a 1.2× do tamanho de design).

## Tokens de design do webdimens

```css
:root {
  --space-1: calc(4 * var(--sdp));
  --space-2: calc(8 * var(--sdp));
  --space-3: calc(12 * var(--sdp));
  --space-4: calc(16 * var(--sdp));
  --radius-sm: calc(6 * var(--sdp));
  --radius-lg: calc(16 * var(--sdp));
  --touch-min: max(calc(48 * var(--sdp)), 9mm);   /* nunca abaixo de 9 mm fisicamente */
}
.button { min-height: var(--touch-min); padding: var(--space-2) var(--space-4); border-radius: var(--radius-sm); }
```

Todo componente construído sobre esses tokens escala com a janela, e uma mudança no design system é uma única edição.

## Transferência de especificação (Figma / Android → web)

Uma especificação em dp num frame de celular com 360 dp de largura é portada 1:1:

| Especificação | Web |
|---|---|
| padding 16 dp, raio 12 dp | `class="p:16sdp r:12sdp"` |
| corpo 14 sp | `fs:14ssp` |
| altura da linha 56 dp | `h:56sdp` |
| linha fina 1 px | `border: 1px solid` (não escalada) |

A referência do AppDimens é 300 dp, então no próprio frame de 360 dp os valores web são 1.2× a especificação (16sdp = 19.2 px). Esse é o mesmo resultado que o app Android mostra nesse celular.

## TV / interface a 3 metros

```html
<nav class="gap:8sdp gap@tv:24sdp">
  <a class="p:8sdp_12sdp p@tv:16sdp_32sdp fs:14ssp fs@tv:28ssp r:8sdp" href="/">Home</a>
  <a class="p:8sdp_12sdp p@tv:16sdp_32sdp fs:14ssp fs@tv:28ssp r:8sdp" href="/movies">Movies</a>
</nav>
<style>
  :root[data-ad-mode="tv"] a:focus { outline: calc(3 * var(--sdp)) solid #fff; }   /* foco visível do controle remoto */
</style>
<script type="module">
  import { install, UiModeType } from 'webdimens';
  // Builds de TV do app sabem que rodam em uma TV: não dependa de detecção por user-agent.
  install({ uiModeType: UiModeType.TELEVISION });
</script>
```

## Dobráveis

```html
<main class="p:16sdp p@fold-open:32sdp" data-dimen="gap: 12sdp; gap@fold-half: 0">
  <section class="pane">List</section>
  <section class="pane">Details</section>
</main>
<style>
  main { display: grid; }
  :root[data-ad-mode="fold-half"] main { grid-template-columns: 1fr 1fr; }   /* dobradiça entre os painéis */
</style>
```

As posturas de dispositivos dobráveis vêm das APIs Viewport Segments / Device Posture onde o navegador as suporta.

## Espaçamento para paisagem e breakpoints de tablet

```html
<section class="grid p:12sdp p@landscape:12sdp_24sdp p@sw600:24sdp p@sw840:32sdp gap:8sdp gap@sw600:16sdp">…</section>
<style>
  .grid { display: grid; grid-template-columns: 1fr; }
  @media (min-width: 600px) and (min-height: 600px) { .grid { grid-template-columns: 1fr 1fr; } }  /* equivale a @sw600 */
  @media (min-width: 840px) and (min-height: 840px) { .grid { grid-template-columns: repeat(3, 1fr); } }
</style>
```

`@sw600` / `@sw840` são os buckets de menor largura do Android; limiares maiores prevalecem automaticamente.

## Gráfico em canvas

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
  // … desenhe com tamanhos em pixels de dispositivo
}
draw();
subscribe(draw);    // redesenha uma vez por quadro quando a janela muda
```

Exemplo completo: [examples/canvas.html](../../examples/canvas.html).

## Painel de dashboard redimensionável

```html
<div id="widget" style="resize: both; overflow: auto; width: 320px; height: 240px">
  <div class="kpi" style="padding: calc(12 * var(--sdp)); font-size: calc(24 * var(--ssp))">42</div>
</div>
<script type="module">
  import { createDimenScope } from 'webdimens';
  createDimenScope(document.getElementById('widget'));   // dentro do widget, --sdp segue o tamanho do widget
</script>
```

## Título com ajuste automático

```html
<header style="display: grid; grid-template-columns: minmax(0, 1fr)">
  <h1 id="hero" style="height: 20vh; overflow: hidden; line-height: 1.1">A headline of any length</h1>
</header>
<script type="module">
  import { autoResizeText } from 'webdimens/resize';
  autoResizeText(document.getElementById('hero'), { min: 20, max: 96, maxLines: 2 });
</script>
```

## Combinando estratégias por seção

```html
<body class="p:16sdp">                         <!-- escalado -->
  <aside class="ad-power p:16sdp">…</aside>    <!-- power: cresce menos em telas grandes -->
  <article class="ad-fluid fs:16ssp">…</article> <!-- texto fluido: 0.8×–1.2× -->
  <footer class="ad-a p:16sdp">…</footer>      <!-- proporção corrigida -->
</body>
```

Os tokens continuam os mesmos (`p:16sdp`); a classe no contêiner muda o significado deles. Classes de estratégia registram sua estratégia automaticamente.

## Tamanhos físicos mínimos

```css
.icon-button {
  width: max(calc(40 * var(--sdp)), 9mm);    /* escala, mas nunca abaixo de 9 mm */
  height: max(calc(40 * var(--sdp)), 9mm);
}
```

Próximo: [Solução de problemas](./troubleshooting.md) · [Voltar ao índice](./README.md)

## Uma lei de escala para todo o design system

Distribua um `appdimens-strategies.json` com seus tokens de design e carregue-o em todas as plataformas (web, Android, iOS, Flutter…):

```ts
import { loadScalingStrategies, cdp } from 'webdimens/custom';
loadScalingStrategies(await (await fetch('/appdimens-strategies.json')).text());   // define o "default"
const pad = cdp(16);              // estratégia padrão do arquivo
```

```css
.card { padding: 16cdp; font-size: 14csp-brandText; }   /* PostCSS */
```

Ajustes para TV, relógio ou carro ficam como regras no mesmo arquivo (`{ "when": { "device": "tv" }, "set": { … } }`), sem mudar nenhum ponto de chamada. Veja [Estratégias personalizadas](./custom.md).
