# Unidades e space

Dois módulos pequenos para tamanhos que não são "dp escalado pela janela": **unidades físicas** (`webdimens/units`, mm / cm / polegada)
e **porcentagens literais** da janela (`space*` em `webdimens/percent`).

## Unidades físicas

```js
import { mm, cm, inch, toPxFromMm, toSpFromMm, unitSizeInDp, radius, radiusFromCircumference, UnitType } from 'webdimens/units';

mm(10);          // 37.80  px CSS (dp)
cm(2.5);         // 94.49
inch(1);         // 96
toPxFromMm(10);  // 113.39 px de dispositivo em uma tela DPR-3 (× devicePixelRatio)
toSpFromMm(3);   // o tamanho de texto que renderiza 3 mm de altura com a escala de fonte atual
```

Os navegadores não expõem o DPI real da tela, então as conversões usam a definição CSS de unidades absolutas: **1in = 96 px CSS**
(1 cm = 37,795 px, 1 mm = 3,7795 px). É exatamente o que `in`, `cm` e `mm` fazem no CSS, então em folhas de estilo você pode
escrevê-las diretamente: `width: 10mm`. No Android, usa-se o `xdpi` real do painel; na web, a precisão física depende do dispositivo.

Para quiosques, sinalização digital ou um painel conhecido, calibre uma vez:

```js
import { setPhysicalCalibration } from 'webdimens/units';

setPhysicalCalibration(110);  // este painel mostra 110 px CSS por polegada real; retorna o valor anterior (96)
mm(10);                        // 43.31
```

| Função | Resultado |
|---|---|
| `mm(v)` `cm(v)` `inch(v)` (= `toDpFromMm/Cm/Inch`) | px CSS |
| `toPxFromMm/Cm/Inch(v)` | px de dispositivo |
| `toSpFromMm/Cm/Inch(v)` | sp (px CSS ÷ escala de fonte) |
| `convertMmToCm`, `convertMmToInch`, `convertCmToMm`, `convertCmToInch`, `convertInchToCm`, `convertInchToMm` | conversões puras |
| `unitSizeInDp(UnitType)` | tamanho de uma unidade em px CSS: `INCH` 96, `CM` 37.80, `MM` 3.78, `DP` 1, `SP` escala de fonte, `PX` 1 / devicePixelRatio |
| `radius(diameter, type = DP)` (= `radiusFromDiameter`) | raio em px CSS: `radius(48, UnitType.MM)` → 90.71 |
| `radiusFromCircumference(c, type = DP)` | `radiusFromCircumference(100)` → 15.92 |
| `measureDiameter(value, isCircumference)` (= `displayMeasureDiameter`) | diâmetro a partir de um diâmetro ou de uma circunferência |

Uso típico: alvos de toque mínimos (`minh: 9mm` em CSS, ou `mm(9)` em JS), réguas no estilo impresso, maquetes físicas.

## Porcentagens literais: `space*`

`webdimens/percent` também exporta a API `space*` do Android: o receptor é uma porcentagem (0–100) de um eixo, não um valor em dp.

```js
import { spaceW, spaceSw, spaceH, space, spaceWPx, spaceWSp } from 'webdimens/percent';

// janela 600 × 900
spaceW(10);        // 60    10 % da largura
spaceSw(10);       // 60    10 % do menor lado
spaceH(10);        // 90
space(25, 200);    // 50    25 % de um comprimento de referência
spaceWPx(10);      // 120   px de dispositivo no DPR 2
spaceWSp(5);       // 30 × escala de fonte (fontScale é true por padrão; passe false para o comprimento simples)
```

| Família | Funções |
|---|---|
| largura / menor lado / altura | `spaceW` `spaceSw` `spaceH`, com as variantes `Px`, `i` e `Pxi` (`spaceWPx`, `spaceWi`, `spaceWPxi`, …) |
| comprimento de referência | `space(p, ref)`, `spaceI`, `spacePx`, `spacePxi` |
| texto | `spaceWSp(p, fontScale = true, ignoreMultiWindows = false)`, `spaceSwSp`, `spaceHSp`, `spaceSp(p, ref, fontScale)` com variantes `i` / `Px` |

As variantes `i` seguem o `literalPercentOfScreenDp` do Android: em estado de multi-janela, elas retornam a porcentagem bruta
(`spaceWi(50)` → 50) em vez de um comprimento. No CSS, as unidades de viewport simples já fazem esse trabalho: `width: 10vw`, `10vmin`.

`space*` é diferente da **estratégia de porcentagem** (`psdp`): `psdp(16)` escala linearmente um valor de design de 16 dp com o
eixo (`16 × d / 300`), enquanto `spaceW(16)` é 16 % da largura.

Próximo: [Desempenho](./performance.md) · [Voltar ao índice](./README.md)
