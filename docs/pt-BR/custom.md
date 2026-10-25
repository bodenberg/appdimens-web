# Estratégias personalizadas

> **Idiomas:** [English](../custom.md) · Português (BR)

**Entrada:** `webdimens/custom` · helpers de React / Vue / Svelte / Angular em `webdimens/react`, `webdimens/vue`, `webdimens/svelte`, `webdimens/angular` · **[Documentação completa de estratégias personalizadas](./custom/README.md)**

As 12 estratégias embutidas atendem a maioria dos sites. Quando um app (ou um design system compartilhado por vários apps) precisa de uma lei de crescimento **própria**, este módulo deixa você escrevê-la. É o port web do módulo Android `appdimens-dynamic-custom`. A forma mais simples é uma linha de TypeScript tipado; a forma completa é uma configuração que carrega de JSON em todas as plataformas AppDimens (Android, KMP, iOS, Flutter, React Native, Web, Games, .NET) com os mesmos números.

```ts
import { cdp, csp, customScaleStrategy, scalingFormula, defineScalingStrategy } from 'webdimens/custom';

// Fator: o número que multiplica todo valor
const product = customScaleStrategy(({ width, clamp }) => clamp(width / 360, 0.85, 1.8));
// Fórmula: o valor final (base = o 16 em cdp(16, hud))
const hud = scalingFormula(({ base, sw, pow }) => base * pow(sw / 360, 0.8));
// Texto, para JSON e config remota
const remote = scalingFormula('base * pow(sw / 360, 0.8)');
// Configuração completa com regras
const brand = defineScalingStrategy({
  id: 'brand',
  reference: { width: 360, height: 640 },
  curve: { type: 'power', exponent: 0.8 },
  clamp: { min: 0.85, max: 1.6 },
  rules: [{ when: { device: ['tablet', 'desktop'] }, set: { curve: { type: 'logarithmic', k: 0.4 } } }],
});

cdp(16, product);          // px CSS
csp(18, hud);              // texto, segue a escala de fonte do usuário
brand.css(16);             // "calc(16 * var(--cdp-brand))": responsivo, sem re-render, seguro em SSR
```

```css
.card { padding: 8cdp-brand 16cdp-brand; font-size: 14csp-brand; }   /* PostCSS / dimens() */
```

## Documentação

| Guia | O que cobre |
|---|---|
| [Visão geral](./custom/README.md) | qual forma escolher, como as peças se encaixam |
| [Início rápido](./custom/quick-start.md) | instalação e primeira estratégia em cinco minutos |
| [Fórmulas em código](./custom/code-formulas.md) | `customScaleStrategy(…)`, `scalingFormula(…)` e todos os nomes do escopo |
| [Fórmulas em texto](./custom/text-formulas.md) | a linguagem de fórmulas: operadores, funções, variáveis, erros, caminho rápido |
| [Configuração](./custom/configuration.md) | referência, eixos, curvas, limites, proporção, escala de fonte, multijanela, regras, classe de dispositivo, `extend`, embutidas, presets |
| [Formato JSON](./custom/json.md) | o documento multiplataforma, carregamento, exportação, validação |
| [Referência da API](./custom/api-reference.md) | funções, registro, variáveis CSS e literais, helpers de framework, motor |
| [Desempenho](./custom/performance.md) | o custo de cada forma, memoização, variáveis CSS |
| [Receitas](./custom/cookbook.md) | tablets, TV, relógio, HUD de jogo, texto legível, testes A/B |
| [Solução de problemas](./custom/troubleshooting.md) | mensagens de erro, `explain()`, perguntas frequentes |

## Quando usar

- Um design system compartilhado por vários apps que precisa de uma lei de crescimento única.
- Um produto cuja UI deve se comportar diferente por classe de dispositivo ou faixa de largura: TV, relógio, tablet, desktop.
- Experimentos de config remota ou A/B na escala, publicando um JSON novo.
- Embutidas que chegam perto, mas precisam de outra referência, expoente ou limites.

## Compromissos

- Estratégias que dependem do valor (`valueClamp`, `scalingFormula` em código, `transform`, fórmulas em texto que não são `base * (…)`) não cabem numa única variável CSS: `css()` retorna um literal em px do viewport atual.
- Funções em código não podem ser exportadas para JSON; os equivalentes em texto podem.
- A correção de proporção sempre usa a lei satélite (`× (1 + k·ln(AR/1.78))`).

Paridade: todas as plataformas rodam a mesma fixture (`tests/fixtures/custom-strategy-fixture.json`, gerada pelo motor de referência em Kotlin). Fatores, px e tamanhos de texto batem com tolerância relativa de 1e-4.

[Voltar ao índice da documentação](./README.md)
