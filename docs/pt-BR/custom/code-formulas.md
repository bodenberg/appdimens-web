# Fórmulas em código

> **Idiomas:** [English](../../custom/code-formulas.md) · Português (BR)

Duas entradas de uma linha deixam você escrever a conta de escala em TypeScript comum. A função recebe um **escopo** tipado cujos nomes são os mesmos da [linguagem em texto](text-formulas.md), então você aprende uma vez só. O editor autocompleta os nomes, e um erro de digitação vira erro de tipo. Todo membro é uma propriedade simples, então a desestruturação funciona.

| | `customScaleStrategy((s) => …)` | `scalingFormula((s) => …)` |
|---|---|---|
| Você retorna | o **fator** (todo valor é multiplicado por ele) | o **valor final** |
| Escopo | `ScreenScope` | `FormulaScope` (= `ScreenScope` + `base`) |
| Executa | uma vez por snapshot da janela (memoizado) | a cada chamada (`cdp`, `dp`, `sp`…) |
| Custo por valor | uma multiplicação | a sua função |
| `css()` | continua variável CSS (`calc(16 * var(--cdp-…))`) | literal em px do viewport atual |
| JSON | não (use uma curva `expression` em texto) | não (use uma `formula` em texto) |

## `customScaleStrategy(…)`: fator programável

```ts
import { customScaleStrategy } from 'webdimens/custom';

const product = customScaleStrategy(({ width, clamp }) => clamp(width / 360, 0.85, 1.8));
const living = customScaleStrategy(({ tv, height, ratio }) => (tv ? height / 540 : ratio));
const steps = customScaleStrategy(({ sw }) => {
  if (sw < 360) return 0.9;
  if (sw < 600) return sw / 400;
  return 1.5 + (sw - 600) / 2000;
});
```

- Assinatura: `customScaleStrategy(factor: (scope: ScreenScope) => number, options?: { id?: string; register?: boolean }): ScalingStrategy`.
- Sem `id`, um id único `scale#N` é gerado e a estratégia não é registrada (a variável CSS dela ainda é publicada na primeira chamada de `css()`). Com um id ela é registrada por padrão, então `cdp(16, 'product')` e `16cdp-product` a encontram. `register` tem como padrão `id !== undefined`.
- Um fator não finito (NaN, infinito) lança `RangeError: custom strategy produced a non-finite factor (NaN)` quando a janela é resolvida.

## `scalingFormula(…)`: o valor final

```ts
import { scalingFormula } from 'webdimens/custom';

const hud = scalingFormula(({ base, sw, pow }) => base * pow(sw / 360, 0.8));
const card = scalingFormula(({ base, tablet, ratio }) => (tablet ? base * 1.2 : base * ratio));
const snap = scalingFormula(({ base, sw, round }) => round((base * sw) / 360));   // só px inteiros
const floor = scalingFormula(({ base, ratio, max }) => max(base * ratio, base));  // nunca menor que o valor de design
```

- Assinatura: `scalingFormula(formula: string | ((scope: FormulaScope) => number), options?: { id?: string; register?: boolean }): ScalingStrategy`. Uma string é uma [fórmula em texto](text-formulas.md).
- `base` é o valor passado: em `cdp(16, hud)` é `16`. Em `csp`, o resultado depois segue a escala de fonte do usuário (veja [escala de fonte](configuration.md#escala-de-fonte-csp)).
- Sem `id`, um id único `formula#N` é gerado.
- Uma fórmula em código sempre depende do valor, então `hud.css(16)` retorna o literal em px do viewport atual em vez de uma variável CSS. Quando a conta é `base × (algo da tela)`, use `customScaleStrategy` e mantenha a variável CSS.

## Nomes no escopo

| Nome | Tipo | Significado |
|---|---|---|
| `base` | `number` | o valor sendo escalado (só em `scalingFormula`) |
| `sw` | `number` | menor largura da janela (dp = px CSS) |
| `width` · `height` | `number` | largura · altura da janela |
| `shortSide` · `longSide` | `number` | lado menor · maior |
| `diagonal` · `perimeter` | `number` | `√(w² + h²)` · `w + h` |
| `aspectRatio` | `number` | `longSide / shortSide` |
| `ratio` | `number` | `sw / 300`, a razão que o `sdp` usa (`base * ratio` é exatamente `sdp`) |
| `density` · `fontScale` | `number` | `devicePixelRatio` · escala de fonte do usuário |
| `phone` `tablet` `desktop` `tv` `watch` `car` `vr` | `boolean` | classe de dispositivo da janela |
| `landscape` · `portrait` · `multiWindow` | `boolean` | orientação · janela dividida / não maximizada |
| `device` | `DeviceClass` | a própria classe (`'phone'`, `'tablet'`…), para `switch` |
| `screen` | `ScreenSnapshot` | o snapshot inteiro (`widthDp`, `heightDp`, `smallestWidthDp`, `isLandscape`…) |
| `pow(x, e)` `sqrt` `ln` `log10` `exp` `abs` | `(…) => number` | matemática |
| `round(x)` | `(x) => number` | metade para cima: `floor(x + 0.5)`, como na linguagem em texto (difere de `Math.round` em negativos) |
| `min(…)` `max(…)` `clamp(x, lo, hi)` | `(…) => number` | limites |
| `lerp(a, b, t)` · `smoothstep(e0, e1, x)` | `(…) => number` | interpolação |

Os tipos do escopo são exportados (`ScreenScope`, `FormulaScope`), e `screenScope(screen)` / `formulaScope(screen, base)` constroem um à mão para testes. A classe de dispositivo vem do runtime: primeiro o modo de UI, depois um ponteiro fino com hover (`desktop`), depois `sw ≥ 600` (`tablet`). Veja [Classe de dispositivo](configuration.md#classe-de-dispositivo-na-web).

## Regras para a função

- **Mantenha pura.** Ela não deve ler estado mutável, configurações, `Date.now()` nem o DOM: o fator é memoizado por snapshot da janela. Use outra estratégia (ou uma regra) para outro estado.
- **Declare uma vez.** Cada chamada de `customScaleStrategy(…)` ou `scalingFormula(…)` cria uma estratégia nova com id e memo próprios. Use uma `const` no nível do módulo, nunca uma função nova a cada render do React ou num `setup` do Vue que roda por instância (ou envolva em `useMemo`).
- **Cuidado com sombreamento.** Com desestruturação você escolhe os nomes que lê; uma variável sua com o nome de um membro do escopo (`const tv = …`) é outro valor.
- **Prefira a forma de fator quando der.** Se a fórmula é `base × (algo da tela)`, escreva esse algo como `customScaleStrategy`: custa uma multiplicação e `css()` continua variável CSS.

## Quando usar outra coisa

- A fórmula precisa morar em JSON, num arquivo de design tokens ou em config remota: [Fórmulas em texto](text-formulas.md).
- Você precisa de regras por dispositivo, limites ou uma política de escala de fonte sobre uma curva: [Configuração](configuration.md). Uma configuração também aceita código: `curve: { type: 'custom', fn: (ratio, screen) => … }` e `transform: (base, scaled, screen) => …`.

[Voltar à documentação de estratégias personalizadas](README.md)
