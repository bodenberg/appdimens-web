# webdimens — AppDimens Dynamic para a web

`dp` / `sp` responsivos na web com **a mesma matemática e os mesmos nomes de API do
[AppDimens Dynamic](https://github.com/bodenberg/appdimens-dynamic) 3.2.0 para Android**:
`sdp`, `hdp`, `wdp`, `ssp`, `sem`, sufixos `a` / `i` / `ia` / `Px`, inversores de orientação,
facilitadores `Rotate` / `Mode` / `Qualifier` / `Screen`, builders `scaledDp().screen()`,
12 estratégias de escala, resize e unidades físicas.

> **Idiomas:** [English](README.md) · Português (BR)

- **Rápida.** Os fatores são pré-calculados uma vez por mudança de viewport; cada chamada é um branch e uma multiplicação (~11 ns, 80–90 M ops/s no Node).
- **CSS declarativo.** Todo token vira uma custom property: `padding: calc(16 * var(--sdp))`. O layout acompanha o viewport sem re-render em JS. Inclui funções SCSS (`padding: sdp(16)`).
- **Funciona também sem JS.** As folhas de fallback dão valores exatos em CSS puro para as estratégias lineares (e aproximações próximas para as demais) antes da hidratação ou sem JS nenhum.
- **Módulos tree-shakable**, espelhando os artefatos por estratégia do Android: `webdimens`, `webdimens/power`, `webdimens/fluid`, …
- **Integrações** com React, Vue 3, Svelte e Angular (signals). Também há um build CDN para `<script>`.
- **Tipada, sem dependências, segura para SSR.**

## Instalação

```bash
npm install webdimens
```

```html
<!-- CDN: tudo em window.WebDimens, variáveis CSS instaladas no load (≈10 KB gzip) -->
<script src="https://cdn.jsdelivr.net/npm/webdimens@3.2.0/dist/webdimens.global.js"></script>
```

## Uso rápido

### CSS (declarativo — recomendado para layout)

```js
import { install } from 'webdimens';
install(); // publica --sdp, --hdp, --wdp, --ssp, --sem… e mantém atualizado
```

```css
@import 'webdimens/css'; /* opcional: valores em CSS puro antes do JS / sem JS */

.card {
  padding: calc(16 * var(--sdp));   /* Android: 16.sdp */
  height: calc(120 * var(--hdp));   /* 120.hdp */
  font-size: calc(14 * var(--ssp)); /* 14.ssp  */
}
```

```scss
@use 'webdimens/scss' as d;
.card { padding: d.sdp(16); font-size: d.ssp(14); }
```

### JavaScript (mesmos nomes das extensões `Number` do Android)

```js
import { sdp, ssp, sdpPx, sdpRotate, scaledDp, Orientation, UiModeType, DpQualifier } from 'webdimens';

el.style.padding = `${sdp(16)}px`;         // 16.sdp  → px CSS
ctx.lineWidth = sdpPx(2);                   // 2.sdpPx → px do dispositivo (canvas)
sdpRotate(80, 50, Orientation.LANDSCAPE);  // 80.sdpRotate(50, LANDSCAPE)

const gutter = scaledDp(16)
  .screen(UiModeType.TELEVISION, 40)
  .screen(DpQualifier.SMALL_WIDTH, 600, 24);
gutter.sdp;
```

### Frameworks

```tsx
import { useDimens } from 'webdimens/react';      // React: re-renderiza quando o viewport muda
import { WebDimens, useDimen } from 'webdimens/vue'; // Vue: app.use(WebDimens); useDimen(() => sdp(16))
import { dimen } from 'webdimens/svelte';          // Svelte: const pad = dimen(() => sdp(16)) → $pad
import { provideWebDimens, injectDimen } from 'webdimens/angular'; // Angular 16+: Signal<number>
```

Em SSR, prefira os tokens CSS (`cssDimen('sdp', 16)` → `calc(16 * var(--sdp))`). Eles não
geram mismatch de hidratação.

## Mapeamento Android → web

| Android | Web |
|---|---|
| `dp` | px CSS |
| `sp` | px CSS × font scale (fonte padrão do navegador / 16) |
| `px` (sufixo `Px`) | px do dispositivo (× `devicePixelRatio`) |
| janela (`Configuration`) | viewport, ou um elemento via `createDimenScope` |
| `smallestScreenWidthDp` | `min(largura, altura)` |
| `UiModeType` | heurísticas + APIs Device Posture / Viewport Segments; force com `configure({ uiModeType })` |
| multi-window (`i`) | janela ≥ 10 % mais estreita que a tela; force com `configure({ multiWindow })` |

## Nomes da API

`<prefixo><eixo><tipo><inversor><flags>[Px]`. Os prefixos são: `''` scaled, `p` percent,
`pw` power, `f` fluid, `a` auto, `dg` diagonal, `fl` fill, `ft` fit, `i` interpolated,
`log` logarithmic, `pr` perimeter e `d` density. Os eixos são `s`, `h` e `w`. Os tipos são `dp`,
`sp` (× font scale) e `em` (sem font scale). Os inversores `Ph Lh Pw Lw` e as flags `a i ia`
seguem o Android.

A única diferença é que, no Android, os nomes `Px` são irregulares (`sdpPxaPh`). Na web, `Px`
vem sempre no final: `sdpPhaPx`.

Para cada estratégia existem: os acessores (`sdp(16)`); `toDynamicScaledDp/Px/Sp/SpPx(v, qualifier, opts)`;
os facilitadores `sdpRotate`, `sdpMode`, `sdpQualifier` e `sdpScreen` (com `h`/`w`, `sp` e
`Px`); e os builders `scaledDp` / `scaledSp`. Os helpers `plainRotate`, `plainMode`,
`plainQualifier` e `plainScreen` só escolhem o ramo, sem escalar.

## Estratégias

Comece por **scaled** e troque só quando o QA visual pedir outra curva. As fórmulas são portadas
diretamente dos kernels Kotlin. `tests/parity.test.ts` compara todas as estratégias × eixos ×
inversores × flags em 12 tamanhos de janela. Veja a tabela de fórmulas no [README em inglês](README.md#strategies).

## Resize, unidades e escopos

- `webdimens/resize`: `autoResizeText(el, { min, max, step, maxLines })`, `fittingTextPx` (canvas, sem reflow), `fittingBoxPx`, limites `resizeFixedDp/Sp`, `resizePercentSw/W/H`, `resizePercentBox`. O elemento precisa ter a caixa restrita: em grid/flex use `min-width: 0`.
- `webdimens/units`: `mm`, `cm`, `inch` → dp (1in = 96 px CSS; calibre com `setPhysicalCalibration`).
- `createDimenScope(el)`: o elemento passa a ser a "janela", e `var(--sdp)` dentro dele escala com o container.

## Desenvolvimento

```bash
npm run generate && npm test && npm run check
node scripts/browser-check.mjs   # teste real no Chromium
```

Licença Apache-2.0 © Jean Bodenberg
