# Runtime

O runtime é o equivalente web do `DimenCache` do Android: ele mede a viewport em um snapshot imutável, mantém uma tabela de
fatores pré-calculada por estratégia, publica as propriedades customizadas CSS e notifica os assinantes. Esta página cobre suas
opções, eventos, snapshots, detecção de modo de UI e de multijanela, CSP, escopos por elemento e registro de estratégias.

## install(), configure(), uninstall()

```js
import { install, configure, uninstall, UiModeType } from 'webdimens';

install();                                   // rastreamento + variáveis CSS + compilador declarativo
configure({ fontScale: 1.2 });               // altera as opções depois; chaves não especificadas mantêm o valor
uninstall();                                 // para o rastreamento, remove o CSS gerado e os atributos do <html>
```

| Opção | Tipo | Padrão | Efeito |
|---|---|---|---|
| `cssVariables` | `boolean` | `true` após `install()` | publica `--sdp`, `--ssp`, … em `:root` |
| `declarative` *(apenas install)* | `boolean` | `true` | compila classes, `data-dimen`, `<style data-webdimens>`, classes de modificador |
| `strategies` *(apenas install)* | `string[]` ou `'all'` | `[]` | registra estratégias cujas variáveis são usadas por CSS que o runtime nunca analisa (`var(--fsdp)` escrito à mão, saída do PostCSS); lança `RangeError` para um id desconhecido |
| `cssNonce` | `string` | — | nonce para o elemento `<style>` de fallback sob uma CSP estrita |
| `uiModeType` | `UiModeType` ou `(size) => UiModeType` | detectado | força o modo de UI (quiosque, app de TV) |
| `fontScale` | `number` | medido | força a escala de fonte |
| `multiWindow` | `boolean` ou `(size) => boolean` | detectado | força o estado de multijanela |
| `measure` | `() => ({ width, height })` | `innerWidth` × altura da viewport de layout | mede outra coisa como "a janela" |

`install()` é idempotente: chamadas posteriores atualizam as opções. Os pacotes de CDN chamam-no ao carregar (para desativar, use
`<script … data-no-install>`). Acessores como `sdp()` funcionam sem `install()`; eles começam a rastrear a viewport de forma preguiçosa.

```js
// Um app de TV que sempre renderiza a UI de 10 pés, com medição personalizada:
install({
  uiModeType: UiModeType.TELEVISION,
  measure: () => ({ width: document.documentElement.clientWidth, height: window.innerHeight }),
});

// Funções resolvedoras são reavaliadas a cada snapshot:
configure({ uiModeType: ({ width }) => (width >= 1280 ? UiModeType.TELEVISION : UiModeType.NORMAL) });
```

## Eventos e ciclo de atualização

O runtime escuta `resize`, `orientationchange`, `pageshow`, uma media query `(resolution: Ndppx)` (zoom da página / mover a
janela para outro monitor) e o evento `change` do Device Posture. Um listener apenas **marca o snapshot como sujo**:

1. A próxima leitura (`sdp()`, `getMetrics()`, …) reconstrói o snapshot de forma síncrona, então um valor lido logo após um
   redimensionamento nunca fica desatualizado.
2. No próximo frame de animação, o runtime escreve as propriedades customizadas CSS (se mudaram) e chama os assinantes, no máximo
   uma vez por frame, não importa quantos eventos tenham disparado.

A altura vem da viewport de layout, então as barras de URL do celular que aparecem ou somem durante a rolagem não alteram `hdp`.

## Snapshots

```js
import { getMetrics, getVersion, subscribe, refresh, flush, setMetrics, DimenMetrics } from 'webdimens';

const m = getMetrics();          // DimenMetrics imutável para a janela atual
getVersion();                    // incrementa sempre que o snapshot realmente muda

const off = subscribe((m) => {   // no máximo uma vez por frame
  console.log(m.screenWidthDp, m.orientation, m.uiModeType);
});
off();

refresh();                       // medir de novo (também a escala de fonte), por exemplo após uma mudança de configurações
flush();                         // aplica uma mudança pendente agora (CSS + assinantes), útil em testes

setMetrics({ screenWidthDp: 412, screenHeightDp: 915, density: 2.625 });   // fixa valores (SSR, testes, prévias)
setMetrics(new DimenMetrics({ screenWidthDp: 1920, screenHeightDp: 1080 }));
setMetrics(null);                // volta para a viewport ao vivo
```

Os campos de `DimenMetrics` estão listados em [Conceitos](./concepts.md#o-snapshot-da-viewport). Entradas inválidas são
sanitizadas (tamanhos negativos ou `NaN` viram 0; densidade e escala de fonte voltam para 1). `m.equals(other)` compara as
entradas brutas.

## Detecção de modo de UI

`detectUiModeType()` é uma heurística, aplicada a menos que você force `uiModeType`:

| Sinal | Resultado |
|---|---|
| user agent menciona SmartTV, Tizen TV, webOS, HbbTV, Apple TV, Google TV, Android TV, BRAVIA, NetCast, Roku, Chromecast, Fire TV | `TELEVISION` |
| navegadores Oculus / Pico / Quest | `VR_HEADSET` |
| "Watch" / Wear OS | `WATCH` |
| Android Automotive | `CAR` |
| a Viewport Segments API informa dois segmentos | `FOLD_OPEN` / `FOLD_HALF_OPENED` (lado a lado) ou `FLIP_OPEN` / `FLIP_HALF_OPENED` (empilhados), meio aberto quando o Device Posture informa `folded` |
| caso contrário | `NORMAL` |

Os navegadores expõem pouco sobre o dispositivo, então force o modo sempre que souber qual é (apps de TV, quiosques, painéis de carro).
O modo atual também fica em `<html data-ad-mode="…">`.

## Detecção de multijanela

O Android sabe quando um app está em tela dividida; os navegadores não. A heurística espelha o fallback do Android: a janela é
considerada multijanela quando tem pelo menos 10 % a menos de largura que a tela (`screen.availWidth − outerWidth ≥ 10 %`). Os dois
valores ignoram o zoom da página no Chromium. Ela controla as variantes `i`, a classe `ad-i` e a condição `@mw`. Force-a com
`configure({ multiWindow: false })` se uma janela de desktop que não está maximizada ainda deve escalar normalmente.

## Escala de fonte

A escala de fonte é o tamanho de fonte padrão do navegador dividido por 16, medido uma vez com um elemento oculto de
`font-size: medium` (assim, uma regra do site como `html { font-size: 62.5% }` não afeta o resultado). Os usuários mudam isso nas
configurações do navegador; chame `refresh()` para medir de novo, ou force com `configure({ fontScale })`.

## CSP e onde fica o CSS

As variáveis CSS e as regras compiladas são escritas em **folhas de estilo construíveis** (`document.adoptedStyleSheets`), que uma
Content Security Policy não bloqueia. Onde elas não estão disponíveis, o runtime usa como fallback os elementos
`<style id="webdimens-vars">` e `<style id="webdimens-declarative">`; passe `cssNonce` se a sua CSP exigir nonce para eles. As variáveis
usam o seletor `:root:root`, então sobrescrevem o arquivo de fallback em CSS puro.

## Escopos por elemento

`createDimenScope(element)` trata a área de conteúdo de um elemento como a "janela" — a versão web dos snapshots por janela do
Android. As variáveis CSS são escritas no elemento, então todo `var(--sdp)` dentro dele segue o elemento em vez da viewport.

```html
<div id="panel" style="resize: both; overflow: auto; width: 300px; height: 260px">
  <div class="card" style="padding: calc(16 * var(--sdp))">Com escopo</div>
</div>
<script type="module">
  import { createDimenScope } from 'webdimens';

  const scope = createDimenScope(document.getElementById('panel'), {
    onChange: (m) => console.log('panel sw', m.smallestWidthDp),   // também dispara uma vez durante a criação
  });
  scope.metrics;            // DimenMetrics do painel
  scope.dp(16);             // 16 × panelSw / 300
  scope.sp(14);             // × escala de fonte
  scope.update();           // medir de novo agora
  scope.disconnect();       // para de observar, remove as variáveis do elemento
</script>
```

| Opção | Padrão | |
|---|---|---|
| `strategies` | toda estratégia registrada | quais variáveis de estratégias são escritas no elemento |
| `cssVariables` | `true` | escreve as variáveis no elemento |
| `onChange(metrics)` | — | chamado quando o snapshot do elemento muda (e uma vez na criação) |

O escopo usa um `ResizeObserver`; densidade, escala de fonte, modo de UI e multijanela vêm do snapshot global. Escopos são
ideais para widgets, painéis redimensionáveis, prévias de um layout de celular dentro de uma página de desktop e
micro-frontends. Uma demonstração executável está em [examples/scope.html](../../examples/scope.html); o React tem `useDimenScope(ref)`.

## Estratégias e registro

O runtime mantém uma tabela de fatores apenas para as estratégias **registradas**. A escalonada é registrada por `install()`. As
demais estratégias se registram no primeiro uso (um token ou função JS, uma classe, `data-dimen`, `ad-<id>`), via
`install({ strategies })` ou com `register(DEF)`:

```js
import { register, registeredStrategies } from 'webdimens';
import { FLUID } from 'webdimens/fluid';

register(FLUID);              // idempotente; retorna a tabela de fatores Float64Array em uso
registeredStrategies();       // [SCALED, FLUID, …]
```

`cssDeclarations(metrics, strategies?)` retorna as declarações que o runtime escreveria para um snapshot
(`'--ad-w:600px;…;--sdp:2px;…'`), o que é útil para pré-renderizar as variáveis no servidor ([SSR](./ssr.md)).
`readEnvironment()` retorna as entradas brutas que o runtime mediria agora.

Próximo: [Resize](./resize.md) · [Voltar ao índice](./README.md)
