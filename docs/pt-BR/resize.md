# Resize

`webdimens/resize` é a versão web do módulo de resize do AppDimens (`autoResizeTextSp`, `ResizeBound`). Ele **não** é uma curva
de escala: ele encontra o **maior** tamanho em um intervalo `[min, max]`, em incrementos de `step`, que ainda cabe no espaço
disponível, por meio de busca binária sobre uma tabela de passos. Use-o para títulos e rótulos que precisam preencher uma caixa
sem transbordar, e para caixas dimensionadas ao espaço que recebem.

```js
import { autoResizeText, fittingTextSize, fittingTextPx, fittingBoxPx } from 'webdimens/resize';
```

O bundle de CDN expõe as mesmas funções em `window.WebDimens`.

## Ajuste automático de texto em um elemento

```html
<h1 id="title" style="height: 64px; overflow: hidden; white-space: nowrap">Single-line headline that always fits</h1>
<p id="lead" style="height: 72px; overflow: hidden; line-height: 1.2">A paragraph that may wrap onto at most two lines…</p>
<script type="module">
  import { autoResizeText } from 'webdimens/resize';

  const title = autoResizeText(document.getElementById('title'), { min: 10, max: 48 });
  const lead = autoResizeText(document.getElementById('lead'), { min: 10, max: 32, step: 0.5, maxLines: 2 });

  title.fontSize;      // o tamanho aplicado, em px CSS
  title.refit();       // ajusta de novo agora
  title.disconnect();  // para de observar
</script>
```

`autoResizeText(element, options)` ajusta imediatamente, define `element.style.fontSize` e mantém o ajuste: ele reajusta quando a
caixa do elemento muda (`ResizeObserver`, ignorando a mudança causada pela própria escrita do font-size), quando o texto muda
(`MutationObserver`) e ao redimensionar a janela — no máximo uma vez por frame de animação.

`fittingTextSize(element, options)` faz um único ajuste e retorna o tamanho (px CSS). Ambos medem o layout do próprio elemento,
então respeitam sua família de fonte, peso, letter-spacing, padding e `line-height`.

| Opção | Padrão | Significado |
|---|---|---|
| `min` | `8` | menor tamanho; um número é **sp** (× escala de fonte) ou um limite (abaixo) |
| `max` | `96` | maior tamanho |
| `step` | `1` | granularidade |
| `maxLines` | ilimitado | também exige que o texto use no máximo essa quantidade de linhas |

As linhas são contadas a partir das caixas de linha renderizadas (`Range.getClientRects()`); quando o layout não retorna nenhuma
(motores antigos, testes), a altura do conteúdo é medida com `height: auto` e dividida pela altura da linha. Se nada couber, o
mínimo é aplicado.

### A caixa precisa ter restrição de tamanho

O elemento precisa de uma largura definida (e de uma altura, a menos que você dependa de `maxLines`). Dentro de layouts de grid e
flex, os itens usam `min-width: auto` por padrão e crescem para caber no conteúdo, então o texto sempre "cabe" no tamanho máximo:

```css
/* antes: o título nowrap estica a trilha do grid — sempre 48px, a página transborda */
.page { display: grid; }

/* depois: a trilha pode encolher abaixo do conteúdo */
.page { display: grid; grid-template-columns: minmax(0, 1fr); }
.row > .title { min-width: 0; }          /* itens de flex */
```

## Ajuste com canvas (sem reflow)

`fittingTextPx(options)` mede com um contexto 2D de canvas em vez do DOM, então nunca força layout — útil para muitos rótulos,
listas virtualizadas ou interfaces de canvas / WebGL.

```js
import { fittingTextPx } from 'webdimens/resize';

fittingTextPx({ text: 'Revenue by region', maxWidth: 240, maxLines: 1, font: '600 Inter, sans-serif' });   // → px
fittingTextPx({ text: longText, maxWidth: 320, maxHeight: 96, lineHeight: 1.3, min: 10, max: 28 });
```

| Opção | Padrão | |
|---|---|---|
| `text` | obrigatório | `\n` inicia um novo parágrafo |
| `maxWidth` | obrigatório | px CSS |
| `maxHeight` | nenhum | px CSS; com `lineHeight`, limita o número de linhas |
| `maxLines` | ilimitado | |
| `font` | `'sans-serif'` | fonte CSS com ou sem tamanho: `'600 italic Inter, sans-serif'`; o tamanho é inserido em cada candidato |
| `lineHeight` | `1.2` | multiplicador |
| `letterSpacing` | `0` | px CSS por caractere |
| `min` / `max` / `step` | `8` / `96` / `1` | como acima |

As palavras são quebradas de forma gulosa; uma única palavra mais larga que `maxWidth` não cabe naquele tamanho. Retorna `0` quando
nada cabe. Sem canvas (Node), os glifos são aproximados como 0,55 em de largura.

## Caixas

`fittingBoxPx(min, max, step, availablePx)` retorna o maior passo que não excede o tamanho disponível — miniaturas quadradas,
avatares, tiles:

```js
import { fittingBoxPx, resizePercentW } from 'webdimens/resize';

fittingBoxPx(48, 160, 8, container.clientWidth / 3);        // o maior entre 48, 56, … 160 que cabe em um terço do container
fittingBoxPx(48, resizePercentW(30), 4, 100);               // max = 30 % da largura da viewport → 100 em uma janela larga
```

Para caixas, números simples são **dp** (px CSS); para texto, são **sp**.

## Limites

| Limite | Significado |
|---|---|
| um número | sp para texto, dp para caixas |
| `resizeFixedDp(dp)` | px CSS fixos |
| `resizeFixedSp(sp)` | sp × escala de fonte |
| `resizePercentSw(p)` / `resizePercentW(p)` / `resizePercentH(p)` | 0–100 % do menor lado / da largura / da altura da viewport |
| `resizePercentBox(p, basis = MIN_SIDE)` | 0–100 % da caixa interna do elemento; `AutoResizePercentBasis.WIDTH`, `HEIGHT` ou `MIN_SIDE` |

```js
import { autoResizeText, resizePercentBox, resizeFixedSp, AutoResizePercentBasis } from 'webdimens/resize';

autoResizeText(badge, {
  min: resizeFixedSp(10),
  max: resizePercentBox(60, AutoResizePercentBasis.HEIGHT),  // no máximo 60 % da altura do badge
});
```

`resolveBound(bound, box?, metrics?)` converte um limite em px CSS. Porcentagens são limitadas a 0–100 e tamanhos negativos a 0.

## Funções auxiliares de baixo nível

```js
import { buildResizeStepsPx, findLargestFittingResizePx, ResizeRangePx } from 'webdimens/resize';

buildResizeStepsPx(10, 15, 2);                     // Float64Array [10, 12, 14, 15] (o máximo é sempre incluído, ≤ 4096 passos)
findLargestFittingResizePx(steps, (px) => px <= 13);  // 12 — busca binária, O(log n) chamadas a fits()
new ResizeRangePx(10, 15, 2).resolveFitting((px) => px <= 13);   // 12
```

Uma página executável com três caixas ajustadas está em [examples/resize.html](../../examples/resize.html).

Próximo: [Unidades e space](./units.md) · [Voltar ao índice](./README.md)
