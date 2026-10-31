# Configuração

> **Idiomas:** [English](../../custom/configuration.md) · Português (BR)

`defineScalingStrategy({ id, … })` constrói uma estratégia completa: as formas de uma linha em [código](code-formulas.md) e em [texto](text-formulas.md) são atalhos para os casos mais simples dela. Na web a configuração é um objeto simples com **o mesmo formato do [JSON](json.md)** (`ScalingStrategySpec`), então todo campo abaixo funciona em código e em JSON, em todas as plataformas. Só `curve: { type: 'custom', fn }` e `transform` são exclusivos de código.

```ts
import { defineScalingStrategy } from 'webdimens/custom';

const brand = defineScalingStrategy({            // cria E registra "brand"
  id: 'brand',
  reference: { width: 360, height: 640 },        // quadro de design (dp = px CSS)
  axis: 'smallestWidth',                         // o que comparar
  curve: { type: 'power', exponent: 0.8 },       // como a razão vira fator
  multiplier: 1,
  clamp: { min: 0.85, max: 1.6 },                // limites do fator
  valueClamp: { min: 10, max: 64 },              // limites em px (depende do valor)
  aspectRatio: { enabled: true, sensitivity: 0.004 },   // correção para telas longas/finas
  fontScale: { max: 1.3 },                       // política do csp
  ignoreMultiWindow: false,
  rules: [{ name: 'large', when: { device: ['tablet', 'desktop'] }, set: { curve: { type: 'logarithmic', k: 0.4 } } }],
});
```

Passe `{ register: false }` como segundo argumento para criar uma estratégia descartável.

## A fórmula

```
ratio  = axis(janela) / axis(referência)
factor = clamp( curve(ratio) × multiplier × AR , clamp.min, clamp.max )
scaled = valueClamp( base × factor )   // o resultado configurado
value  = formula ? formula(base, scaled, factor) : scaled   // a fórmula substitui o resultado (recebe o base original)
```

## Campos

| Campo | Spec / JSON | Padrão |
|---|---|---|
| Quadro de referência (dp) | `reference: { width: 360, height: 640 }` | 300 × 533 |
| Eixo | `axis: 'height'` | `'smallestWidth'` |
| Curva | `curve: { type: 'power', exponent: 0.8 }` | `'linear'` |
| Multiplicador | `multiplier: 0.9` | 1 |
| Limites do fator | `clamp: { min: 0.85, max: 1.6 }` | nenhum |
| Limites do valor (px, ≥ 0) | `valueClamp: { min: 10, max: 32 }` | nenhum |
| Proporção | `aspectRatio: true` · `{ enabled: true, sensitivity: 0.004 }` | desligada, k = 0.08 / 30 |
| Escala de fonte (`csp`) | `fontScale: 'follow'` · `'ignore'` · `{ max: 1.3 }` | `'follow'` |
| Multijanela | `ignoreMultiWindow: true` | `false` |
| Fórmula por valor | `formula: 'max(scaled, base)'` | nenhuma |
| Hook por valor em código | `transform: (base, scaled, screen) => …` (só código) | nenhum |
| Regras | `rules: [{ name?, when: {…}, set: {…} }]` | nenhuma |
| Pai | `extends: 'power'` · `BuiltInStrategies.POWER.extend('x', {…})` | nenhum |

## Eixos

| Eixo | Valor | Valor da tela | Valor de referência |
|---|---|---|---|
| Menor largura | `'smallestWidth'` | `sw` | `min(refW, refH)` |
| Largura · altura | `'width'` · `'height'` | largura · altura do viewport | `refW` · `refH` |
| Lado menor · maior | `'min'` · `'max'` | lado menor · maior | `min` · `max` da referência |
| Diagonal | `'diagonal'` | `√(w² + h²)` | `√(refW² + refH²)` |
| Perímetro | `'perimeter'` | `w + h` | `refW + refH` |

O `hdp` embutido divide a altura por **300**. Um eixo `'height'` personalizado divide por `reference.height` (533 por padrão), que é o que espera um designer que desenha num quadro completo.

## Curvas

| Curva | Spec / JSON | Fator |
|---|---|---|
| Linear | `'linear'` | `r` (= `sdp` com a referência padrão) |
| Potência | `{ type: 'power', exponent: 0.8 }` | `r^e` (a power embutida usa 0.75, o padrão quando `exponent` é omitido) |
| Logarítmica | `{ type: 'logarithmic', k: 0.4 }` | `1 + k·ln(r)` (`k` padrão 0.4) |
| Interpolada | `{ type: 'interpolated', t: 0.5 }` | `1 + (r − 1)·t` (`t` padrão 0.5) |
| Constante | `{ type: 'constant', factor: 1 }` | `f` (`factor: 1` = px CSS puros) |
| Breakpoints | `{ type: 'breakpoints', points: [{ at: 360, factor: 1 }, { at: 600, factor: 1.25 }] }` | linear por partes sobre o valor **absoluto** do eixo (dp), limitado ao primeiro e ao último ponto |
| Expressão em texto | `{ type: 'expression', expression: 'pow(ratio, 0.8)' }` | sua fórmula ([fórmulas em texto](text-formulas.md)) |
| Código | `{ type: 'custom', fn: (ratio, screen) => … }` (só código) | sua fórmula, pura |

## Limites

- `clamp` limita o **fator**. Se as regras deixarem `min > max`, vale o máximo. Configurações declaradas são validadas na criação (`RangeError: strategy: minFactor must be <= maxFactor`).
- `valueClamp` limita o **px resultante**. Os limites valem para a magnitude, então um deslocamento negativo espelha o positivo e 0 continua 0; precisam ser ≥ 0. Limites de valor deixam a estratégia dependente do valor: ela é calculada por valor e `css()` retorna um literal em px.
- `clamp: null`, `valueClamp: null` e `formula: null` limpam o que o pai definiu.

## Proporção

`aspectRatio: true` multiplica o fator por `1 + k·ln(AR / 1.78)`, em que `AR = longSide / shortSide` e o `k` padrão é o 0.08 / 30 embutido. Aumente `k` (`sensitivity`) para uma correção mais forte em janelas muito longas ou muito quadradas. `sensitivity` também pode ser definida sozinha, o que é útil numa regra.

## Escala de fonte (`csp`)

| Política | Efeito em `csp(14, brand)` |
|---|---|
| `'follow'` (padrão) | segue a escala de fonte do usuário, como `ssp` |
| `'ignore'` | tamanho fixo; a escala de fonte é cancelada |
| `{ max: 1.3 }` | segue até 1.3× e para |

Na web a escala de fonte é o tamanho de fonte da raiz dividido por 16 (a configuração de tamanho de texto do navegador), medido pelo runtime; force com `configure({ fontScale })`. Veja [Runtime › Escala de fonte](../runtime.md#escala-de-fonte).

## Multijanela

`ignoreMultiWindow: true` mantém os valores sem escala quando o runtime informa estado de multijanela (uma janela dividida ou não maximizada): o fator é 1, e fórmulas e transforms são ignorados. Os limites de valor continuam valendo. Para reagir você mesmo, use uma regra (`when: { multiWindow: true }`) ou leia `multiWindow` numa fórmula. A detecção está em [Runtime › Detecção de multijanela](../runtime.md#detecção-de-multijanela).

## Regras

Uma regra muda alguns campos quando a condição dela casa com a janela.

```ts
defineScalingStrategy({
  id: 'brand',
  curve: { type: 'power', exponent: 0.8 },
  rules: [
    { name: 'large', when: { device: ['tablet', 'desktop'] }, set: { curve: { type: 'logarithmic', k: 0.4 } } },
    { when: { smallestWidth: { min: 600 }, orientation: 'landscape' }, set: { multiplier: 0.9 } },
    { when: { device: 'watch' }, set: { axis: 'min', reference: { width: 192, height: 192 }, clamp: { min: 0.85, max: 1.15 } } },
    { when: { orientation: 'landscape' }, set: { multiplier: 0.95 } },
    { when: { multiWindow: true }, set: { clamp: { max: 1.2 } } },
    { when: { width: { min: 1024 } }, set: { fontScale: { max: 1.2 } } },
  ],
});
```

| Condição | `when` |
|---|---|
| Classe de dispositivo | `device: 'tv'` ou `['tablet', 'desktop']` |
| Orientação | `orientation: 'landscape'` · `'portrait'` |
| Menor largura / largura / altura (dp) | `smallestWidth: { min: 600 }`, `width: { max: 1200 }`, `height: {…}` |
| Proporção | `aspectRatio: { min: 2 }` |
| Janela dividida | `multiWindow: true` |

- Uma condição casa quando **todo** campo definido nela casa. Faixas são `min <= valor < max`. Um `when` omitido casa com qualquer janela.
- Todas as regras que casam são aplicadas **na ordem de declaração**. Uma regra posterior sobrescreve os campos que uma anterior definiu; campos que a regra não menciona mantêm o valor atual.
- Os nomes das regras aplicadas aparecem em `explain()`. Regras sem nome aparecem como `#índice`.
- Classes de dispositivo: `phone`, `tablet`, `desktop`, `tv`, `watch`, `car`, `vr`.

### Classe de dispositivo na web

A classe de dispositivo é detectada nesta ordem:

1. **Modo de UI** (`tv`, `car`, `watch`, `desk` → `desktop`, `vr`), pelas heurísticas do runtime ou pela opção `uiModeType` do install.
2. **Ponteiro fino com hover** (mouse ou trackpad) → `desktop`.
3. **Tamanho**: `sw >= 600` → `tablet`, senão `phone`.

Substitua com `setDeviceClassResolver((metrics) => …)` (passe `null` para voltar ao padrão). Regras por faixa de largura (`when: { width: { min: 1024 } }`) não dependem da detecção; prefira-as quando só o tamanho importa.

## Estendendo

```ts
import { BuiltInStrategies, CustomPresets, defineScalingStrategy } from 'webdimens/custom';

const soft = BuiltInStrategies.POWER.extend('soft', { curve: { type: 'power', exponent: 0.6 } });
const myTv = CustomPresets.TV_SAFE.extend('myTv', { rules: [{ when: { device: 'tv' }, set: { clamp: { max: 1.6 } } }] });
const kiosk = defineScalingStrategy({ id: 'kiosk', extends: 'tvSafe', multiplier: 1.1 });
const heights = brand.withAxis('height');   // "brand@height", em cache por instância, não registrada
```

`extend(id, patch, { register? })` mantém os campos e as regras do pai (as regras do pai primeiro) e deixa você mudar qualquer um; registra a nova estratégia, a menos que `register: false`. `extends` numa spec aceita um id registrado, uma embutida ou um preset.

### Embutidas como configurações

`BuiltInStrategies.SCALED`, `POWER`, `LOGARITHMIC`, `INTERPOLATED`, `DIAGONAL`, `PERIMETER` e `FIXED` (ids `scaled`, `power`, `logarithmic`, `interpolated`, `diagonal`, `perimeter`, `fixed`). Os fatores delas batem com as estratégias embutidas no caminho padrão de menor largura, então são um ponto de partida seguro. `BuiltInStrategies.SCALED` é a estratégia padrão até `setDefaultScalingStrategy` ser chamada, então `cdp(16)` é igual a `sdp(16)`.

### Presets (`CustomPresets`)

| Preset | Id | O que faz |
|---|---|---|
| `TABLET_FRIENDLY` | `tabletFriendly` | Linear em celulares; `power(0.5)` em tablets e desktop; fator ≤ 1.8 |
| `COMPACT_FIRST` | `compactFirst` | Referência 360×640, `interpolated(0.5)`, fator 0.9–1.4 |
| `TV_SAFE` | `tvSafe` | Na TV: eixo da altura vs 540 dp, fator 1–2 |
| `WEARABLE` | `wearable` | No relógio: lado menor vs 192 dp, fator 0.85–1.15 |
| `GAME_HUD` | `gameHud` | Lado menor, `power(0.85)`, proporção ligada, 0.75–2.5, texto de tamanho fixo |
| `READABLE_TEXT` | `readableText` | `logarithmic(0.4)`, escala de fonte limitada a 1.3 |

Presets não são registrados por padrão, mas `getScalingStrategy('tvSafe')`, `cdp(16, 'tvSafe')` e o `extends` do JSON os encontram pelo id.

[Voltar à documentação de estratégias personalizadas](README.md)
