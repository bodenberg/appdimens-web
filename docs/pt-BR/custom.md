# Estratégias personalizadas

`webdimens/custom` permite **definir sua própria estratégia de escala**, sem precisar escolher uma das 12 embutidas. É o port web do módulo Android `appdimens-dynamic-custom`, e a configuração usa o **mesmo JSON em todas as plataformas AppDimens** (Android, KMP, iOS, Flutter, React Native, Web, Games, .NET).

> **Idiomas:** [English](../custom.md) · Português (BR)

## Início rápido: só escreva a fórmula

O jeito mais fácil é escrever a fórmula você mesmo. Você recebe o valor passado (`base`, por exemplo 16) e a tela, e devolve o valor escalado. Não há nada para configurar.

```ts
import { cdp, csp, cdpCss, customScaleStrategy, scalingFormula } from 'webdimens/custom';

// 1. Inline: a fórmula é o valor
cdp(16, 'base * pow(sw / 360, 0.8)');             // px CSS
csp(20, 'base * min(sw / 360, 1.3)');             // texto, segue a escala de fonte
cdpCss(16, 'base * (sw / 360)');                  // "calc(16 * var(--cdp-formula-…))" — CSS responsivo

// 2. Com nome, para reutilizar em todo lugar
const hud = scalingFormula('base * (tablet ? 0.9 : 1) * clamp(sw / 360, 0.85, 1.6)');
hud.dp(48);                                       // ou cdp(48, hud), hud.css(48), useScalingStrategy(hud)

// 3. Em código, sem limites (não serializa em JSON)
const fancy = scalingFormula((base, screen) => base * Math.pow(screen.smallestWidthDp / 360, 0.8));

// 4. Fator programável: devolva o fator que multiplica todo valor
const product = customScaleStrategy((screen) => {
  const width = screen.widthDp;
  return Math.min(Math.max(width / 360, 0.85), 1.8);
});
cdp(16, product);                                 // 16 × fator
```

| Forma | Você devolve | Custo por valor | JSON |
|---|---|---|---|
| `cdp(16, '…')` / `scalingFormula('…')` | o valor final (`base` = entrada) | uma multiplicação no formato `base * (…)`, senão avaliada por valor | sim |
| `scalingFormula((base, screen) => …)` | o valor final | a função roda por valor | não |
| `customScaleStrategy((screen) => …)` | o **fator** (qualquer JS: `if`, `switch`, helpers, `Math.min`…) | uma multiplicação (a função roda uma vez por janela); `css()` continua variável CSS | não |

Nas funções, `screen` é um `ScreenSnapshot`: `widthDp`, `heightDp`, `smallestWidthDp`, `density`, `fontScale`, `isLandscape`, `isMultiWindow`, `device` (`'phone'`, `'tablet'`, `'tv'`…). Elas devem ser puras (não podem ler estado mutável), porque os resultados são memorizados por janela. `customScaleStrategy(fn, { id: 'product' })` registra a estratégia (`--cdp-product`, `16cdp-product`).

Uma estratégia em string é primeiro um **id**; quando nenhuma estratégia tem esse id, ela é lida como fórmula. Fórmulas em texto sem `id` são compartilhadas por texto (chamar `scalingFormula` de novo com o mesmo texto devolve a mesma instância) e não são registradas. Passe `{ id: 'hud' }` para registrar com um nome, o que também publica `--cdp-hud` e habilita o literal `16cdp-hud`.

| Você escreve | Significa |
|---|---|
| `base` | o valor passado (`16` em `cdp(16, …)`) |
| `sw` · `width` · `height` | menor largura · largura · altura da janela (dp = px CSS) |
| `shortSide` · `longSide` · `diagonal` · `aspectRatio` | outras medidas da janela |
| `ratio` | `sw / 300`, a razão que o `sdp` usa (então `base * ratio` = `sdp`) |
| `phone` `tablet` `desktop` `tv` `watch` `car` `vr` · `landscape` `portrait` `multiWindow` | 1 quando verdadeiro, 0 quando falso |
| `density` · `fontScale` | device pixel ratio · escala de fonte do usuário |

Você pode usar `+ - * / ^`, `cond ? a : b`, `min` `max` `clamp` `pow` `sqrt` `log` `round` `lerp` `smoothstep` e mais (veja [Fórmulas livres](#fórmulas-livres-sem-os-limites-das-curvas-embutidas)). Erros de digitação falham na hora com a posição, por exemplo `unknown variable 'sww'`.

**Caminho rápido.** Quando a fórmula tem o formato `base * (…)` e a parte `(…)` não lê `base`, ela custa uma multiplicação por valor: a parte `(…)` é calculada uma vez por janela, e `css()` continua sendo uma variável CSS. Qualquer outro formato também funciona, avaliado por valor (e `css()` devolve o literal em px da viewport atual). `base * sw / 360` é avaliado como escrito, `(base * sw) / 360`. Escreva `base * (sw / 360)` para o caminho rápido.

O mesmo texto funciona no JSON de estratégias (`{"id": "hud", "formula": "base * pow(sw / 360, 0.8)"}`) e dá os mesmos números em todas as plataformas AppDimens. Se precisar de mais estrutura (regras por dispositivo, limites do fator, política de escala de fonte), use a configuração completa abaixo.

## O que é uma estratégia

Uma estratégia é um objeto simples que transforma a janela atual (viewport ou [escopo de elemento](./runtime.md)) em um único **fator**:

```
razão  = eixo(janela) / eixo(referência)
fator  = clamp( curva(razão) × multiplicador × AR , clamp.min, clamp.max )
px     = formula( valueClamp( valor × fator ) )
```

Regras podem sobrescrever qualquer campo por **classe de dispositivo** (`phone`, `tablet`, `desktop`, `tv`, `watch`, `car`, `vr`), **faixa de tela** (menor largura, largura, altura, proporção), **orientação** e **multi-janela**.

## Definir e usar

```ts
import { defineScalingStrategy, cdp, csp } from 'webdimens/custom';

const brand = defineScalingStrategy({
  id: 'brand',
  reference: { width: 360, height: 640 },          // frame do design (dp = px CSS)
  curve: { type: 'power', exponent: 0.8 },         // crescimento sublinear
  clamp: { min: 0.85, max: 1.6 },                  // limites do fator
  fontScale: { max: 1.3 },                         // csp segue a fonte do usuário até 1.3×
  rules: [
    { name: 'large', when: { device: ['tablet', 'desktop'] }, set: { curve: { type: 'logarithmic', k: 0.4 } } },
    { when: { orientation: 'landscape', smallestWidth: { min: 600 } }, set: { multiplier: 0.9 } },
  ],
});

cdp(16, brand);        // px CSS para o viewport atual
csp(14, brand);        // texto, com a política de font scale
brand.dp(16);          // igual a cdp(16, brand)
brand.px(16);          // px do dispositivo (× devicePixelRatio)
brand.css(16);         // "calc(16 * var(--cdp-brand))" — responsivo, sem re-render, seguro para SSR
brand.cssSp(14);       // "calc(14 * var(--csp-brand))"
```

`defineScalingStrategy` também **registra** a estratégia, então você pode referenciá-la pelo id (`cdp(16, 'brand')`). Use `{ register: false }` para instâncias descartáveis.

### Padrão global

```ts
import { setDefaultScalingStrategy, cdp } from 'webdimens/custom';
setDefaultScalingStrategy('brand');
cdp(16);   // usa brand; antes de definir um padrão, é igual a sdp(16)
```

## Campos da configuração

| Campo | Exemplo | Padrão |
|---|---|---|
| `reference` | `{ width: 360, height: 640 }` | 300 × 533 |
| `axis` | `'smallestWidth'` · `'width'` · `'height'` · `'min'` · `'max'` · `'diagonal'` · `'perimeter'` | `'smallestWidth'` |
| `curve` | veja abaixo | `'linear'` |
| `multiplier` | `0.9` | 1 |
| `clamp` | `{ min: 0.85, max: 1.6 }` (fator) | nenhum |
| `valueClamp` | `{ min: 10, max: 32 }` (px resultante, magnitude) | nenhum |
| `aspectRatio` | `true` ou `{ enabled: true, sensitivity: 0.004 }` | desligado, k = 0.08 / 30 |
| `fontScale` | `'follow'` · `'ignore'` · `{ max: 1.3 }` | `'follow'` |
| `ignoreMultiWindow` | `true` → fator 1 em janela dividida | `false` |
| `formula` | `'round(scaled)'` — fórmula por valor em texto (JSON) | nenhum |
| `transform` | `(base, scaled, screen) => Math.round(scaled)` (só código) | nenhum |
| `rules` | `[{ name?, when: {…}, set: {…} }]` | nenhuma |
| `extends` | `'power'`, `'tabletFriendly'`, outro id | — |

| Curva | Fator |
|---|---|
| `'linear'` | `r` (igual a `sdp` com a referência padrão) |
| `{ type: 'power', exponent }` | `r^e` (a power embutida usa 0.75) |
| `{ type: 'logarithmic', k }` | `1 + k·ln(r)` (a embutida usa 0.4) |
| `{ type: 'interpolated', t }` | `1 + (r − 1)·t` (a embutida usa 0.5) |
| `{ type: 'constant', factor }` | fator fixo |
| `{ type: 'breakpoints', points: [{ at: 360, factor: 1 }, { at: 840, factor: 1.5 }] }` | linear por partes sobre o valor **absoluto** do eixo |
| `{ type: 'expression', expression: 'pow(ratio, 0.8)' }` | sua fórmula, como texto (serializável em JSON) — veja abaixo |
| `{ type: 'custom', fn: (ratio, screen) => … }` | sua fórmula pura (só código) |

### Fórmulas livres (sem os limites das curvas embutidas)

Você não fica preso às curvas embutidas: escreva a fórmula você mesmo, como **texto**, que funciona também no JSON e dá o mesmo resultado em todas as plataformas AppDimens:

- **Curva por expressão** — devolve o **fator** a partir da tela. É calculada uma vez por janela, como qualquer curva, e continua na via rápida de uma multiplicação.
  `curve: { type: 'expression', expression: 'pow(ratio, 0.8) * (tablet ? 0.9 : 1)' }`
- **Fórmula** — devolve o **valor final** de cada entrada. Pode usar `base`, `scaled` e `factor`, e substitui ou pós-processa o resultado. A estratégia passa a depender do valor (avaliada por valor), a menos que a fórmula seja `base * (…)` sem variável de valor dentro dos parênteses: essa continua só da tela (veja [Início rápido](#início-rápido-só-escreva-a-fórmula)).
  `formula: 'base * pow(sw / 360, 0.7) + 2'` · `formula: 'max(scaled, base)'`

| | |
|---|---|
| Operadores | `+ - * / % ^` (`^` = potência, associativa à direita; `%` mantém o sinal do dividendo), `== != < <= > >=`, `&& \|\| !`, `cond ? a : b`, `( )` |
| Funções | `min(a, b, …)` `max(a, b, …)` `clamp(x, lo, hi)` `pow` `sqrt` `ln`/`log` `log10` `log2` `exp` `abs` `sign` `floor` `ceil` `round` (meio para cima) `lerp(a, b, t)` `step(edge, x)` `smoothstep(e0, e1, x)` |
| Variáveis de tela | `sw` `width` `height` `shortSide` `longSide` `diagonal` `perimeter` `aspectRatio` `density` `fontScale`; flags (1/0): `landscape` `portrait` `multiWindow` `phone` `tablet` `desktop` `tv` `watch` `car` `vr`; constantes `pi` `e`, `true` / `false` |
| Variáveis de curva | as de tela + `ratio` (eixo / referência), `axis` (dp), `ref` (dp de referência), `refWidth`, `refHeight` |
| Variáveis de fórmula | as de curva + `base` (entrada), `scaled` (base × fator após `valueClamp`), `factor` |

As expressões são analisadas quando a estratégia é criada. Variáveis ou funções desconhecidas, aridade errada e erros de sintaxe falham cedo, com a posição e o caminho no JSON (ex.: `brand.rules[0].set.curve.expression`). Um fator não finito (por exemplo, divisão por zero) lança erro ao resolver. Regras podem trocar expressões por dispositivo, e `formula: null` limpa uma fórmula herdada.

Para o que a linguagem não expressa, use uma função só de código: `{ type: 'custom', fn: (ratio, screen) => … }` (fator) ou `transform: (base, scaled, screen) => …` (valor).


**Como as regras se aplicam:**
- Todo campo definido em `when` precisa casar. As faixas são `min <= valor < max`.
- As regras que casam se aplicam em ordem, e uma regra posterior sobrescreve os campos definidos por uma anterior.
- Se regras combinadas deixarem limites cruzados, o max vence.
- `explain()` lista as regras aplicadas. Regras sem nome aparecem como `#índice`.

## JSON, presets e embutidas

```ts
import { loadScalingStrategies, CustomPresets, BuiltInStrategies } from 'webdimens/custom';

const res = await fetch('/appdimens-strategies.json');
loadScalingStrategies(await res.text());   // registra todas + aplica "default"

const tv = CustomPresets.TV_SAFE;           // tabletFriendly, compactFirst, tvSafe, wearable, gameHud, readableText
const soft = BuiltInStrategies.POWER.extend('soft', { curve: { type: 'power', exponent: 0.6 } });
const heights = brand.withAxis('height');   // "brand@height"
brand.toJSON();                              // exportar (exportScalingStrategies() para todas)
```

`extends` pode apontar para:
- outra estratégia do mesmo documento;
- uma estratégia registrada;
- uma embutida (`scaled`, `power`, `logarithmic`, `interpolated`, `diagonal`, `perimeter`, `fixed`);
- um preset.

As regras do pai vêm primeiro. Os erros informam o caminho do problema (`brand.rules[0].set.curve.type …`). Schema: [`custom-strategy.schema.json`](https://github.com/bodenberg/appdimens-skills/blob/main/schemas/custom-strategy.schema.json).

## CSS, literais e PostCSS

Assim que uma estratégia é definida no navegador, o runtime publica no `:root`:
- `--cdp-<id>`: o fator de layout, em px.
- `--csp-<id>`: o fator de texto × o font scale efetivo.
- `--cdp` / `--csp`: os mesmos dois valores para a estratégia padrão.

Os valores são atualizados uma vez por frame quando a janela é redimensionada.

```css
.card { padding: calc(16 * var(--cdp-brand)); font-size: calc(14 * var(--csp-brand)); }
```

O literal funciona em todo lugar onde `16sdp` funciona (`dimens()`, `dimenCss()`, `<style data-webdimens>`, PostCSS):

```css
/* postcss.config.js → plugins: [webdimens()] */
.card { padding: 8cdp-brand 16cdp-brand; font-size: 14csp-brand; margin: 4cdp; }
/* → calc(8 * var(--cdp-brand)) … calc(4 * var(--cdp)) */
```

- Em JS, `dimen('16cdp-brand')` e `dimensPx()` resolvem o literal pelo registro.
- Se o seu CSS usa só `16cdp` / `var(--cdp)` sem definir nenhuma estratégia, chame `installCustomCss()` uma vez.
- Estratégias com `valueClamp`, `formula` ou `transform` dependem do valor, então `brand.css(v)` devolve um literal em px do snapshot atual em vez de um `var()`.
- Para um escopo de elemento, escreva `customCssDeclarations(scope.metrics)` no elemento.

## Frameworks

```tsx
// React
import { ScalingStrategyProvider, useScalingStrategy } from 'webdimens/react';
<ScalingStrategyProvider strategy={brand}><Card /></ScalingStrategyProvider>
function Card() { const s = useScalingStrategy(); return <div style={{ padding: s.dp(16), fontSize: s.sp(14) }} />; }
```

```ts
// Vue — provideScalingStrategy(brand) no pai; no filho:
const s = useScalingStrategy();      // s.dp(16) é reativo no template
const pad = useCdp(16, 'brand');     // ComputedRef<number>
// Svelte
const brandStore = scalingStrategy('brand');   // {$brandStore.dp(16)}
// Angular
providers: [provideScalingStrategy(brand)];  readonly s = injectScalingStrategy();  // s().dp(16)
```

## Classe de dispositivo na web

A classe de dispositivo é detectada nesta ordem:
1. **Modo de UI** (`tv`, `car`, `watch`, `desk` → `desktop`, `vr`), vindo das heurísticas do runtime ou da opção `uiModeType` do install.
2. **Ponteiro fino com hover** (mouse ou trackpad) → `desktop`.
3. **Tamanho**: `sw >= 600` → `tablet`, senão `phone`.

Você pode trocar essa lógica com `setDeviceClassResolver((metrics) => …)`. Regras por faixa de largura (`when: { width: { min: 1024 } }`) não dependem da detecção. Prefira-as quando só o tamanho importa.

## Depuração

```ts
console.log(brand.explain());
// [brand] tablet smallestWidth=800dp / ref 360 = 2.2222 -> logarithmic(0.4) = 1.3194 x 0.9 clamp[0.85, 1.6] => factor 1.1875 rules=[large, #1]
```

## Desempenho

- O fator é calculado **uma vez por snapshot e por estratégia** e memoizado, então `cdp(16, brand)` custa uma multiplicação.
- Limites de valor, `transform` e fórmulas não proporcionais acrescentam poucas operações por chamada. Uma fórmula `base * (…)` é uma multiplicação.
- As propriedades CSS só são reescritas quando o snapshot muda.
- Mantenha as funções `custom` e `transform` **puras**.
- `webdimens/custom` não tem efeitos colaterais na importação e é eliminado pelo tree-shaking quando não é usado.

## Paridade

Todas as plataformas rodam a mesma fixture (`tests/fixtures/custom-strategy-fixture.json`, gerada pelo motor Kotlin de referência). Fatores, px e tamanhos de texto coincidem dentro de uma tolerância relativa de 1e-4.
