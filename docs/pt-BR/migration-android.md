# Migrando do Android

Um guia lado a lado para desenvolvedores que já usam o AppDimens Dynamic no Android (Compose ou Views). A matemática, os
prefixos de estratégia e as regras de sufixo são as mesmas, então a maior parte do código é portada nome por nome. A tabela
no final lista o que é diferente na web.

## Configuração

| Android | Web |
|---|---|
| `implementation(platform("…:appdimens-dynamic-bom:3.2.0"))` + módulos | `npm install webdimens` (um único pacote; as estratégias são entry points: `webdimens/power`, …) |
| `AppDimensProvider { … }` (Compose) | `install()` uma vez no entry point, ou `useWebDimens()` / `app.use(WebDimens)` / `provideWebDimens()` |
| `DimenCache` / `DimenMetrics` | o runtime: `getMetrics()`, `subscribe()`, `setMetrics()` |

## Dimensões

| Android (Compose) | Android (Views / Kotlin) | Web — JavaScript | Web — classe / CSS |
|---|---|---|---|
| `16.sdp` | `16.sdp(context)` | `sdp(16)` · `dimen('16sdp')` | `p:16sdp` · `calc(16 * var(--sdp))` |
| `16.hdp` / `16.wdp` | `16.hdp(context)` | `hdp(16)` / `wdp(16)` | `h:16hdp` · `var(--hdp)` |
| `14.ssp` | `14.ssp(context)` | `ssp(14)` | `fs:14ssp` · `var(--ssp)` |
| `14.sem` | `14.sem(context)` | `sem(14)` | `fs:14sem` · `var(--sem)` |
| `16.sdpa` / `16.sdpi` / `16.sdpia` | igual, com `context` | `sdpa(16)` / `sdpi(16)` / `sdpia(16)` | `p:16sdpa` · ou `class="ad-a"` em um contêiner |
| `16.hdpLw` | `16.hdpLw(context)` | `hdpLw(16)` | `h:16hdpLw` · `var(--hdpLw)` |
| `2.sdpPx` | `2.sdpPx(context)` (`Float` px) | `sdpPx(2)` · `dimen('2sdpPx')` (px do dispositivo) | — (somente JS) |
| `16.sdpPxaPh` | — | `sdpPhaPx(16)` (`Px` sempre por último na web) | — |
| `16.pwsdp` (`compose.power`) | `DimenPowerDp.pwsdp(context, 16)` | `import { pwsdp } from 'webdimens/power'` | `p:16pwsdp` · `class="ad-power"` |
| `16.toDynamicScaledDp(DpQualifier.HEIGHT, applyAspectRatio = true)` | `16.toDynamicScaledPx(context, …)` | `toDynamicScaledDp(16, DpQualifier.HEIGHT, { applyAspectRatio: true })` / `toDynamicScaledPx` | — |

```kotlin
// Android (Compose)
Text("Title", fontSize = 20.ssp, modifier = Modifier.padding(16.sdp))
```

```html
<!-- Web -->
<h1 class="fs:20ssp p:16sdp">Title</h1>
```

```jsx
// Web, React
<h1 style={dimens({ fontSize: '20ssp', padding: '16sdp' })}>Title</h1>
```

## Facilitadores

A ordem dos argumentos segue as funções do Compose; as opções viram um objeto.

| Android | Web | Resultado em 600 × 900 retrato |
|---|---|---|
| `10.sdpRotate(30, Orientation.LANDSCAPE)` | `sdpRotate(10, 30)` (paisagem é o padrão) | 20 (retrato → base) |
| `10.sdpRotate(30, orientation = Orientation.PORTRAIT)` | `sdpRotate(10, 30, Orientation.PORTRAIT)` | 60 |
| `10.sdpMode(40, UiModeType.TELEVISION)` | `sdpMode(10, 40, UiModeType.TELEVISION)` | 20 (não é uma TV) |
| `10.sdpQualifier(20, DpQualifier.SMALL_WIDTH, 600)` | `sdpQualifier(10, 20, DpQualifier.SMALL_WIDTH, 600)` | 40 |
| `10.sdpScreen(30, UiModeType.TELEVISION, DpQualifier.SMALL_WIDTH, 1000)` | `sdpScreen(10, 30, UiModeType.TELEVISION, DpQualifier.SMALL_WIDTH, 1000)` | 20 |
| `…, finalQualifierResolver = DpQualifier.WIDTH, applyAspectRatio = true` | `…, { finalQualifierResolver: DpQualifier.WIDTH, applyAspectRatio: true }` | |
| `16.ssp.sspRotatePlain(24)` ramificação simples no estilo plain | `plainRotate(a, b, orientation?)`, `plainMode`, `plainQualifier`, `plainScreen` | |

Em classes e CSS, as mesmas decisões são condições: `p:10sdp p@landscape:30sdp`, `p@tv:40sdp`, `p@sw600:20sdp`,
`p@tv@sw1000:30sdp` (veja [Unidades declarativas](./declarative.md)).

## Builders

```kotlin
// Android
val pad = 16.scaledDp()
    .aspectRatio(true)
    .screen(UiModeType.TELEVISION, 40)
    .screen(DpQualifier.SMALL_WIDTH, 600, 24)
    .screen(Orientation.LANDSCAPE, 20)
    .sdp
```

```js
// Web
import { scaledDp, UiModeType, DpQualifier, Orientation } from 'webdimens';

const pad = scaledDp(16)
  .aspectRatio(true)
  .screen(UiModeType.TELEVISION, 40)
  .screen(DpQualifier.SMALL_WIDTH, 600, 24)
  .screen(Orientation.LANDSCAPE, 20);
pad.sdp; // resolvido para a janela atual, memorizado por snapshot
```

As sobrecargas, a prioridade (modo + qualificador > modo > qualificador, limiar maior primeiro > orientação) e os argumentos
`finalQualifierResolver` / `inverter` são os mesmos. Outras estratégias: `powerDp(16).screen(…).pwsdp`,
`fluidSp(14).fssp`, e assim por diante. A web acrescenta uma forma com objeto: `.screen({ uiModeType, qualifier: [DpQualifier.SMALL_WIDTH, 600], value: 24 })`.

## Percentuais `space*`, resize e unidades físicas

| Android | Web |
|---|---|
| `15.spaceW` / `20.spaceSw` / `12.spaceH` | `spaceW(15)` / `spaceSw(20)` / `spaceH(12)` de `webdimens/percent` |
| `25.space(200.dp)` | `space(25, 200)` |
| `autoResizeTextSp(text, minSp, maxSp, stepSp, maxLines)` dentro de `BoxWithConstraints` | `autoResizeText(element, { min, max, step, maxLines })` de `webdimens/resize` |
| `ResizeBound.FixedDp/FixedSp/Percent` | `resizeFixedDp`, `resizeFixedSp`, `resizePercentSw/W/H`, `resizePercentBox` |
| `10f.mm` · `2.5f.cm` · `1f.inch` | `mm(10)` · `cm(2.5)` · `inch(1)` de `webdimens/units` |

## O que é diferente na web

| Tópico | Android | Web |
|---|---|---|
| Janela | `Configuration` da janela | a viewport (`innerWidth` × altura da viewport de layout), ou um elemento com `createDimenScope()` |
| `dp` | pixel independente de densidade | px CSS |
| `sp` | escalado pela escala de fonte do sistema | px CSS × (tamanho de fonte padrão do navegador / 16) |
| Nomes `Px` | irregulares (`sdpPxaPh`, `sspPxa`) | `Px` sempre por último (`sdpPhaPx`, `sspaPx`) |
| Multi-janela (`i`) | `Activity.isInMultiWindowMode` | heurística: janela ≥ 10 % mais estreita que a tela; force com `install({ multiWindow })` |
| Modo de UI | `Configuration.uiMode` + APIs de dobráveis | user agent + Device Posture / Viewport Segments; force com `install({ uiModeType })` |
| Condição `@mw` | — | condição exclusiva da web para o estado de multi-janela |
| Estratégia `density` | `densityDpi / 160` | `devicePixelRatio` |
| Unidades físicas | `xdpi` real | definição do CSS (1 in = 96 px CSS); calibre com `setPhysicalCalibration()` |
| `space*Sp` com `fontScale` | comprimento geométrico | multiplica pela escala de fonte quando `fontScale` é verdadeiro (padrão) |
| Formas declarativas | — | classes, `data-dimen`, `<style data-webdimens>`, variáveis CSS, PostCSS, Sass |

Uma especificação de design escrita em dp é portada 1:1: `16.dp` em uma especificação do Figma/Android vira `16sdp`. Mantenha
px puros para valores que não devem escalar com a viewport, como bordas de um pixel.

Próximo: [Unidades declarativas](./declarative.md) · [Voltar ao índice](./README.md)
