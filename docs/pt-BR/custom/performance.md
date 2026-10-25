# Desempenho

> **Idiomas:** [English](../../custom/performance.md) · Português (BR)

Estratégias personalizadas custam o mesmo que as embutidas quando dependem só da tela. A forma escolhida decide a faixa.

| Forma | Por snapshot da janela | Por valor | `css()` |
|---|---|---|---|
| `customScaleStrategy(…)`, qualquer curva, regras, limites do fator, proporção | função / curva uma vez | uma multiplicação | variável CSS |
| fórmula em texto no formato `base * E` (E não lê o valor) | `E` uma vez | uma multiplicação | variável CSS |
| `scalingFormula((s) => …)`, outras fórmulas em texto, `transform`, `valueClamp` | | fórmula / função a cada chamada | literal em px do viewport atual |

## Como funciona

- **Memo por snapshot.** Cada estratégia guarda o último snapshot resolvido (regras aplicadas, fator calculado). Um snapshot novo (resize, rotação, escala de fonte, modo de UI, multijanela) resolve de novo uma vez. `resolveScreen(screen)` não é memoizado.
- **Uma multiplicação.** Uma estratégia só de tela transforma `cdp(16, product)` numa checagem de memo mais uma multiplicação.
- **Faixa dependente do valor.** Limites de valor, fórmulas em código, transforms e fórmulas em texto não proporcionais adicionam algumas operações por chamada; não há cache por valor na web, o cálculo é feito a cada vez.
- **Variáveis CSS.** `--cdp-<id>` / `--csp-<id>` só são reescritas quando o snapshot muda (no máximo uma vez por frame). Layout escrito como `brand.css(16)` ou `16cdp-brand` acompanha o viewport sem JavaScript por valor e sem re-render, que é o caminho mais barato.
- **Caminho rápido para texto.** `base * E` é detectado quando a fórmula é lida; o resultado é idêntico bit a bit ao cálculo por valor.
- **Tree-shaking.** `webdimens/custom` não tem efeitos colaterais na importação; o publicador de CSS e o resolvedor de literais começam no primeiro registro, troca de padrão ou chamada de `css()`.

## Recomendações

1. Prefira um fator (`customScaleStrategy`, uma curva, regras) a uma fórmula por valor quando a conta é "base × algo da tela".
2. Prefira CSS (`s.css(16)`, `16cdp-brand`, `var(--cdp-brand)`) para layout; use os números de `cdp()` para canvas e medições.
3. Use `valueClamp` só para limites absolutos reais (alvos de toque ≥ 48 px, tamanho máximo de texto).
4. Declare as estratégias uma vez: uma `const` no nível do módulo, um módulo `strategies.ts`, ou um documento JSON carregado na inicialização.
5. Mantenha as funções puras e baratas. Funções de fator rodam uma vez por snapshot; funções de fórmula rodam a cada chamada.
6. Fórmulas em texto inline (`cdp(16, '…')`) são compartilhadas por texto, então podem ficar em funções de render. Criar estratégias a partir de strings dinâmicas num laço não: depois de 256 textos distintos, cada chamada lê uma estratégia nova.

[Voltar à documentação de estratégias personalizadas](README.md)
