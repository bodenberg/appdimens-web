# Unidades declarativas

Escreva `16sdp`, `14ssp`, `12sspa` em vez de px diretamente no HTML: **classes** de dimensão, atributos **`data-dimen`** e
blocos **`<style data-webdimens>`**, com **condições** de qualificador do Android (`@landscape`, `@sw600`, `@tv`…) e
**classes modificadoras** que trocam flags ou a estratégia de uma subárvore inteira. Tudo aqui compila uma única vez para
CSS comum; redimensionar a janela nunca executa JavaScript para essas regras.

Requer o runtime: `install()` no seu entry point, ou o script do CDN (que executa o install ao carregar).

## Classes de dimensão

```html
<div class="p:16sdp r:12sdp fs:14ssp">…</div>
<div class="m:8sdp_16sdp w:120wdp h:48hdp">…</div>
<h1 class="fs:20ssp fs@landscape:24ssp fs@sw600:28ssp fs@tv:40ssp">…</h1>
```

Sintaxe: **`propriedade[@condição…]:valor[!]`**

- `propriedade`: um apelido curto (tabela abaixo), qualquer nome de propriedade CSS (`border-top-width:2sdp`) ou uma propriedade personalizada (`--gap:12sdp`).
- `valor`: um ou mais literais; `_` representa um espaço (`m:8sdp_16sdp`). Valores CSS comuns podem ser misturados (`m:8sdp_auto`).
- `!` no final adiciona `!important`.

Cada classe compila em uma regra. Saída real do compilador:

| Classe | CSS compilado |
|---|---|
| `p:16sdp` | `.p\:16sdp{padding:calc(16 * var(--sdp))}` |
| `m:8sdp_16sdp` | `.m\:8sdp_16sdp{margin:calc(8 * var(--sdp)) calc(16 * var(--sdp))}` |
| `size:48sdp` | `.size\:48sdp{width:calc(48 * var(--sdp));height:calc(48 * var(--sdp))}` |
| `--gap:12sdp` | `.--gap\:12sdp{--gap:calc(12 * var(--sdp))}` |
| `p:16sdp!` | `.p\:16sdp\!{padding:calc(16 * var(--sdp)) !important}` |
| `p@landscape:24sdp` | `@media (orientation: landscape){.p\@landscape\:24sdp{padding:calc(24 * var(--sdp))}}` |
| `p@sw600:32sdp` | `@media (min-width: 600px) and (min-height: 600px){.p\@sw600\:32sdp{…}}` |
| `fs@tv:28ssp` | `:root[data-ad-mode="tv"] .fs\@tv\:28ssp{font-size:calc(28 * var(--ssp))}` |
| `p@tv@sw600:48sdp` | `@media (min-width: 600px) and (min-height: 600px){:root[data-ad-mode="tv"] .p\@tv\@sw600\:48sdp{…}}` |
| `w@mw:100wdp` | `:root[data-ad-multi-window] .w\@mw\:100wdp{width:calc(100 * var(--wdp))}` |

### Apelidos de propriedade

| Apelido | Propriedade | Apelido | Propriedade |
|---|---|---|---|
| `p` | padding | `m` | margin |
| `pt` `pr` `pb` `pl` | padding-top / right / bottom / left | `mt` `mr` `mb` `ml` | margin-top / right / bottom / left |
| `px` `py` | padding-inline / padding-block | `mx` `my` | margin-inline / margin-block |
| `ps` `pe` | padding-inline-start / end | `ms` `me` | margin-inline-start / end |
| `w` `h` | width / height | `size` | width **e** height |
| `minw` `minh` | min-width / min-height | `maxw` `maxh` | max-width / max-height |
| `fs` | font-size | `lh` | line-height |
| `ls` | letter-spacing | `indent` | text-indent |
| `gap` | gap | `gapx` `gapy` | column-gap / row-gap |
| `r` `radius` | border-radius | `bw` `ow` | border-width / outline-width |
| `basis` | flex-basis | | |

Os apelidos são exportados como `PROPERTY_ALIASES`.

## Condições

As condições seguem `@` e espelham os qualificadores de recurso do Android e o builder `.screen()`:

| Condição | Corresponde a | Compila para |
|---|---|---|
| `@landscape` / `@portrait` | orientação | `@media (orientation: landscape)` |
| `@sw600` (ou `@sw600dp`) | menor largura ≥ 600 dp (`values-sw600dp`) | `@media (min-width: 600px) and (min-height: 600px)` |
| `@w840` | largura ≥ 840 dp | `@media (min-width: 840px)` |
| `@h480` | altura ≥ 480 dp | `@media (min-height: 480px)` |
| `@tv` (`@television`) | modo de UI TELEVISION | `:root[data-ad-mode="tv"] …` |
| `@car` `@watch` `@desk` `@appliance` `@vr` `@normal` `@undefined` | outros modos de UI | `:root[data-ad-mode="car"]` … |
| `@fold-open` `@fold-half` `@fold-closed` `@flip-open` `@flip-half` `@flip-closed` | posturas de dobráveis | `:root[data-ad-mode="fold-half"]` … |
| `@mw` (`@multi-window`) | janela dividida / flutuante (exclusivo da web) | `:root[data-ad-multi-window] …` |

As condições se combinam com `@a@b` (`p@tv@sw600:48sdp`, `gap@portrait@h700:12hdp`) e não diferenciam maiúsculas de
minúsculas. Os nomes dos modos de UI são exportados como `MODE_CONDITIONS`. Uma condição desconhecida torna a classe uma
classe que não é de dimensão (ignorada).

### Prioridade

Quando várias regras para a mesma propriedade correspondem, o resultado segue a prioridade do `.screen()` do Android,
**qualquer que seja a ordem das classes ou a ordem em que foram descobertas**:

1. Modo de UI **e** qualificador (`@tv@sw600`)
2. Modo de UI (`@tv`, `@mw`)
3. Qualificador (`@sw600`, `@w840`, `@h480`) — um limiar maior vence um menor
4. Orientação (`@landscape`)
5. Sem condição

```html
<div class="p:8sdp p@landscape:12sdp p@sw600:16sdp p@tv:24sdp p@tv@sw600:32sdp">…</div>
```

| Janela | Regras correspondentes | Padding |
|---|---|---|
| celular 360 × 740 | padrão | 8sdp = 9,6 px |
| celular 740 × 360, paisagem | padrão, `@landscape` | 12sdp = 14,4 px |
| tablet 900 × 600, paisagem | padrão, `@landscape`, `@sw600` | 16sdp = 32 px |
| TV 1920 × 1080 | todas as cinco | 32sdp = 115,2 px |
| caixa de TV 500 × 400 | padrão, `@landscape`, `@tv` | 24sdp = 32 px |

Este comportamento exato é verificado em um navegador real pelo `scripts/examples-check.mjs` em [examples/declarative.html](../../examples/declarative.html).

## Atributos `data-dimen`

Várias declarações em um único atributo, com as mesmas propriedades, apelidos e condições:

```html
<section data-dimen="padding: 8sdp 16sdp; font-size: 14ssp; padding@landscape: 12sdp 24sdp; font-size@tv: 28ssp">
```

Compilado (resumido):

```css
[data-dimen="padding: 8sdp 16sdp; font-size@landscape: 18ssp"]{padding:calc(8 * var(--sdp)) calc(16 * var(--sdp))}
@media (orientation: landscape){[data-dimen="…"]{font-size:calc(18 * var(--ssp))}}
```

Declarações sem unidade são passadas como CSS comum (`data-dimen="padding: 8sdp; color: red"`). Entrada malformada (falta de `:`,
propriedade ou condição desconhecida, valor vazio, caracteres não seguros) registra um `SyntaxError` no console e o atributo
é ignorado; o restante da página continua sendo compilado.

## Blocos `<style data-webdimens>`

Para CSS escrito na página sem uma etapa de build:

```html
<style data-webdimens>
  .card { padding: 8sdp 16sdp; font-size: 14ssp; }
  .card img { width: 48sdp; height: 48sdp; }
</style>
```

O runtime substitui cada literal no lugar (`.card{padding:calc(8 * var(--sdp)) calc(16 * var(--sdp));…}`) e recompila o
bloco se um framework o editar depois. Use regras `@media` normais para condições aqui; a sintaxe de bloco `@dimen` pertence ao
[plugin PostCSS](./css.md#plugin-postcss).

## Classes modificadoras

Classes modificadoras mudam o que os tokens sem prefixo significam **dentro de uma subárvore**, redirecionando as
propriedades personalizadas do CSS:

| Classe | Efeito dentro do elemento | Exemplo |
|---|---|---|
| `ad-a` | `sdp` se comporta como `sdpa`, `ssp` como `sspa`, … (razão de aspecto) | `<section class="ad-a">` |
| `ad-i` | ignora multi-janela (`sdp` → `sdpi`) | |
| `ad-ia` | ambos | |
| `ad-<estratégia>` | cada token sem prefixo usa essa estratégia: `ad-power`, `ad-fluid`, `ad-auto`, `ad-percent`, `ad-logarithmic`, `ad-interpolated`, `ad-diagonal`, `ad-perimeter`, `ad-fill`, `ad-fit`, `ad-density` | `<aside class="ad-power">` |

```html
<main>
  <article class="p:16sdp">escalado</article>
  <article class="p:16sdp ad-a">escalado + razão de aspecto</article>
  <aside class="ad-power">
    <div class="p:16sdp">power</div>             <!-- 16 × (sw/300)^0.75 -->
    <div class="p:16sdp ad-a">power + razão de aspecto</div>
  </aside>
</main>
```

Como funciona: `.ad-a` define `--sdp: var(--sdpa); --sdpi: var(--sdpia); …` e `.ad-power` define `--sdp: var(--pwsdp); …`, então
toda regra que lê `var(--sdp)` (classes, `data-dimen`, seu próprio CSS) acompanha. As classes se aninham e se combinam
(`class="ad-fluid ad-a"`), e também funcionam em `<html>`. Usar `ad-power` registra a estratégia power automaticamente.
Tokens explícitos sempre vencem: `p:16pwsdpa` é power + razão de aspecto em qualquer lugar.

## Atributos de `<html>`

Enquanto instalado, o runtime mantém estes atributos em `<html>` (usados pelas regras `@tv` / `@mw` e disponíveis no seu próprio CSS):

| Atributo | Valores |
|---|---|
| `data-ad-mode` | `normal`, `tv`, `car`, `watch`, `desk`, `appliance`, `vr`, `undefined`, `fold-open`, `fold-closed`, `fold-half`, `flip-open`, `flip-closed`, `flip-half` |
| `data-ad-orientation` | `portrait` / `landscape` |
| `data-ad-multi-window` | presente enquanto a janela está dividida / flutuante |

```css
:root[data-ad-mode="tv"] .menu { display: none; }
```

## O que é ignorado e segurança

- **Classes sem token de unidade** não são tocadas, então as classes de outros frameworks continuam sendo delas: `hover:bg-red-500`, `md:p-4`,
  `p:4px` são ignoradas.
- **Tokens exclusivos de JavaScript** (`2sdpPx`, `14sspLw`) não podem virar CSS. Essa classe é ignorada com um aviso único no console; nunca
  impede o restante da página de compilar.
- **Estratégias se registram sozinhas**: `p:10pwsdp` compila para `calc(10 * var(--pwsdp))` e registra a estratégia power, então
  `--pwsdp` é publicada; nada precisa ser importado.
- **Proteção contra injeção de CSS**: valores que contenham `{`, `}`, `;`, `<`, `/*` ou uma barra invertida capaz de escapar da regra são rejeitados
  (`p:16sdp)}body{background:red` é ignorado). Escapes comuns, como `content: "\201C"`, continuam permitidos em `data-dimen`.
- Texto dentro de `url(...)` e de strings entre aspas nunca é reescrito.

## API e opções

| | |
|---|---|
| `install({ declarative: false })` | mantém as variáveis CSS e o JS, e ignora o compilador de classes / atributos |
| `flushDeclarative()` | compila imediatamente o que foi adicionado desde o último frame (testes, ou antes de ler o layout) |
| `dimenClassesToCss(classes, attributeValues?)` | compila para uma string CSS sem DOM (SSR, ferramentas de build) — veja [SSR](./ssr.md) |
| `compileDimenClass(name)` / `compileDimenAttribute(text)` | compila uma classe / um atributo (retorna regras `{ css, order }`) |
| `compileCssText(text)` | compila um texto de folha de estilo (o que `<style data-webdimens>` usa) |
| `modifierCss(strategies)` | o CSS das classes modificadoras |

```js
import { dimenClassesToCss } from 'webdimens';
dimenClassesToCss(['p:16sdp', 'fs@tv:28ssp']);
// .p\:16sdp{padding:calc(16 * var(--sdp))}
// :root[data-ad-mode="tv"] .fs\@tv\:28ssp{font-size:calc(28 * var(--ssp))}
```

## Desempenho

- Cada string de classe ou atributo distinta é compilada **uma vez**; um `MutationObserver` captura novos nós e mudanças de classe
  (agrupados por frame de animação). Mudanças de atributo reverificam apenas o elemento alterado, nunca a sua subárvore.
- Redimensionar a janela reescreve apenas as propriedades personalizadas do CSS; as regras compiladas nunca mudam, então não há
  JavaScript por redimensionamento para elas.
- Medido no Chromium: `install()` em uma página com 10.000 elementos com classes de dimensão leva cerca de 26 ms; 1.000 alternâncias
  de classe cerca de 3 ms; 1.000 novos nós cerca de 5 ms. Veja [Desempenho](./performance.md).

Próximo: [CSS, Sass e PostCSS](./css.md) · [Voltar ao índice](./README.md)
