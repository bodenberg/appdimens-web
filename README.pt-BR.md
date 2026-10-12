# webdimens — AppDimens Dynamic para a web

`dp` / `sp` responsivos na web com **a mesma matemática e os mesmos nomes de API do
[AppDimens Dynamic](https://github.com/bodenberg/appdimens-dynamic) 3.2.0 para Android**:
`sdp`, `hdp`, `wdp`, `ssp`, `sem`, sufixos `a` / `i` / `ia` / `Px`, inversores de orientação,
facilitadores `Rotate` / `Mode` / `Qualifier` / `Screen`, builders `scaledDp().screen()`,
12 estratégias de escala, resize e unidades físicas.

> **Idiomas:** [English](README.md) · Português (BR)

- **Rápida.** Os fatores são pré-calculados uma vez por mudança de viewport; cada chamada é um branch e uma multiplicação (~11 ns, 80–90 M ops/s no Node).
- **Escreva unidades, não px.** Classes como `class="p:16sdp fs@tv:28ssp"`, atributos `data-dimen="padding: 8sdp 16sdp"`, `padding: 16sdp` no CSS (PostCSS) e `dimen('14ssp')` no JS. As condições seguem os qualifiers do Android (`@landscape`, `@sw600`, `@tv`), e as classes `ad-a`, `ad-i` e `ad-power` definem flags ou a estratégia para toda a subárvore.
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

## Uso rápido — escreva `16sdp` em vez de `16px`

```js
import { install } from 'webdimens';
install(); // rastreia o viewport, publica as variáveis CSS e ativa as classes declarativas (no script CDN é automático)
```

As mesmas unidades (`16sdp`, `14ssp`, `12sspa`, `8hdpLw`, `10pwsdp` …) funcionam em todos os lugares:

### 1. Classes (sem arquivo CSS)

```html
<div class="p:16sdp r:12sdp fs:14ssp">…</div>                     <!-- padding 16.sdp, raio 12.sdp, fonte 14.ssp -->
<div class="m:8sdp_16sdp w:120wdp h:48hdp">…</div>               <!-- "_" = espaço (vários valores) -->
<h1 class="fs:20ssp fs@landscape:24ssp fs@sw600:28ssp fs@tv:40ssp">…</h1>
<div class="p@tv@sw600:48sdp p:16sdp!">…</div>                   <!-- "!" = !important -->
```

O formato é `prop[@condição…]:valor`. As condições espelham os qualifiers do Android e as regras do `.screen()`:

| Condição | Significado | Equivalente Android |
|---|---|---|
| `@landscape` / `@portrait` | orientação | `Orientation.LANDSCAPE` / `PORTRAIT` |
| `@sw600` · `@w600` · `@h600` (`dp` opcional) | menor lado / largura / altura ≥ 600 dp | `DpQualifier` + valor (`values-sw600dp`) |
| `@tv` `@car` `@watch` `@desk` `@appliance` `@vr` `@normal` | modo de UI | `UiModeType` |
| `@fold-open` `@fold-half` `@fold-closed` `@flip-open` `@flip-half` `@flip-closed` | dobráveis | `UiModeType.FOLD_*` / `FLIP_*` |
| `@mw` | janela dividida / flutuante | multi-window |

As condições podem ser combinadas (`p@tv@sw600:48sdp`). A prioridade é a do `.screen()` do Android, independente da ordem das classes:
modo + qualifier > modo > qualifier (o limite maior vence) > orientação > padrão.

Nomes curtos de propriedade: `p pt pr pb pl px py m mt mr mb ml mx my w h size minw minh maxw maxh fs lh ls gap gapx gapy r bw basis indent`.
Qualquer propriedade CSS (`border-top-width:2sdp`) e custom properties (`--gap:12sdp`) também funcionam. Classes sem um token de
unidade são ignoradas; o `hover:bg-red-500` do Tailwind, por exemplo, não é afetado.

### 2. Classes modificadoras (flags e estratégia para toda a subárvore)

```html
<section class="ad-a">  … todo sdp/ssp aqui dentro vira sdpa/sspa (aspect ratio) </section>
<section class="ad-i">  … ignora multi-window (sdpi)                             </section>
<section class="ad-ia"> … os dois                                                 </section>
<section class="ad-power"> … --sdp, --ssp, p:16sdp … usam a estratégia power (import 'webdimens/power') </section>
```

Elas podem ser aninhadas e combinadas (`class="ad-fluid ad-a"`). Tokens explícitos como `16sdpia` ou `16pwsdp` também funcionam em qualquer lugar.

### 3. `data-dimen` (várias declarações num atributo)

```html
<div data-dimen="padding: 8sdp 16sdp; font-size: 14ssp; padding@landscape: 12sdp 24sdp; font-size@tv: 28ssp">
```

### 4. Arquivos CSS

Com o plugin PostCSS (Vite, Next, webpack…), sem custo em runtime:

```js
// postcss.config.js
import webdimens from 'webdimens/postcss';
export default { plugins: [webdimens()] };
```

```css
.card {
  padding: 8sdp 16sdp;              /* → calc(8 * var(--sdp)) calc(16 * var(--sdp)) */
  font-size: 14ssp;
  @dimen landscape { padding: 12sdp 24sdp; }
  @dimen sw600 { padding: 32sdp; }
  @dimen tv sw600 { font-size: 28ssp; }
}
```

Sem build, use `<style data-webdimens>`, que o runtime compila uma vez. Com Sass: `@use 'webdimens/scss' as d; padding: d.sdp(16);`.
Em CSS puro, as custom properties também funcionam direto: `padding: calc(16 * var(--sdp))`.

### 5. JavaScript

```jsx
import { dimen, dimenCss, dimens, dimensPx, sdp, ssp, sdpRotate, scaledDp, Orientation, UiModeType, DpQualifier } from 'webdimens';

dimen('16sdp');                                   // 19.2 (px CSS agora): qualquer token, como '14sspa', '2sdpPx', '10pwsdp'
el.style.padding = dimenCss('8sdp 16sdp');          // string calc() responsiva
<div style={dimens({ padding: '8sdp 16sdp', fontSize: '14ssp' })} />   // objeto de estilo responsivo, seguro para SSR
<div style={dimensPx({ width: '120wdp' })} />                          // objeto de estilo em px (re-render na mudança)

sdp(16); ssp(14);                                  // nomes do Android como funções
sdpRotate(80, 50, Orientation.LANDSCAPE);
scaledDp(16).screen(UiModeType.TELEVISION, 40).screen(DpQualifier.SMALL_WIDTH, 600, 24).sdp
```

### Frameworks

```tsx
import { useDimens } from 'webdimens/react';      // React: classes e dimens() não precisam de re-render; números em JS precisam (useDimens)
import { WebDimens, useDimen } from 'webdimens/vue'; // Vue: app.use(WebDimens); useDimen(() => sdp(16))
import { dimen } from 'webdimens/svelte';          // Svelte: const pad = dimen(() => sdp(16)) → $pad
import { provideWebDimens, injectDimen } from 'webdimens/angular'; // Angular 16+: Signal<number>
```

Em SSR, as classes, o `data-dimen`, o `dimens()` e os tokens CSS renderizam igual no servidor e no cliente. Para o primeiro paint,
pré-compile as regras das classes com `dimenClassesToCss([...])` ou use o plugin PostCSS.

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

## Publicação (mantenedores)

npm, Yarn e pnpm usam o mesmo registro npm, então uma publicação serve aos três:

```bash
npm login
npm publish --access public      # o prepublishOnly roda `npm run check` antes
# usuários: npm i webdimens · yarn add webdimens · pnpm add webdimens
```

## Desenvolvimento

```bash
npm run generate && npm test && npm run check
node scripts/browser-check.mjs   # teste real no Chromium
```

Licença Apache-2.0 © Jean Bodenberg
