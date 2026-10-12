# Primeiros passos

Esta página instala o webdimens, monta um cartão responsivo de três formas (classes, propriedades personalizadas do CSS e JavaScript), lista as opções de `install()` e aponta para a próxima página de acordo com a sua stack. É para desenvolvedores web que ainda não usaram dp e sp, e para desenvolvedores Android que querem a forma web de `16.sdp` em uma primeira página funcionando. O raciocínio por trás dos números está em [concepts.md](./concepts.md); esta página apenas os usa.

## Requisitos

- Um navegador atual. O runtime precisa de propriedades personalizadas do CSS (custom properties), que todo navegador moderno suporta.
- Node 18 ou superior para renderização no servidor, testes e ferramentas de build (o pacote declara `"engines": { "node": ">=18" }`).

## Instalação

Com um gerenciador de pacotes:

```bash
npm install webdimens
# or
yarn add webdimens
# or
pnpm add webdimens
```

Pelo CDN, sem etapa de build:

```html
<script src="https://cdn.jsdelivr.net/npm/webdimens@3/dist/webdimens.global.js"></script>
```

Dois bundles de CDN são publicados:

| Arquivo | Conteúdo | Use quando |
|---|---|---|
| `dist/webdimens.global.js` | todas as estratégias, `resize`, `units` e o runtime | você quer toda a API a partir de uma tag script |
| `dist/webdimens.lite.global.js` | o runtime e a estratégia escalada (`sdp`, `hdp`, `wdp`, `ssp`, `sem`, `dimen`, `install`, …) | você só precisa da estratégia padrão e quer baixar menos |

Os dois expõem tudo em `window.WebDimens` e chamam `install()` quando o script é carregado. O bundle lite não tem `autoResizeText`, `mm` nem `pwsdp`. Para iniciar o runtime por conta própria, adicione `data-no-install` à tag script e chame `WebDimens.install()` depois:

```html
<script src="https://cdn.jsdelivr.net/npm/webdimens@3/dist/webdimens.global.js" data-no-install></script>
<script>
  window.WebDimens.install({ fontScale: 1.2 });
</script>
```

O pacote npm tem uma entrada para cada módulo de estratégia, resize e units, e uma para cada framework (`webdimens/power`, `webdimens/resize`, `webdimens/react`, …). Cada módulo de estratégia é importado separadamente; veja [strategies.md](./strategies.md) e [frameworks.md](./frameworks.md).

## Chame install() uma vez

No ponto de entrada da aplicação, antes da primeira renderização:

```js
import { install } from 'webdimens';

install();
```

`install()` faz três coisas:

1. Começa a acompanhar a viewport: redimensionamento da janela, mudança de orientação, page show, postura do dispositivo e mudanças na razão de pixels.
2. Escreve as propriedades personalizadas do CSS (`--sdp`, `--ssp`, `--hdp`, …) em `:root`.
3. Compila os nomes de classe, os atributos `data-dimen` e os blocos `<style data-webdimens>` do documento, e mantém atualizados os atributos `data-ad-mode`, `data-ad-orientation` e `data-ad-multi-window` em `<html>`.

A chamada é idempotente. Uma segunda chamada atualiza as opções que recebe. Os bundles de CDN chamam isso por você.

As funções JavaScript como `sdp(16)` funcionam sem `install()`, porque começam a acompanhar a viewport no primeiro uso. As variáveis CSS, as classes e os atributos de `<html>` existem apenas depois que `install()` é executado.

## Um cartão, três estilos

O cartão tem 16 dp de padding e raio de 12 dp. Seu título tem 20 sp, que vira 24 sp em paisagem e 40 sp em TV. Os números abaixo valem para uma janela de 600 × 900 px CSS, razão de pixels do dispositivo 1 e tamanho de fonte padrão do navegador (escala de fonte 1).

### 1. Classes

```html
<article class="p:16sdp r:12sdp">
  <h1 class="fs:20ssp fs@landscape:24ssp fs@tv:40ssp">Classes</h1>
</article>
```

O runtime compila cada nome de classe uma única vez. `p:16sdp` vira `.p\:16sdp{padding:calc(16 * var(--sdp))}`. As condições depois de `@` são qualificadores do Android: `@landscape` vira `(orientation: landscape)` e `@tv` vira `:root[data-ad-mode="tv"]`. A sintaxe completa está em [declarative.md](./declarative.md).

Resultado em 600 × 900: padding de 32 px, raio de 24 px, título de 40 px. Em uma janela de TV, o título tem 80 px.

### 2. Propriedades personalizadas do CSS

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

`--sdp` guarda o tamanho de um dp em px CSS. Em 600 × 900 ele vale `2px`, então `calc(16 * var(--sdp))` dá 32 px. `--ssp` é o mesmo valor multiplicado pela escala de fonte. Sem JavaScript, você pode carregar primeiro o fallback só em CSS, assim a página já está escalada enquanto o script carrega:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/webdimens@3/css/webdimens.css">
```

O fallback define `--sdp` como `calc(min(100vw, 100vh) / 300)`. Ele não aplica a escala de fonte nem a correção de razão de aspecto, e as declarações `:root:root` do runtime substituem o fallback assim que `install()` é executado. Mais sobre isso em [css.md](./css.md).

### 3. JavaScript

```js
import { dimen, dimens } from 'webdimens';

const card = document.querySelector('#js-card');
Object.assign(card.style, dimens({ padding: '16sdp', borderRadius: '12sdp' }));

const padPx = dimen('16sdp'); // 32, um número para canvas ou medição
```

`dimens()` retorna strings `calc()`, então o estilo acompanha a viewport sem uma nova renderização. `dimen()` retorna um número em px CSS e é a escolha certa para código de canvas, medição ou layout. No bundle de CDN, as mesmas funções ficam em `WebDimens`, por exemplo `WebDimens.dimens(...)`.

### A página completa a partir do CDN

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

### O que o mesmo cartão faz em um celular

Em 412 × 915 px CSS com razão de pixels do dispositivo 2.625, o mesmo markup dá padding de 21,97 px, raio de 16,48 px e um título de 27,47 px. Nada no markup muda. Só a janela muda.

## Opções de install()

`install()` aceita as opções de `configure()` mais uma própria, `declarative`:

| Opção | Tipo | Padrão | Finalidade |
|---|---|---|---|
| `cssVariables` | `boolean` | `true` no primeiro `install()` | publica `--sdp`, `--ssp`, … em `:root` |
| `declarative` | `boolean` | `true` | compila classes, `data-dimen`, `<style data-webdimens>` e as classes modificadoras `ad-*` |
| `cssNonce` | `string` | nenhum | nonce de CSP para o elemento `<style>` de fallback (não é necessário quando são usadas constructable stylesheets) |
| `uiModeType` | `UiModeType` ou `(size) => UiModeType` | detectado | força o modo de UI, para quiosques ou apps de TV |
| `fontScale` | `number` | tamanho de fonte padrão do navegador ÷ 16 | sobrescreve a escala de texto |
| `multiWindow` | `boolean` ou `(size) => boolean` | detectado | força o estado de janela dividida (controla as variantes `i` e `@mw`) |
| `measure` | `() => { width, height }` | `innerWidth` × altura da viewport de layout | mede outra viewport, por exemplo em uma visualização incorporada |
| `strategies` | `string[]` ou `'all'` | `[]` | registra estratégias cujos tokens aparecem apenas em CSS escrito à mão ou em saída de PostCSS |

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

Outras funções que acompanham o `install()`:

| Função | Finalidade |
|---|---|
| `uninstall()` | para de acompanhar e remove o CSS gerado e os atributos de `<html>` |
| `configure(options)` | altera as opções depois do install; chaves não especificadas mantêm o valor |
| `refresh()` | mede a escala de fonte novamente, por exemplo depois que o usuário alterou o tamanho de fonte padrão |
| `setMetrics(snapshot \| null)` | fixa um snapshot (renderização no servidor, testes, pré-visualizações); `null` volta para a viewport ao vivo |

Essas opções têm efeito no navegador. No servidor, fixe o snapshot com `setMetrics()`; veja [ssr.md](./ssr.md).

## Veja o que o runtime enxerga

```js
import { getMetrics } from 'webdimens';

const m = getMetrics();
console.log(m.screenWidthDp, m.screenHeightDp, m.orientation, m.fontScale);
```

Em 600 × 900 isso imprime `600 900 PORTRAIT 1`. `getMetrics()` retorna o snapshot imutável a partir do qual todos os valores são calculados. [concepts.md](./concepts.md#o-snapshot-da-viewport) lista cada campo.

## Três coisas que pegam as pessoas desprevenidas

1. **Classes precisam do runtime.** `p:16sdp` não faz nada até `install()` ser executado ou o script do CDN ser carregado. Uma classe só é compilada quando o runtime a encontra no documento.
2. **CSS escrito à mão para outras estratégias precisa de uma linha.** Tokens que o runtime vê (`dimen('10pwsdp')`, `p:10pwsdp`, `data-dimen`, `ad-power`) registram a estratégia automaticamente. Uma folha de estilo que escreve `calc(16 * var(--pwsdp))` por conta própria, ou saída de PostCSS, nunca é analisada em tempo de execução: adicione `install({ strategies: ['power'] })`.
3. **Tokens `Px` são para JavaScript.** `dimen('16sdpPx')` retorna pixels do dispositivo e funciona em `dimen()` e `dimensPx()`. Em uma classe, a regra é ignorada com um aviso no console. Em `dimens()`, lança um erro. O plugin PostCSS faz o build falhar. Veja [troubleshooting.md](./troubleshooting.md).

## Próximos passos por stack

| Sua stack | Leia em seguida | Depois |
|---|---|---|
| HTML puro, script do CDN | [declarative.md](./declarative.md) para classes e `data-dimen` | [css.md](./css.md) |
| HTML ou CSS com ferramenta de build (Vite, webpack, Next) | [css.md](./css.md) para o plugin PostCSS | [declarative.md](./declarative.md) |
| JavaScript ou TypeScript puro | [javascript.md](./javascript.md) | [api-reference.md](./api-reference.md) |
| React, Vue, Svelte ou Angular | [frameworks.md](./frameworks.md) | [javascript.md](./javascript.md) |
| Renderização no servidor (Next, Nuxt, SvelteKit, Angular SSR) | [ssr.md](./ssr.md) | [declarative.md](./declarative.md) |
| Portar um layout Android | [migration-android.md](./migration-android.md) | [concepts.md](./concepts.md) |

Antes de escrever muitas unidades, leia [concepts.md](./concepts.md). Ele explica o que `sdpa`, `hdpLw` e `sdpPh` selecionam, e por que o mesmo número gera pixels diferentes em janelas diferentes.

Próximo: [Conceitos](./concepts.md) · [Voltar ao índice](./README.md)
