# CSS, Sass e PostCSS

Tudo o que o webdimens faz em CSS se apoia em propriedades personalizadas: `install()` publica o tamanho de uma unidade por
token (`--sdp`, `--ssp`, `--pwsdp`…), e todas as outras formas — `calc()` puro, o fallback só em CSS, funções Sass e o plugin
PostCSS — escrevem `calc(N * var(--token))`. Esta página cobre cada forma e quando usá-la.

## As propriedades personalizadas

Depois de `install()` (ou do script do CDN), `:root` tem uma propriedade por token CSS de cada estratégia registrada, com o
tamanho de **uma unidade** em px CSS. Em uma janela de 600 × 900 com escala de fonte 1,25:

| Propriedade | Valor | Significado |
|---|---|---|
| `--sdp` / `--hdp` / `--wdp` | `2px` / `3px` / `2px` | 1 dp no eixo de menor largura / altura / largura |
| `--sdpa`, `--sdpi`, `--sdpia`, `--hdpLw`, `--sdpPh`, … | | toda variante `dp`: flags `a` `i` `ia` e inversores |
| `--ssp` / `--hsp` / `--wsp` (+ `a` `i` `ia`) | `2.5px` / … | texto: × escala de fonte |
| `--sem` / `--hem` / `--wem` (+ `a` `i` `ia`) | `2px` / … | texto sem escala de fonte |
| `--pwsdp`, `--fsdp`, `--logsdp`, … | | as mesmas famílias para cada estratégia registrada (veja abaixo) |
| `--ad-w` `--ad-h` `--ad-sw` | `600px` `900px` `600px` | largura, altura e menor largura da viewport |
| `--ad-density` `--ad-dpi` | `2` `320` | devicePixelRatio e dpi (× 160) |
| `--ad-font-scale` | `1.25` | escala de fonte |
| `--ad-landscape` `--ad-multi-window` | `0` / `1` | flags numéricas utilizáveis em `calc()` |

Uma estratégia é registrada automaticamente quando o runtime vê um dos seus tokens (JS, classe, `data-dimen`, `ad-<id>`). CSS que o
runtime nunca analisa — `var(--fsdp)` escrito à mão ou saída de PostCSS — precisa de `install({ strategies: ['fluid'] })` (ou `'all'`).
Variantes `sp`/`em` com inversores e variantes `Px` são exclusivas de JavaScript. Os valores são escritos com uma constructable
stylesheet (compatível com CSP; recorre a um elemento `<style>` com `cssNonce`) usando o seletor `:root:root`, então sobrescrevem o
fallback abaixo. Eles são reescritos no máximo uma vez por frame de animação, e somente quando o snapshot muda.

## Escrevendo calc() à mão

```css
.card {
  padding: calc(16 * var(--sdp));              /* 16sdp */
  border-radius: calc(12 * var(--sdpa));       /* 12sdpa */
  gap: calc(8 * var(--sdp)) calc(4 * var(--hdp));
  font-size: calc(14 * var(--ssp));            /* 14ssp */
  width: max(calc(120 * var(--wdp)), 240px);   /* combine livremente com CSS */
}
@media (orientation: landscape) {
  .card { padding: calc(24 * var(--sdp)); }
}
:root[data-ad-mode="tv"] .card { font-size: calc(28 * var(--ssp)); }
```

`cssDimen()` monta a mesma string em JavaScript: `cssDimen('sdpa', 16)` → `"calc(16 * var(--sdpa))"`.

### Tokens de design por cima

```css
:root {
  --space-1: calc(4 * var(--sdp));
  --space-2: calc(8 * var(--sdp));
  --space-4: calc(16 * var(--sdp));
  --text-body: calc(14 * var(--ssp));
  --radius-card: calc(12 * var(--sdp));
}
.card { padding: var(--space-4); font-size: var(--text-body); border-radius: var(--radius-card); }
```

Como `--sdp` muda ao redimensionar, todo token derivado dele acompanha.

## Fallback só em CSS (sem JavaScript, primeira pintura)

Os fallbacks de folha de estilo definem os tokens com unidades de viewport, então as páginas ficam escaladas antes de o script rodar, ou sem JavaScript:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/webdimens@3/css/webdimens.css">
```

```js
// bundlers
import 'webdimens/css';                      // tokens escalados (css/webdimens.css)
import 'webdimens/css/strategies/fluid.css'; // uma estratégia
import 'webdimens/css/all.css';              // todas as estratégias
```

| Estratégia | Valor em CSS puro | Qualidade |
|---|---|---|
| escalada, percentual | `calc(min(100vw, 100vh) / 300)` (h: `100vh`, w: `100vw`) | exato sem a correção `a` |
| fluid | `clamp(0.8px, 0.8px + (min(100vw, 100vh) - 320px) * 0.000892857, 1.2px)` | exato sem `a` |
| fill / fit | `max/min(min(100vw, 100vh) / 300, max(100vw, 100vh) / 533)` | exato sem `a` |
| interpolated | `calc(0.5px + min(100vw, 100vh) / 600)` | exato sem `a` |
| perimeter | `calc((100vw + 100vh) / 833)` | exato sem `a` |
| diagonal | `calc(hypot(100vw, 100vh) / 611.6305)` dentro de `@supports (width: hypot(1px, 1px))` | exato sem `a` onde `hypot()` é suportado |
| power, auto | aproximação linear | aproximado |
| logarithmic | `1px` | placeholder |
| density | `1px`, depois degraus de `@media (min-resolution: 1.25dppx … 4dppx)` | em degraus |

Limites do fallback: `sp` é igual a `dp` (sem escala de fonte), as variantes `a` são iguais às simples, os inversores usam
media queries de orientação, e `vw`/`vh` diferem um pouco da medição do runtime (barras de rolagem, barras de URL do celular). O
runtime substitui todos os valores assim que começa a rodar.

**Uso somente com CSS.** Para estratégias lineares, o fallback sozinho basta: vincule `webdimens/css`, escreva `calc(16 * var(--sdp))`
e dispense JavaScript por completo ([examples/css-only.html](../../examples/css-only.html)). Classes, `data-dimen`, condições de
modo de UI e classes modificadoras precisam do runtime.

## Sass

Cada token CSS é uma função Sass que retorna a expressão `calc()`:

```scss
@use 'webdimens/scss' as d;

.card {
  padding: d.sdp(16);                 // calc(16 * var(--sdp))
  font-size: d.ssp(14);               // calc(14 * var(--ssp))
  margin: d.pwhdpa(8);                // calc(8 * var(--pwhdpa))
  gap: d.dimen(sdpLw, 4);             // forma genérica: calc(4 * var(--sdpLw))
}
```

O arquivo é `scss/_webdimens.scss`. Com caminho direto: `@use 'node_modules/webdimens/scss/webdimens' as d;`. O Sass apenas
escreve as expressões; os valores continuam vindo do runtime ou do CSS de fallback.

## Plugin PostCSS

Escreva unidades diretamente em qualquer arquivo CSS e compile-as em tempo de build (custo zero em runtime para a conversão):

```js
// postcss.config.mjs
import webdimens from 'webdimens/postcss';

export default { plugins: [webdimens()] };
```

```css
.card {
  padding: 8sdp 16sdp;
  font-size: 14ssp;
  margin: max(8sdp, 4px) auto;
  background: url(/img/16sdp.png);      /* url() e strings entre aspas nunca são reescritos */

  @dimen landscape { padding: 12sdp 24sdp; }
  @dimen sw600 { padding: 24sdp 32sdp; }
  @dimen tv { font-size: 28ssp; }
  @dimen tv sw600 { padding: 48sdp; }
}
```

Saída (copiada do plugin; a formatação é do PostCSS, o CSS é válido):

```css
.card {
  padding: calc(8 * var(--sdp)) calc(16 * var(--sdp));
  font-size: calc(14 * var(--ssp));
  margin: max(calc(8 * var(--sdp)), 4px) auto;
  background: url(/img/16sdp.png)      /* url() e strings entre aspas nunca são reescritos */
}
@media (orientation: landscape) {
  .card { padding: calc(12 * var(--sdp)) calc(24 * var(--sdp))
  }
}
@media (min-width: 600px) and (min-height: 600px) {
  .card { padding: calc(24 * var(--sdp)) calc(32 * var(--sdp))
  }
}
:root[data-ad-mode="tv"] .card { font-size: calc(28 * var(--ssp))
}
@media (min-width: 600px) and (min-height: 600px) {
  :root[data-ad-mode="tv"] .card { padding: calc(48 * var(--sdp))
  }
}
```

- `@dimen <condições> { … }` aceita as mesmas condições das classes (`landscape`, `portrait`, `sw600`, `w840`, `h480`, modos de UI,
  `mw`, combinações separadas por espaços). Ele precisa estar aninhado em uma regra de estilo.
- Os blocos gerados são emitidos depois do seu pai **na ordem de prioridade do Android** (modo + qualificador > modo > qualificador,
  limiar maior depois > orientação), qualquer que seja a ordem em que você os escreveu.
- Tokens exclusivos de JavaScript (`2sdpPx`) e condições desconhecidas fazem o build falhar com um erro claro.
- Opção: `webdimens({ atRule: 'screen' })` renomeia `@dimen`.
- As regras `@tv` / `@mw` precisam do runtime em execução (ele define `<html data-ad-mode>`); condições de media query funcionam só com
  o CSS de fallback.

### Configuração por ferramenta

| Ferramenta | Onde |
|---|---|
| Vite | `postcss.config.mjs` na raiz do projeto (detectado automaticamente) |
| Next.js | `postcss.config.mjs` com `plugins: { 'webdimens/postcss': {} }` (o build CommonJS exporta a própria função do plugin) |
| webpack | `postcss-loader` com o mesmo arquivo de configuração |
| CLI | `npx postcss input.css -o output.css` (veja [examples/postcss/](../../examples/postcss/)) |

```js
// postcss.config.mjs do Next.js (forma em string)
export default { plugins: { 'webdimens/postcss': {} } };
```

O objeto do plugin é tipado para ser atribuível ao tipo `Plugin` do próprio PostCSS, então configurações em TypeScript funcionam sem casts.

## Convivendo com outras ferramentas

- **Tailwind CSS**: classes de dimensão só reivindicam nomes de classe cujo valor contém um token de unidade, então `hover:bg-red-500` ou
  `md:p-4` não são tocados. Você também pode usar os tokens dentro de valores arbitrários do Tailwind: `p-[calc(16*var(--sdp))]`.
- **CSS Modules / estilos com escopo**: propriedades personalizadas herdam normalmente; escreva `calc(16 * var(--sdp))` ou use o plugin
  PostCSS. Nomes de classe com hash não importam: o plugin só reescreve valores de declaração e blocos `@dimen`.
- **Shadow DOM**: propriedades personalizadas herdam para dentro de shadow roots, então `var(--sdp)` funciona dentro de web components. O
  compilador de classes só varre o documento principal; dentro de um shadow root use `var()` ou a saída do PostCSS.

Próximo: [API JavaScript](./javascript.md) · [Voltar ao índice](./README.md)
