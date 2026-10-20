# Estratégias personalizadas

`webdimens/custom` permite **definir sua própria estratégia de escala**, sem precisar escolher uma das 12 embutidas. É o port web do módulo Android `appdimens-dynamic-custom`, e a configuração usa o **mesmo JSON em todas as plataformas AppDimens** (Android, KMP, iOS, Flutter, React Native, Web, Games, .NET).

> **Idiomas:** [English](../custom.md) · Português (BR)

## O que é uma estratégia

Uma estratégia é um objeto simples que transforma a janela atual (viewport ou [escopo de elemento](./runtime.md)) em um único **fator**:

```
razão  = eixo(janela) / eixo(referência)
fator  = clamp( curva(razão) × multiplicador × AR , clamp.min, clamp.max )
px     = transform( valueClamp( valor × fator ) )
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
| `{ type: 'custom', fn: (ratio, screen) => … }` | sua fórmula pura (só código) |

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
- Estratégias com `valueClamp` ou `transform` dependem do valor, então `brand.css(v)` devolve um literal em px do snapshot atual em vez de um `var()`.
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
- Limites de valor e `transform` acrescentam poucas operações por chamada.
- As propriedades CSS só são reescritas quando o snapshot muda.
- Mantenha as funções `custom` e `transform` **puras**.
- `webdimens/custom` não tem efeitos colaterais na importação e é eliminado pelo tree-shaking quando não é usado.

## Paridade

Todas as plataformas rodam a mesma fixture (`tests/fixtures/custom-strategy-fixture.json`, gerada pelo motor Kotlin de referência). Fatores, px e tamanhos de texto coincidem dentro de uma tolerância relativa de 1e-4.
