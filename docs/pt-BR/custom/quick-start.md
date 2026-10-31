# Início rápido

> **Idiomas:** [English](../../custom/quick-start.md) · Português (BR)

## 1. Instalar

```bash
npm i webdimens
```

```ts
import { cdp, cdpPx, csp, cdpCss, customScaleStrategy, scalingFormula, defineScalingStrategy } from 'webdimens/custom';
```

Sem bundler, o script da CDN (`https://cdn.jsdelivr.net/npm/webdimens@3/dist/webdimens.global.js`) expõe as mesmas funções em `window.WebDimens` (`WebDimens.customScaleStrategy(…)`).

## 2. Escreva a conta (recomendado)

Declare a estratégia **uma vez** (no nível do módulo) e use em qualquer lugar.

```ts
// Fator: o número que multiplica todo valor
const product = customScaleStrategy(({ width, clamp }) => clamp(width / 360, 0.85, 1.8));

// Fórmula: o valor final (`base` = o valor passado, o 16 em cdp(16, hud))
const hud = scalingFormula(({ base, sw, pow }) => base * pow(sw / 360, 0.8));
```

A função recebe um escopo tipado (`ScreenScope` / `FormulaScope`): o editor autocompleta `width`, `sw`, `height`, `ratio`, `tablet`, `tv`, `landscape`, `pow`, `clamp`, `min`, `max`, `lerp`… e um erro de digitação vira erro de tipo. Qualquer outro código também funciona (`Math.*`, `switch`, seus helpers). A lista completa está em [Fórmulas em código](code-formulas.md).

## 3. Use

```ts
cdp(16, product);          // px CSS para o viewport atual
csp(18, hud);              // texto, segue a escala de fonte do usuário
cdpPx(24, product);        // px de dispositivo (× devicePixelRatio), para canvas / WebGL
product.css(16);           // "calc(16 * var(--cdp-scale_1))": CSS responsivo, sem re-render
```

```tsx
// React
import { useScalingStrategy } from 'webdimens/react';
function Card() {
  const s = useScalingStrategy(product);
  return <div style={{ padding: s.dp(16), fontSize: s.sp(14) }} />;
}
```

Passe `{ id: 'product' }` para registrar uma estratégia com um nome: `cdp(16, 'product')` passa a encontrá-la, o runtime publica `--cdp-product` e o literal `16cdp-product` funciona em `dimens()` e no PostCSS.

## 4. Torne padrão (opcional)

```ts
import { setDefaultScalingStrategy } from 'webdimens/custom';
setDefaultScalingStrategy(product);   // no app todo: cdp(16), 16cdp e var(--cdp) passam a usar product
```

```tsx
import { ScalingStrategyProvider } from 'webdimens/react';
<ScalingStrategyProvider strategy={hud}><Hud /></ScalingStrategyProvider>   // uma subárvore
```

Vue, Svelte e Angular têm os mesmos helpers: veja a [Referência da API](api-reference.md#helpers-de-framework).

## 5. O mesmo em texto (para JSON e config remota)

```ts
const remote = scalingFormula('base * pow(sw / 360, 0.8)');
cdp(16, 'base * (sw / 360)');                // inline, compartilhada por texto
cdpCss(16, 'base * (sw / 360)');             // "calc(16 * var(--cdp-formula-…))"
```

Uma string passada como estratégia é primeiro um **id** de estratégia; quando nenhuma estratégia tem esse id, ela é lida como fórmula. A forma em texto usa os mesmos nomes (flags valem 1 ou 0) e funciona no JSON de estratégias (`{"id": "hud", "formula": "base * pow(sw / 360, 0.8)"}`). Veja [Fórmulas em texto](text-formulas.md).

## 6. Precisa de mais estrutura?

Regras por classe de dispositivo, limites do fator, um teto de escala de fonte ou outra referência ficam na configuração completa:

```ts
const brand = defineScalingStrategy({
  id: 'brand',
  reference: { width: 360, height: 640 },
  curve: { type: 'power', exponent: 0.8 },
  clamp: { min: 0.85, max: 1.6 },
  fontScale: { max: 1.3 },
  rules: [{ when: { device: ['tablet', 'desktop'] }, set: { curve: { type: 'logarithmic', k: 0.4 } } }],
});
```

```css
.card { padding: 16cdp-brand; font-size: 14csp-brand; }   /* PostCSS → calc(16 * var(--cdp-brand)) */
```

Veja [Configuração](configuration.md) e [Formato JSON](json.md).

## 7. Confira os números

```ts
console.log(product.explain());
// [scale#1] phone smallestWidth=411dp / ref 300 = 1.37 -> custom = 1.1417 => factor 1.1417
```

[Voltar à documentação de estratégias personalizadas](README.md)
