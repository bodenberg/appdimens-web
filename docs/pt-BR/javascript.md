# API JavaScript

O lado JavaScript espelha as extensões de `Number` do Android como funções (`sdp(16)` para `16.sdp`) e acrescenta auxiliares
de string para que você escreva unidades em vez de px (`dimen('16sdp')`, `dimens({ padding: '8sdp 16sdp' })`). Todos os
exemplos usam uma janela fixa de 600 × 900, com devicePixelRatio 2 e escala de fonte 1.25, para que os números sejam
reproduzíveis:

```js
import { setMetrics } from 'webdimens';
setMetrics({ screenWidthDp: 600, screenHeightDp: 900, density: 2, fontScale: 1.25 });
```

## Acessores

Cada módulo de estratégia exporta 264 funções nomeadas após as propriedades do Android. Elas recebem um valor em dp e
retornam px CSS (ou pixels do dispositivo, para nomes com `Px`):

```js
import { sdp, hdp, wdp, ssp, sem, sdpa, sdpPx, sspPx, sdpPh, hdpLw } from 'webdimens';

sdp(16);    // 32       16 × 600/300
hdp(16);    // 48       eixo de altura
wdp(16);    // 32       eixo de largura
ssp(16);    // 40       × escala de fonte 1.25
sem(16);    // 32       texto sem escala de fonte
sdpa(16);   // 29.81    variante de proporção
sdpPx(16);  // 64       pixels do dispositivo (× DPR 2)
sspPx(16);  // 80
sdpPh(16);  // 48       retrato → altura
hdpLw(16);  // 48       paisagem → largura (retrato aqui: altura)
```

O conjunto completo por estratégia é: `<prefixo><s|h|w><dp|sp|em><inversor?><a|i|ia?><Px?>` (veja [Conceitos](./concepts.md#gramática-dos-tokens)).
As demais estratégias vêm dos seus módulos:

```js
import { pwsdp, pwhspa } from 'webdimens/power';
import { fsdp } from 'webdimens/fluid';

pwsdp(16);  // 26.91    16 × (600/300)^0.75
```

As funções leem uma tabela pré-calculada: um desvio e uma multiplicação, cerca de 9 ns por chamada
(veja [Desempenho](./performance.md)). Em um framework, renderize de novo quando a janela mudar (`useDimens()`, `useDimen()`, … em
[Frameworks](./frameworks.md)) ou prefira CSS para o layout.

## Unidades como strings

```js
import { dimen, dimenCss, dimens, dimensPx, parseToken, parseDimenLiteral, cssDimen } from 'webdimens';

dimen('16sdp');      // 32      qualquer token: '14sspa', '8hdpLw', '10pwsdp'
dimen('14ssp');      // 35
dimen('2sdpPx');     // 8       pixels do dispositivo
dimen(12);           // 12      números passam direto
dimen('12px');       // 12      px também
dimen('12vh');       // TypeError: cannot resolve "12vh"

dimenCss('8sdp 16sdp');          // 'calc(8 * var(--sdp)) calc(16 * var(--sdp))'
dimenCss('max(16sdp, 10px)');    // 'max(calc(16 * var(--sdp)), 10px)'
cssDimen('sdpa', 16);            // 'calc(16 * var(--sdpa))'
```

### Objetos de estilo

`dimens()` compila cada valor string para CSS responsivo (sem necessidade de re-renderizar, compatível com SSR). `dimensPx()`
resolve para px da janela atual (re-renderize quando ela mudar):

```js
dimens({ padding: '8sdp 16sdp', fontSize: '14ssp', opacity: 0.5 });
// { padding: 'calc(8 * var(--sdp)) calc(16 * var(--sdp))', fontSize: 'calc(14 * var(--ssp))', opacity: 0.5 }

dimensPx({ padding: '8sdp 16sdp', width: '120wdp' });
// { padding: '16px 32px', width: 240 }
```

```jsx
<div style={dimens({ padding: '16sdp', borderRadius: '12sdp' })} />
```

```js
Object.assign(element.style, dimens({ padding: '8sdp 16sdp', fontSize: '14ssp' }));
```

### Análise

```js
parseDimenLiteral('-8sdp');   // { value: -8, token: { name: 'sdp', … } }
parseToken('pwhdpLwa');
// { name: 'pwhdpLwa', prefix: 'pw', strategy: 'power', axis: 'h', kind: 'dp',
//   inverter: 'Lw', flags: 'a', px: false, slot: 29, css: true }
```

Qualquer estratégia funciona sem importar o seu módulo: `dimen('10logsdp')` registra a estratégia logarítmica no primeiro uso.
Os erros são explícitos: `dimenCss('2sdpPx')` lança exceção porque tokens `Px` existem apenas em JavaScript.

## Resolvedores genéricos

`toDynamic<Strategy>Dp / Px / Sp / SpPx(value, qualifier?, options?)` alcança todas as combinações, inclusive uma
sensibilidade de proporção personalizada:

```js
import { toDynamicScaledDp, toDynamicScaledSp, DpQualifier, Inverter } from 'webdimens';

toDynamicScaledDp(10, DpQualifier.HEIGHT, { applyAspectRatio: true });                 // 27.26
toDynamicScaledDp(10, DpQualifier.SMALL_WIDTH, { applyAspectRatio: true, customSensitivityK: 0.01 }); // 14.87
toDynamicScaledDp(10, DpQualifier.WIDTH, { inverter: Inverter.PW_TO_LH });             // = wdpLh(10)
toDynamicScaledSp(10);                                                                 // 25
toDynamicScaledSp(10, DpQualifier.SMALL_WIDTH, { fontScale: false });                  // 20
```

| Opção | Padrão | Significado |
|---|---|---|
| `inverter` | `Inverter.DEFAULT` | troca do eixo de orientação |
| `ignoreMultiWindows` | `false` | valor sem escala em uma divisão / janela flutuante |
| `applyAspectRatio` | `false` | correção pela proporção |
| `customSensitivityK` | `null` (= 0.08 / 30) | sensibilidade da correção; precisa ser finita (senão `RangeError`) |
| `fontScale` | `true` | apenas resolvedores `Sp`: multiplica pela escala de fonte |

Outras estratégias: `toDynamicPowerDp`, `toDynamicFluidPx`, … (`toDynamic` + nome da estratégia).

## Facilitadores

Escolha um valor alternativo conforme a orientação, o modo de UI ou um limite em dp, como os facilitadores do Android. Cada um
existe para `sdp`/`hdp`/`wdp` e `ssp`/`hsp`/`wsp`, com a variante `Px`, em todas as estratégias (`pwsdpRotate`, …).

```js
import { sdpRotate, sdpMode, sdpQualifier, sdpScreen, DpQualifier, Orientation, UiModeType } from 'webdimens';

// sdpRotate(value, rotationValue, orientation = LANDSCAPE, options?)
sdpRotate(10, 30);                         // 20  (janela em retrato → value)
sdpRotate(10, 30, Orientation.PORTRAIT);   // 60  (retrato corresponde → rotationValue)

// sdpMode(value, modeValue, uiModeType, options?)
sdpMode(10, 40, UiModeType.TELEVISION);    // 20 aqui; 144 em uma TV 1920 × 1080

// sdpQualifier(value, qualifiedValue, qualifierType, qualifierValue, options?)
sdpQualifier(10, 20, DpQualifier.SMALL_WIDTH, 600);   // 40  (sw 600 ≥ 600)
sdpQualifier(10, 20, DpQualifier.SMALL_WIDTH, 601);   // 20

// sdpScreen(value, screenValue, uiModeType, qualifierType, qualifierValue, options?)
sdpScreen(10, 30, UiModeType.TELEVISION, DpQualifier.SMALL_WIDTH, 1000); // 108 em uma TV 1920 × 1080
```

O valor alternativo é escalado no eixo da própria função, a menos que `options.finalQualifierResolver` indique outra coisa:

```js
sdpRotate(10, 30, Orientation.LANDSCAPE, { finalQualifierResolver: DpQualifier.WIDTH }); // em 900 × 600: 30 × 900/300 = 90
```

As opções também aceitam `ignoreMultiWindows`, `applyAspectRatio`, `customSensitivityK` e (para `sp`) `fontScale`.

### Ramificações simples

Quando os dois valores já são finais, ramifique sem escalar:

```js
import { plainRotate, plainMode, plainQualifier, plainScreen } from 'webdimens';

plainRotate('1fr', '1fr 1fr');                       // duas colunas em paisagem
plainQualifier('a', 'b', DpQualifier.WIDTH, 600);    // 'b' em 600 × 900
plainMode(menuCompact, menuTv, UiModeType.TELEVISION);
```

## Builders

`scaledDp(value)` (e `scaledSp`) espelham `16.scaledDp()` do Android: são imutáveis, e as regras `.screen()` são resolvidas por
prioridade.

```js
import { scaledDp, UiModeType, DpQualifier, Orientation } from 'webdimens';

const gutter = scaledDp(16)
  .screen(UiModeType.TELEVISION, 40)            // prioridade 2: modo de UI
  .screen(DpQualifier.SMALL_WIDTH, 600, 24)     // prioridade 3: qualificador
  .screen(Orientation.LANDSCAPE, 20);           // prioridade 4: orientação

gutter.sdp;
// celular 360 × 740  → 19.2   (16 × 1.2, nenhuma regra corresponde)
// 1000 × 500         → 33.33  (paisagem: 20 × 500/300)
// 600 × 900          → 48     (sw600: 24 × 2)
// TV 1920 × 1080     → 144    (TV: 40 × 3.6)
```

| Sobrecarga de `.screen(…)` | Prioridade |
|---|---|
| `(uiModeType, qualifierType, qualifierValue, value, finalQualifierResolver?, inverter?, orientation?)` | 1 |
| `(uiModeType, value, finalQualifierResolver?, inverter?, orientation?)` | 2 |
| `(qualifierType, qualifierValue, value, finalQualifierResolver?, inverter?, orientation?)` | 3 (limite maior primeiro) |
| `(orientation, value, finalQualifierResolver?, inverter?)` | 4 |
| `({ uiModeType?, qualifier?: [type, value] ou { type, value }, orientation?, value, finalQualifierResolver?, inverter? })` | derivada dos campos |

Outros métodos: `.aspectRatio(apply = true, k?)`, `.applyAspectRatio(apply)`, `.ignoreMultiWindows(ignore = true)`.
Terminais: `.sdp .hdp .wdp .ssp .hsp .wsp .sem .hem .wem`, cada um com uma variante `Px` (`.sdpPx` …), `.dp(q)`, `.px(q)`,
`.sp(q, fontScale)`, `.spPx(q, fontScale)` e `.all()` → `{ sdp, hdp, wdp }`. Os resultados são memorizados por snapshot, então
ler `.sdp` em um loop de renderização custa cerca de 18 ns.

Os builders de estratégia têm terminais prefixados: `powerDp(16).pwsdp` (26.91 em 600 × 900), `fluidSp(14).fssp`, …
Entradas inválidas lançam exceção: `.screen('NOPE', 2)` e valores não finitos geram `TypeError`.

## Enumerações

| Enumeração | Valores |
|---|---|
| `DpQualifier` | `SMALL_WIDTH`, `HEIGHT`, `WIDTH` |
| `Orientation` | `PORTRAIT`, `LANDSCAPE`, `DEFAULT` |
| `Inverter` | `PH_TO_LW`, `PW_TO_LH`, `LH_TO_PW`, `LW_TO_PH`, `SW_TO_LH`, `SW_TO_LW`, `SW_TO_PH`, `SW_TO_PW`, `DEFAULT` |
| `UiModeType` | `NORMAL`, `TELEVISION`, `CAR`, `WATCH`, `DESK`, `APPLIANCE`, `VR_HEADSET`, `UNDEFINED`, `FOLD_OPEN`, `FOLD_CLOSED`, `FLIP_OPEN`, `FLIP_CLOSED`, `FOLD_HALF_OPENED`, `FLIP_HALF_OPENED` |
| `UnitType` | `INCH`, `CM`, `MM`, `SP`, `DP`, `PX` |
| `AutoResizePercentBasis` | `HEIGHT`, `WIDTH`, `MIN_SIDE` |

Elas são mapas de strings congelados, então as strings literais também funcionam: `sdpMode(10, 40, 'TELEVISION')`.

## Canvas: pixels do dispositivo

```js
import { hdp, sdpPx, sspPx, subscribe } from 'webdimens';

function draw(canvas) {
  const cssHeight = hdp(220);                      // layout: px CSS
  canvas.style.height = `${cssHeight}px`;
  canvas.width = canvas.clientWidth * devicePixelRatio;
  canvas.height = cssHeight * devicePixelRatio;
  const ctx = canvas.getContext('2d');
  ctx.lineWidth = sdpPx(2);                        // desenho: pixels do dispositivo
  ctx.font = `${sspPx(12)}px system-ui`;
  // …
}
subscribe(() => draw(canvas));                     // redesenha quando a janela muda
```

Um gráfico completo está em [examples/canvas.html](../../examples/canvas.html).

Próximo: [Estratégias](./strategies.md) · [Voltar ao índice](./README.md)
