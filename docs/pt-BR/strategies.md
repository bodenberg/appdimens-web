# Estratégias

Uma estratégia é a curva que transforma um valor em dp em px CSS conforme a janela cresce. O webdimens traz as 12 estratégias do
AppDimens Dynamic, com fórmulas idênticas e os mesmos prefixos de nome. **Comece pela escalonada** (`sdp`); troque apenas
quando a verificação visual mostrar que a curva está errada para uma parte da interface.

## Comparação

16 dp em todas as estratégias, em janelas de referência (gerado a partir da build real por `npm run strategy-table`):

Eixo `s`, sem flags:

| Estratégia (16 dp) | Celular pequeno 320×640 | Celular 412×915 | Tablet 768×1024 | Notebook 1280×800 | TV 1920×1080 |
|---|---:|---:|---:|---:|---:|
| `sdp` escalonada | 17.1 | 22.0 | 41.0 | 42.7 | 57.6 |
| `psdp` percentual | 17.1 | 22.0 | 41.0 | 42.7 | 57.6 |
| `pwsdp` potência | 16.8 | 20.3 | 32.4 | 33.4 | 41.8 |
| `fsdp` fluida | 12.8 | 14.1 | 19.2 | 19.2 | 19.2 |
| `asdp` automática | 17.1 | 22.0 | 29.9 | 30.2 | 32.6 |
| `logsdp` logarítmica | 16.4 | 18.0 | 22.0 | 22.3 | 24.2 |
| `isdp` interpolada | 16.5 | 19.0 | 28.5 | 29.3 | 36.8 |
| `dgsdp` diagonal | 18.7 | 26.3 | 33.5 | 39.5 | 57.6 |
| `prsdp` perímetro | 18.4 | 25.5 | 34.4 | 40.0 | 57.6 |
| `flsdp` preenchimento | 19.2 | 27.5 | 41.0 | 42.7 | 57.6 |
| `ftsdp` ajuste | 17.1 | 22.0 | 30.7 | 38.4 | 57.6 |
| `dsdp` densidade | 32.0 | 42.0 | 32.0 | 16.0 | 16.0 |

Variantes `a` (proporção):

| Estratégia (16 dp) | Celular pequeno 320×640 | Celular 412×915 | Tablet 768×1024 | Notebook 1280×800 | TV 1920×1080 |
|---|---:|---:|---:|---:|---:|
| `sdpa` escalonada | 17.2 | 23.0 | 35.2 | 40.4 | 57.6 |
| `psdpa` percentual | 17.2 | 23.0 | 35.2 | 40.4 | 57.6 |
| `pwsdpa` potência | 16.8 | 20.3 | 32.4 | 33.4 | 41.8 |
| `fsdpa` fluida | 12.8 | 14.1 | 19.2 | 19.2 | 19.2 |
| `asdpa` automática | 17.1 | 22.0 | 29.9 | 30.2 | 32.6 |
| `logsdpa` logarítmica | 16.4 | 18.0 | 22.0 | 22.3 | 24.2 |
| `isdpa` interpolada | 16.5 | 19.0 | 28.5 | 29.3 | 36.8 |
| `dgsdpa` diagonal | 18.7 | 26.3 | 33.5 | 39.5 | 57.6 |
| `prsdpa` perímetro | 18.4 | 25.5 | 34.4 | 39.9 | 57.6 |
| `flsdpa` preenchimento | 19.2 | 27.5 | 40.9 | 42.7 | 57.6 |
| `ftsdpa` ajuste | 17.1 | 22.0 | 30.7 | 38.4 | 57.6 |
| `dsdpa` densidade | 32.0 | 42.0 | 32.0 | 16.0 | 16.0 |

As variantes `a` das estratégias satélite quase não diferem das simples, porque a correção delas é
`1 + k × ln(AR / 1.78)` com `k = 0.08 / 30`; a escalonada e a percentual usam `1 + (d − 300) × (1/300 + k × ln(AR / 1.78))`, que
muda mais. Em uma TV 16:9 (`AR ≈ 1.78`), toda correção é neutra. Apenas a densidade depende do devicePixelRatio
(2, 2.625, 2, 1, 1 nas janelas acima). Uma versão ao vivo desta tabela está em [examples/strategies.html](../../examples/strategies.html).

## Escolhendo

| Necessidade | Estratégia |
|---|---|
| UI geral, o padrão do Android | **escalonada** `sdp` |
| Telas grandes parecem grandes demais com crescimento linear | **potência** `pwsdp`, **automática** `asdp`, **logarítmica** `logsdp` |
| Crescimento limitado (0,8× a 1,2×), por exemplo texto corrido | **fluida** `fsdp` |
| No meio do caminho entre fixo e linear | **interpolada** `isdp` |
| Acompanhar a diagonal / o perímetro da tela (ultrawide, quiosques) | **diagonal** `dgsdp`, **perímetro** `prsdp` |
| Cobrir / conter em relação à referência 300 × 533 | **preenchimento** `flsdp`, **ajuste** `ftsdp` |
| Escala de densidade clássica | **densidade** `dsdp` |
| Porcentagem literal da janela | `spaceW(10)` de `webdimens/percent` (veja [Unidades e space](./units.md)) |

Toda estratégia tem as mesmas regras de sufixo (eixos `h`/`w`, `sp`/`em`, flags, inversores, `Px`), os mesmos facilitadores
(`pwsdpRotate`…), resolvedores genéricos (`toDynamicPowerDp`…) e builder (`powerDp(16).pwsdp`). Nas fórmulas, `d` é o comprimento do eixo
em dp (menor largura para `s`), `w`/`h` são a janela, e `min`/`max` são os seus lados.

## Escalonada — `webdimens` · prefixo `''`

```
sdp(v) = v × d / 300
sdpa(v) = v × (1 + (d − 300) × (1/300 + k × ln(AR / 1.78)))
```

Linear, idêntica ao padrão do Android. `import { sdp } from 'webdimens'` · classe `p:16sdp` · CSS `calc(16 * var(--sdp))`.

## Percentual — `webdimens/percent` · prefixo `p`

```
psdp(v) = v × d / 300          (a: mesma lei da escalonada)
```

Numericamente a mesma curva da escalonada, mas mantida como uma família de tokens própria, para que uma subárvore possa trocar com
`ad-percent`. O módulo também exporta a API literal `space*` (`spaceW(10)` = 10 % da largura). `import { psdp, spaceW } from 'webdimens/percent'`.

## Potência — `webdimens/power` · prefixo `pw`

```
pwsdp(v) = v × (d / 300)^0.75
```

Sublinear: cresce menos que a escalonada em tablets e desktops. Bom para espaçamentos em apps que também rodam em telas grandes.
`pwsdp(16)` em 600 × 900 → 26.91 (escalonada: 32).

## Fluida — `webdimens/fluid` · prefixo `f`

```
factor = 0.8                                 se d ≤ 320
factor = 0.8 + 0.4 × (d − 320) / 448         se 320 < d < 768
factor = 1.2                                 se d ≥ 768
```

Limitada entre 0,8× e 1,2× do valor de projeto: nunca minúscula, nunca enorme. Útil para texto corrido e detalhes finos.

## Automática — `webdimens/auto` · prefixo `a`

```
factor = d / 300                                         se d ≤ 480
factor = 1.6 + 0.4 × ln(1 + (d − 480) / 300)             se d > 480
```

Linear como a escalonada em celulares, logarítmica depois de 480 dp: um "joelho" entre celular e tablet.

## Logarítmica — `webdimens/logarithmic` · prefixo `log`

```
factor = 1 + 0.4 × ln(d / 300)               se d > 300
factor = 1 − 0.4 × ln(300 / d)               se d ≤ 300
```

Amortecimento forte em todos os tamanhos de tela.

## Interpolada — `webdimens/interpolated` · prefixo `i`

```
factor = 1 + (d / 300 − 1) × 0.5
```

No meio do caminho entre um valor fixo e a escalonada.

## Diagonal — `webdimens/diagonal` · prefixo `dg`

```
factor = √(w² + h²) / 611.63                 (independente do eixo)
```

Acompanha a diagonal da janela; a diagonal de referência é √(300² + 533²).

## Perímetro — `webdimens/perimeter` · prefixo `pr`

```
factor = (w + h) / 833                       (independente do eixo)
```

## Preenchimento — `webdimens/fill` · prefixo `fl`

```
factor = max(min / 300, max / 533)           (independente do eixo)
```

"Cobrir": escala para que o quadro de referência 300 × 533 preencha a janela.

## Ajuste — `webdimens/fit` · prefixo `ft`

```
factor = min(min / 300, max / 533)           (independente do eixo)
```

"Conter": escala para que o quadro de referência caiba dentro da janela.

## Densidade — `webdimens/density` · prefixo `d`

```
factor = devicePixelRatio                    (independente do eixo)
```

A escala de densidade clássica do Android (`densityDpi / 160`); na web é a razão de pixels do dispositivo, então os valores não
dependem do tamanho da janela. Raramente é o que um layout web precisa; é fornecida por paridade.

## Personalizada — `webdimens/custom` · `cdp` / `csp`

Quando nenhuma das doze curvas serve, defina a sua: frame de referência, eixo, curva (`linear`, `power`, `logarithmic`, `interpolated`, `constant`, `breakpoints` ou uma função), limites de fator e de valor, política de font scale e regras por classe de dispositivo / faixa de tela / orientação. Use como `cdp(16, brand)`, `brand.css(16)` ou `16cdp-brand`. O mesmo JSON funciona em todas as plataformas AppDimens. Veja [Estratégias personalizadas](./custom.md).

## Usando várias estratégias

Toda definição de estratégia vem com o núcleo, e uma estratégia **se registra no primeiro uso** — um token JS
(`dimen('16pwsdp')`), uma classe ou valor de `data-dimen` (`p:16pwsdp`) ou uma classe de modificador (`ad-power`). Registrar publica
as suas variáveis CSS (`--pwsdp`…) e a sua classe de modificador. O pacote de CDN registra as doze.

```js
import { install, dimen } from 'webdimens';
import { pwsdp } from 'webdimens/power';      // importe um módulo apenas pelas suas funções nomeadas

dimen('10logsdp');                             // funciona sem importar webdimens/logarithmic
install({ strategies: ['fluid'] });            // CSS que o runtime nunca analisa: var(--fsdp) escrito à mão, saída do PostCSS
```

- `install({ strategies: [...] })` (ids: `scaled`, `percent`, `power`, `fluid`, `auto`, `diagonal`, `fill`, `fit`, `interpolated`,
  `logarithmic`, `perimeter`, `density`, ou `'all'`) só é necessário quando as variáveis de uma estratégia são usadas por CSS que o
  runtime nunca vê. `register(FLUID)` faz o mesmo com a definição que cada módulo exporta.
- Troque uma subárvore sem renomear tokens: `<aside class="ad-power">…class="p:16sdp"…</aside>` faz `--sdp` significar potência
  dentro dela (veja [Unidades declarativas](./declarative.md#classes-modificadoras)).

Próximo: [Frameworks](./frameworks.md) · [Voltar ao índice](./README.md)
