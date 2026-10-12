# SSR e primeiro paint

Como renderizar páginas no servidor (Next.js, Nuxt, SvelteKit, Angular SSR, Astro, Node puro) sem saltos de layout nem
divergências de hidratação. A versão curta: **renderize CSS, não números.** Classes, `data-dimen`, `dimens()` e variáveis CSS
produzem o mesmo markup no servidor e no navegador; só os valores das variáveis diferem, e esses são aplicados pelo navegador.

## O que acontece no servidor

Não existe `window`, então o snapshot é a referência de **300 × 533** (`sdp(16)` = 16), a menos que você fixe outra. Chamar
`install()` no servidor é seguro: ele registra a estratégia escalada e não faz mais nada.

```js
import { install, sdp, getMetrics, setMetrics } from 'webdimens';

install();                 // no-op no Node, além do registro
sdp(16);                   // 16 — a referência 300 × 533
getMetrics();              // 300 × 533

setMetrics({ screenWidthDp: 412, screenHeightDp: 915 });   // quando você conhece a viewport (client hints, classe do dispositivo)
sdp(16);                   // 21.97
```

## Escolhas seguras para hidratação

| Técnica | Saída no servidor | Seguro? |
|---|---|---|
| Classes de dimensão (`class="p:16sdp"`) | o nome da classe | sim — compiladas no navegador; pré-compile para o primeiro paint (abaixo) |
| `data-dimen="…"` | o atributo | sim — igual às classes |
| `style={dimens({ padding: '16sdp' })}` | `calc(16 * var(--sdp))` | sim — string idêntica dos dois lados |
| `calc(16 * var(--sdp))` em CSS, saída do PostCSS | CSS | sim |
| `sdp(16)`, `dimen('16sdp')`, `dimensPx()` no render | um número | **não** — 16 no servidor, o valor real no navegador |

Para números JavaScript, renderize-os depois da montagem (`useEffect` / `onMount` / `afterNextRender`), ou use os bindings
do framework, que usam o snapshot do servidor no primeiro render (`useDimens()` usa `useSyncExternalStore` com um snapshot de servidor).

## Primeiro paint sem flash

Até o runtime iniciar, `var(--sdp)` e as regras de classe não existem. Duas coisas fazem o primeiro paint sair correto:

1. **Carregue o fallback só em CSS** (`webdimens/css`, ou `css/all.css` para todas as estratégias). Ele define as variáveis com
   unidades de viewport, exato para as estratégias lineares, então `calc(16 * var(--sdp))`, `dimens()` e a saída do PostCSS
   ficam corretos antes de qualquer script rodar. Veja [CSS](./css.md#fallback-só-em-css-sem-javascript-primeira-pintura).
2. **Pré-compile as classes de dimensão** para que suas regras estejam no HTML do servidor.

### Pré-compilando classes no build

```js
// scripts/dimen-classes.mjs — coleta as classes de dimensão dos fontes e grava um único arquivo CSS
import { readFileSync, writeFileSync } from 'node:fs';
import { globSync } from 'node:fs';                 // Node 22+; ou use o pacote `glob`
import { dimenClassesToCss } from 'webdimens';

const classes = new Set();
const attributes = new Set();
for (const file of globSync('src/**/*.{html,jsx,tsx,vue,svelte}')) {
  const text = readFileSync(file, 'utf8');
  for (const m of text.matchAll(/class(?:Name)?="([^"]+)"/g)) m[1].split(/\s+/).forEach((c) => classes.add(c));
  for (const m of text.matchAll(/data-dimen="([^"]+)"/g)) attributes.add(m[1]);
}
writeFileSync('src/styles/dimen-classes.css', dimenClassesToCss(classes, attributes));
```

`dimenClassesToCss()` ignora toda classe que não seja uma classe de dimensão, então você pode passar todos os nomes de classe.
Importe o arquivo gerado ao lado de `webdimens/css`. O runtime ainda compila classes adicionadas em tempo de execução (as regras
são idênticas, então uma duplicata é inofensiva).

```js
dimenClassesToCss(['p:16sdp', 'fs@tv:28ssp', 'flex', 'hover:underline']);
// .p\:16sdp{padding:calc(16 * var(--sdp))}
// :root[data-ad-mode="tv"] .fs\@tv\:28ssp{font-size:calc(28 * var(--ssp))}
```

## Valores exatos no servidor (opcional)

Quando o servidor conhece a viewport — client hints `Sec-CH-Viewport-Width` / `Sec-CH-Viewport-Height`, um app shell por classe
de dispositivo ou o cookie de uma visita anterior — insira as variáveis exatas inline:

```js
import { cssDeclarations, DimenMetrics } from 'webdimens';

const metrics = new DimenMetrics({ screenWidthDp: 412, screenHeightDp: 915 });
const style = `<style>:root{${cssDeclarations(metrics)}}</style>`;
// :root{--ad-w:412px;--ad-h:915px;--ad-sw:412px;…;--sdp:1.3733px;…}
```

Fixe o mesmo snapshot com `setMetrics(metrics)` para o render, se você também usar números JavaScript, e redefina-o a cada
requisição (o snapshot é estado do módulo). O runtime do navegador assume depois da hidratação, com as medições reais.

## Checklist

- [ ] `webdimens/css` (ou `css/all.css`) carregado antes do conteúdo
- [ ] Classes de dimensão pré-compiladas, ou apenas formas em CSS usadas para o conteúdo acima da dobra
- [ ] Nenhum número de `sdp()` / `dimen()` em markup renderizado no servidor (ou renderizado após a montagem)
- [ ] `install()` chamado em um lugar exclusivo do navegador (`useWebDimens()`, um plugin `.client`, `onMount`, `provideWebDimens()`)
- [ ] Estratégias usadas apenas em CSS listadas em `install({ strategies: [...] })`

Próximo: [Runtime](./runtime.md) · [Voltar ao índice](./README.md)
