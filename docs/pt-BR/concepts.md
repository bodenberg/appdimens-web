# Conceitos

Esta página explica o modelo por trás de cada valor do webdimens: a referência de 300 dp, como `dp` / `sp` / `px` do Android
se mapeiam para CSS, o snapshot da viewport, eixos, flags, inversores, a gramática dos tokens e por que cada chamada custa
uma multiplicação. Leia antes de escrever muitas unidades; as outras páginas pressupõem este conteúdo.

## A referência de 300 dp

Um design é escrito em **dp** para uma janela de referência cuja menor largura é **300 dp** (altura de 533 dp). Em tempo de
execução, cada valor é multiplicado por um fator que depende da janela atual:

```
sdp(16) = 16 × smallestWidth / 300
```

| Janela (px CSS) | menor largura | `sdp(16)` |
|---|---:|---:|
| 300 × 533 (referência) | 300 | 16 |
| 360 × 740 (celular) | 360 | 19.2 |
| 600 × 900 (tablet pequeno) | 600 | 32 |
| 1920 × 1080 (TV) | 1080 | 57.6 |

Este é o `16.sdp` do AppDimens Dynamic para Android, com as mesmas constantes (`BASE_WIDTH_DP = 300`, `BASE_HEIGHT_DP = 533`,
`REFERENCE_ASPECT_RATIO = 1.78`).

## dp, sp e px na web

| Android | Web | Exemplo em 600 × 900, DPR 2, escala de fonte 1,25 |
|---|---|---|
| `dp` | px CSS (1 px CSS é o pixel independente de densidade da web) | `sdp(16)` → **32** |
| `sp` | px CSS × escala de fonte | `ssp(16)` → 32 × 1,25 = **40** |
| família `em` (`sem` no Android: sp sem escala de fonte) | px CSS | `sem(16)` → **32** |
| `px` (o sufixo `Px`) | px do dispositivo = px CSS × `devicePixelRatio` | `sdpPx(16)` → 32 × 2 = **64**, `sspPx(16)` → **80** |

- **Escala de fonte** é o tamanho de fonte padrão do navegador ÷ 16 (a configuração de acessibilidade que o usuário altera),
  medida uma vez com uma sonda oculta de `font-size: medium`. Sobrescreva com `install({ fontScale })`; chame `refresh()` para
  medir novamente.
- Use valores `Px` apenas para canvas, WebGL ou outras APIs de pixel do dispositivo. O layout sempre usa px CSS.

## O snapshot da viewport

Cada valor é calculado a partir de um snapshot imutável `DimenMetrics`, o equivalente web do `DimenMetrics` por janela do Android.

| Campo | Origem na web |
|---|---|
| `screenWidthDp` | `window.innerWidth` (mesma base que `vw`) |
| `screenHeightDp` | altura da viewport de layout (`document.documentElement.clientHeight` no modo standards): não muda quando as barras de URL do celular aparecem ou somem |
| `smallestScreenWidthDp` / `smallestWidthDp` | `min(width, height)` |
| `density` | `window.devicePixelRatio` |
| `fontScale` | tamanho de fonte padrão do navegador ÷ 16 |
| `orientation`, `isLandscape`, `isPortrait` | `LANDSCAPE` quando a largura é maior que a altura, senão `PORTRAIT` (a feature de mídia CSS `orientation`) |
| `uiModeType` | heurísticas de user-agent e Device Posture / Viewport Segments, ou `install({ uiModeType })` |
| `isInMultiWindowMode` | a janela tem pelo menos 10 % a menos de largura que a tela (`screen.availWidth` vs `outerWidth`), ou `install({ multiWindow })` |

Os fatores derivados são calculados uma vez por snapshot: `scale` (`sw / 300`), `screenWidthFactor`, `screenHeightFactor`,
`normalizedAspectRatio` (`(max / min) / 1.78`), `logNormalizedAspectRatio`, `defaultAspectRatioMultiplier`,
`defaultScaledAspectRatioMultiplier`, `powerScale`, `interpolatedScale`, `diagonalScale`, `perimeterScale`, `logarithmicScale`.

```js
import { getMetrics, setMetrics } from 'webdimens';

setMetrics({ screenWidthDp: 600, screenHeightDp: 900, density: 2, fontScale: 1.25 });
const m = getMetrics();
m.smallestWidthDp;          // 600
m.scale;                    // 2
m.orientation;              // 'PORTRAIT'
m.normalizedAspectRatio;    // 0.8427  (1.5 / 1.78)
setMetrics(null);           // de volta à viewport ao vivo
```

No servidor (sem `window`), o snapshot é a referência de 300 × 533, a menos que você fixe outro com `setMetrics()`; veja [SSR](./ssr.md).

## Eixos

| Letra do eixo | Qualificador | Lê | Uso típico |
|---|---|---|---|
| `s` (`sdp`, `ssp`) | `DpQualifier.SMALL_WIDTH` | `min(width, height)` | espaçamento, raios, ícones, a maior parte do texto |
| `h` (`hdp`, `hsp`) | `DpQualifier.HEIGHT` | altura | ritmo vertical, alturas de linha |
| `w` (`wdp`, `wsp`) | `DpQualifier.WIDTH` | largura | colunas guiadas pela largura |

Em 600 × 900: `sdp(16)` = 32, `hdp(16)` = 48, `wdp(16)` = 32.

## Flags

| Sufixo | Significado | Em 600 × 900 |
|---|---|---|
| *(nenhum)* | escala simples | `sdp(16)` = 32 |
| `a` | correção de razão de aspecto | `sdpa(16)` = 29.81 |
| `i` | ignora multi-janela: retorna o valor sem escala enquanto a janela está dividida / flutuante | `sdpi(16)` = 32 (ou 16 em multi-janela) |
| `ia` | ambos | |

As variantes `a` das estratégias escaladas e de percentual usam `1 + (d − 300) × (1/300 + k × ln(AR / 1.78))`, que altera
de forma perceptível os valores em janelas muito largas ou muito altas. As demais estratégias multiplicam seu fator por
`1 + k × ln(AR / 1.78)` com `k = 0.08 / 30`, uma correção pequena. Um `k` personalizado está disponível por
`toDynamic…({ customSensitivityK })` e pelos builders.

## Inversores de orientação

Um inversor troca o eixo em uma orientação. Eles aparecem nos nomes entre o eixo e as flags (`sdpPh`, `hdpLwa`).

| Token | Inversor | Regra | 600 × 900 (retrato) | 900 × 600 (paisagem) |
|---|---|---|---:|---:|
| `sdpPh` | `SW_TO_PH` | menor largura → **altura** em **retrato** | `sdpPh(16)` = 48 | 32 |
| `sdpLh` | `SW_TO_LH` | menor largura → altura em paisagem | 32 | 32 (altura = sw) |
| `sdpPw` | `SW_TO_PW` | menor largura → largura em retrato | 32 (largura = sw) | 32 |
| `sdpLw` | `SW_TO_LW` | menor largura → largura em paisagem | 32 | 48 |
| `hdpLw` | `PH_TO_LW` | altura → largura em paisagem | 48 | 48 |
| `hdpPw` | `LH_TO_PW` | altura → largura em retrato | 32 | 32 |
| `wdpLh` | `PW_TO_LH` | largura → altura em paisagem | 32 | 32 |
| `wdpPh` | `LW_TO_PH` | largura → altura em retrato | 48 | 48 |

Use-os quando um tamanho precisar acompanhar o lado *longo* ou o lado *curto* conforme o dispositivo gira.

## Gramática dos tokens

Todo nome, em JavaScript, classes e variáveis CSS, segue os nomes do Android:

```
<prefixo><eixo><tipo><inversor>?<flags>?<Px>?
```

| Parte | Valores |
|---|---|
| prefixo (estratégia) | `''` escalada · `p` percentual · `pw` power · `f` fluid · `a` auto · `dg` diagonal · `fl` fill · `ft` fit · `i` interpolated · `log` logarithmic · `pr` perimeter · `d` density |
| eixo | `s` · `h` · `w` |
| tipo | `dp` (layout) · `sp` (texto × escala de fonte) · `em` (texto, sem escala de fonte) |
| inversor | `s`: `Ph` `Lh` `Pw` `Lw` · `h`: `Lw` `Pw` · `w`: `Lh` `Ph` |
| flags | `a` · `i` · `ia` |
| `Px` | pixels do dispositivo (apenas JavaScript) |

Exemplos: `sdp`, `sdpa`, `hdpLw`, `wdpPhia`, `ssp`, `semPx`, `pwsdp`, `fhspa`, `logwdpLh`.

```js
import { parseToken } from 'webdimens';
parseToken('pwhdpLwa');
// { name: 'pwhdpLwa', prefix: 'pw', strategy: 'power', axis: 'h', kind: 'dp',
//   inverter: 'Lw', flags: 'a', px: false, slot: 29, css: true }
parseToken('hdpPh'); // null — Ph não existe no eixo h
```

Cada estratégia expõe 264 acessores (11 variantes de eixo × 4 flags × 3 tipos × com/sem `Px`). Existem variáveis CSS para
cada token `dp` e para os tokens `sp` / `em` sem inversor; tokens `Px` e tokens `sp`/`em` com inversor são apenas para
JavaScript (`dimen('14sspLw')`, nunca em classes ou CSS).

## Por que é rápido: valor × fator

Toda estratégia, eixo, inversor e flag se reduz a `valor × fator`, onde o fator depende apenas do snapshot. Quando o snapshot
muda, o runtime preenche um `Float64Array` com 44 fatores por estratégia registrada. Um acessor como `sdp(v)` é então uma
verificação de flag suja e uma multiplicação:

```js
// o que sdp(16) faz
if (S.dirty) sync();      // só depois de um evento de resize / orientação / DPR
return 16 * table[0];     // table[0] = smallestWidth / 300
```

Eventos de resize apenas marcam o snapshot como sujo; a próxima leitura (ou o próximo frame de animação) o reconstrói. Veja
[Desempenho](./performance.md).

## O modelo de propriedades personalizadas do CSS

`install()` publica uma propriedade personalizada por token CSS em `:root`, com o tamanho de **uma unidade** em px CSS:

```css
:root:root {
  --sdp: 2px;        /* 600 / 300 */
  --sdpa: 1.8631px;
  --hdp: 3px;
  --ssp: 2.5px;      /* × escala de fonte 1.25 */
  --sem: 2px;
  /* …toda estratégia registrada: --pwsdp, --fsdp, … e --ad-w, --ad-h, --ad-sw, --ad-density, … */
}
```

Assim, `calc(16 * var(--sdp))` é `16sdp`, e toda classe, atributo `data-dimen` e saída de PostCSS compila exatamente para isso.
Quando a janela muda, apenas essas propriedades são reescritas (uma vez por frame); as regras que as usam nunca mudam.
Classes modificadoras (`ad-a`, `ad-power`, …) funcionam redirecionando essas propriedades dentro de uma subárvore. Veja
[Unidades declarativas](./declarative.md) e [CSS](./css.md).

Próximo: [Migrando do Android](./migration-android.md) · [Voltar ao índice](./README.md)
