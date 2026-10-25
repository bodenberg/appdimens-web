# Fórmulas em texto

> **Idiomas:** [English](../../custom/text-formulas.md) · Português (BR)

Uma fórmula em texto é a mesma conta de uma [fórmula em código](code-formulas.md), escrita como string. Use quando a fórmula precisa morar fora do código: no JSON de estratégias, num arquivo de design tokens, em config remota ou num teste A/B. A linguagem é idêntica em todas as plataformas AppDimens e dá os mesmos números. Ela é lida por um parser pequeno e seguro (sem `eval`).

```ts
import { cdp, cdpCss, scalingFormula, getFormulaScalingStrategy, ScalingExpression } from 'webdimens/custom';

const hud = scalingFormula('base * pow(sw / 360, 0.8)');     // estratégia (compartilhada por texto)
cdp(16, 'base * (tablet ? 0.9 : 1)');                         // inline, px CSS
cdpCss(16, 'base * (sw / 360)');                              // "calc(16 * var(--cdp-formula-…))"
getFormulaScalingStrategy('base * ratio');                    // a estratégia compartilhada de um texto
ScalingExpression.parse('pow(ratio, 0.8)');                   // só parse / validação
```

Uma string passada como estratégia (`cdp(16, '…')`, `useScalingStrategy('…')`, `setDefaultScalingStrategy('…')`) é primeiro um **id** de estratégia; quando nenhuma estratégia tem esse id, é lida como fórmula. Um nome solto que não é nem um nem outro (`cdp(16, 'brnd')`) falha como id desconhecido.

Dentro de uma configuração completa, o texto aparece em dois lugares:

| Onde | Spec / JSON | Retorna | Variáveis extras |
|---|---|---|---|
| Curva | `curve: { type: 'expression', expression: '…' }` | o **fator** | `ratio axis ref refWidth refHeight` |
| Fórmula | `formula: '…'` | o **valor final** | as variáveis da curva + `base scaled factor` |

`scalingFormula('…')` e `cdp(16, '…')` constroem uma estratégia cuja única configuração é uma fórmula.

## Linguagem

| | |
|---|---|
| Números | `16`, `0.8`, `.5`, `1.5e3` |
| Aritmética | `+ - * / %` e `^` (potência). `%` mantém o sinal do dividendo |
| Comparação | `== != < <= > >=` (resultado 1 ou 0) |
| Lógica | `&& \|\| !` (diferente de zero é verdadeiro) |
| Condicional | `cond ? a : b` |
| Agrupamento | `( … )` |
| Constantes | `pi`, `e`, `true` (1), `false` (0) |

**Precedência**, da mais fraca para a mais forte: `? :` · `\|\|` · `&&` · comparações · `+ -` · `* / %` · unários `- + !` · `^`. `^` associa à direita (`2 ^ 3 ^ 2` = 512), e o menos unário liga mais fraco que `^` (`-2 ^ 2` = −4).

### Funções

| Função | Resultado |
|---|---|
| `min(a, b, …)` · `max(a, b, …)` | menor · maior argumento |
| `clamp(x, lo, hi)` | `x` limitado a `[lo, hi]` |
| `pow(x, y)` · `sqrt(x)` · `exp(x)` | potência · raiz quadrada · eˣ |
| `ln(x)` = `log(x)` · `log10(x)` · `log2(x)` | logaritmos |
| `abs(x)` · `sign(x)` | valor absoluto · −1, 0 ou 1 |
| `floor(x)` · `ceil(x)` · `round(x)` | arredondamento (`round` é metade para cima: `floor(x + 0.5)`) |
| `lerp(a, b, t)` | `a + (b − a)·t` |
| `step(edge, x)` | 0 se `x < edge`, senão 1 |
| `smoothstep(e0, e1, x)` | 0→1 suave entre `e0` e `e1` |

### Variáveis

| Variáveis | Significado |
|---|---|
| `sw` `width` `height` `shortSide` `longSide` `diagonal` `perimeter` | medidas da janela (dp = px CSS) |
| `aspectRatio` `density` `fontScale` | lado longo/curto · `devicePixelRatio` · escala de fonte do usuário |
| `phone` `tablet` `desktop` `tv` `watch` `car` `vr` | flags da classe de dispositivo (1/0) |
| `landscape` `portrait` `multiWindow` | flags de orientação e janela dividida (1/0) |
| `ratio` | eixo / referência (com os padrões: `sw / 300`, a razão do `sdp`) |
| `axis` · `ref` · `refWidth` · `refHeight` | valor do eixo · valor de referência · quadro de referência (dp) |
| `base` | o valor passado (só em fórmulas) |
| `scaled` | `base × factor` depois dos limites de valor (só em fórmulas) |
| `factor` | o fator da estratégia (só em fórmulas) |

As listas são exportadas como `SCREEN_VARIABLES`, `CURVE_VARIABLES` e `FORMULA_VARIABLES`. `scaled` e `factor` permitem pós-processar a estratégia configurada: `formula: 'max(scaled, base)'` nunca fica abaixo do valor de design, e `formula: 'round(scaled)'` arredonda para px inteiros.

## Erros

A fórmula é lida quando a estratégia é criada, então erros falham na hora com um `SyntaxError` que dá a posição:

```
Invalid expression at 7: unknown variable 'sww' (allowed: aspectRatio, axis, base, car, …) in "base * sww"
Invalid expression at 0: 'clamp' takes 3 argument(s), got 2 in "clamp(base, 1)"
```

No JSON a mensagem também traz o caminho, por exemplo `brand.rules[0].set.curve.expression: Invalid expression at …`. Um fator que sai NaN ou infinito (por exemplo, uma divisão por zero) lança `RangeError` quando a janela é resolvida.

## Caminho rápido

Uma fórmula no formato `base`, `base * E` ou `E * base`, em que `E` não lê `base`, `scaled` nem `factor`, depende só da tela. O AppDimens calcula `E` uma vez por janela, então cada valor custa uma multiplicação, o resultado é idêntico bit a bit ao cálculo por valor, e `css()` continua variável CSS (`calc(16 * var(--cdp-…))`). Qualquer outro formato também funciona; é calculado por valor, e `css()` retorna o literal em px do viewport atual.

| Fórmula | Caminho rápido |
|---|---|
| `base * pow(sw / 360, 0.8)` | sim |
| `base * (sw / 360)` | sim |
| `(tablet ? 0.9 : 1) * base` | sim |
| `base * sw / 360` | não: é lida como `(base * sw) / 360`. Use parênteses: `base * (sw / 360)` |
| `base + 2`, `round(base * ratio)` | não (são de fato por valor) |

## Compartilhamento

Sem id, `scalingFormula('…')`, `getFormulaScalingStrategy('…')` e `cdp(16, '…')` compartilham uma estratégia por texto (id `formula:<texto>`, não registrada; variável CSS `--cdp-formula-<hash>`), então são baratas dentro de uma função de render. Até 256 textos diferentes são compartilhados; além disso, uma estratégia nova é criada a cada chamada (continua correta, mas é lida de novo a cada vez). Passe um `id` (`scalingFormula('…', { id: 'hud' })`) para ter uma estratégia registrada sua, `--cdp-hud` e o literal `16cdp-hud`.

[Voltar à documentação de estratégias personalizadas](README.md)
