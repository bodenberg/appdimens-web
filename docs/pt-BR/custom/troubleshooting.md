# Solução de problemas

> **Idiomas:** [English](../../custom/troubleshooting.md) · Português (BR)

## Veja o que uma estratégia faz

```ts
console.log(brand.explain());                 // viewport atual
console.log(brand.explain(scope.metrics));    // um escopo por elemento
console.log(brand.resolveScreen(screenSnapshot({ widthDp: 1280, heightDp: 800, device: 'tablet' })).explain('brand'));
```

```
[brand] tablet smallestWidth=800dp / ref 360 = 2.2222 -> logarithmic(0.4) = 1.3194 x 0.9 clamp[0.85, 1.6] => factor 1.1875 rules=[large, #1]
[hud] phone smallestWidth=411dp / ref 300 = 1.37 -> linear = 1.37 => factor 1.37 then Formula(base * pow(sw / 360, 0.8))
```

A linha se lê da esquerda para a direita: classe de dispositivo, valor do eixo e referência, a curva e seu resultado, multiplicador, proporção, limites, o fator final, as regras aplicadas e, quando houver, a fórmula ou o transform por valor. `factor()` retorna só o número. Nos frameworks, `useScalingStrategy().explain()` (e os equivalentes de Vue / Svelte / Angular) faz o mesmo.

## Erros comuns

| Mensagem | Causa | Correção |
|---|---|---|
| `SyntaxError: Invalid expression at 7: unknown variable 'sww' …` | erro de digitação numa fórmula em texto | use um nome da lista da mensagem, ou passe para uma [fórmula em código](code-formulas.md), que o verificador de tipos checa |
| `'clamp' takes 3 argument(s), got 2` | número errado de argumentos | veja a [tabela de funções](text-formulas.md#funções) |
| `RangeError: custom strategy produced a non-finite factor (NaN)` | divisão por zero, `ln` de 0, NaN vindo de uma função | proteja a fórmula (`max(x, 1)`) ou limite o fator |
| `<caminho> must be an object` / `must be a boolean` / `must be a finite number` | tipo errado no JSON | veja as [tabelas de campos](json.md#campos-da-estratégia) |
| `strategy: maxValue must be >= 0` | limite de valor negativo | limites de valor limitam a magnitude; use um número positivo |
| `strategy: minFactor must be <= maxFactor` | limites cruzados na declaração | inverta-os (limites cruzados produzidos por regras em tempo de execução deixam o máximo vencer) |
| `No scaling strategy 'x'. Registered: …` | id não registrado, ou erro de digitação em `cdp(16, 'x')` | registre, carregue o JSON antes, ou confira o id |
| `Custom curve functions cannot be encoded to JSON` · `transform functions cannot be encoded to JSON` | `toJSON()` em código | use a forma em texto para estratégias que você exporta |
| `strategy id must not be blank` | `id` vazio | dê um id à estratégia |

## Perguntas frequentes

**O resultado da minha função nunca muda.** O fator é memoizado por snapshot da janela. Uma função que lê estado mutável (uma configuração, a hora, o DOM) não roda de novo até o snapshot mudar. Use estratégias separadas e escolha uma, ou expresse a configuração como regra.

**`cdp(16, product)` e `sdp(16)` diferem.** Esperado: a referência padrão é 300 dp de menor largura; `ratio` é `sw / 300`. `base * ratio` (ou `BuiltInStrategies.SCALED`) dá exatamente `sdp`.

**`css()` retorna `"18.5px"` em vez de `calc(… var(…))`.** A estratégia depende do valor (`valueClamp`, `transform`, uma `scalingFormula` em código, ou uma fórmula em texto que não é `base * (…)`), então não pode ser um único fator. O valor em px é do viewport atual e não acompanha resizes; re-renderize, ou troque por um fator (`customScaleStrategy`, uma curva, `base * (…)`).

**`var(--cdp-x)` não está definida.** As variáveis são publicadas para estratégias registradas (`defineScalingStrategy`, `{ id }`, `loadScalingStrategies`), para fórmulas em texto compartilhadas e para estratégias `customScaleStrategy` de id automático quando `css()` roda. Uma estratégia criada com `register: false` ou uma variante `withAxis(…)` não é publicada: chame `registerScalingStrategy(s)` antes. Se o seu CSS só usa `16cdp` / `var(--cdp)`, chame `installCustomCss()` uma vez.

**Minha fórmula em texto está lenta / perde o caminho rápido.** Só `base * E` se qualifica. `base * sw / 360` é lida como `(base * sw) / 360`; escreva `base * (sw / 360)`.

**Meu notebook é detectado como `desktop`, não `tablet`.** Um ponteiro fino com hover conta como desktop. Use faixas de largura (`when: { width: { min: 1024 } }`) quando só o tamanho importa, ou `setDeviceClassResolver`.

**Uma estratégia criada num componente vaza.** `customScaleStrategy(…)` e `scalingFormula((s) => …)` criam uma estratégia nova a cada chamada. Declare no nível do módulo ou envolva em `useMemo`. Fórmulas em texto inline (`cdp(16, '…')`) são compartilhadas por texto e não têm problema.

**As fontes ignoram minha estratégia.** `csp` segue o tamanho de texto do navegador por padrão. Use `fontScale: 'ignore'` para texto fixo, ou `fontScale: { max }` para limitar.

**O que acontece no SSR?** Sem DOM, a estratégia resolve contra o snapshot padrão (ou um fixado com `setMetrics`); `css()` retorna `calc(… var(--cdp-<id>))`, que o navegador resolve depois da hidratação. Veja [SSR](../ssr.md).

**Os números são os mesmos no Android / iOS / Flutter?** Sim para tudo que pode ser escrito em JSON (curvas, regras, fórmulas em texto): uma fixture compartilhada de 540 casos verifica todas as plataformas (`tests/fixtures/custom-strategy-fixture.json`). Funções em código rodam o seu próprio código, então batem enquanto o código bater.

[Voltar à documentação de estratégias personalizadas](README.md)
