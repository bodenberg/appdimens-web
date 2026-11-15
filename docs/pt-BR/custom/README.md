# Estratégias personalizadas: documentação

> **Idiomas:** [English](../../custom/README.md) · Português (BR)

**Entrada:** `webdimens/custom` (bundle CDN: `WebDimens.*`) · helpers de framework em `webdimens/react`, `webdimens/vue`, `webdimens/svelte`, `webdimens/angular` · variáveis CSS `--cdp-<id>` / `--csp-<id>` · literais `16cdp-<id>` em `dimens()` e PostCSS

As 12 estratégias embutidas (`sdp`, `pwsdp`, `asdp`…) atendem a maioria dos sites. Quando o seu precisa de uma lei de crescimento **própria**, este módulo deixa você escrevê-la, numa linha de TypeScript ou como uma configuração completa compartilhada via JSON com todas as plataformas AppDimens (Android, KMP, iOS, Flutter, React Native, Web, Games, .NET).

## Escolha a forma

| Você quer… | Use | Leia |
|---|---|---|
| Escrever a conta você mesmo, em TypeScript, com autocompletar | `customScaleStrategy(({ width, clamp }) => clamp(width / 360, 0.85, 1.8))` (fator) · `scalingFormula(({ base, sw, pow }) => base * pow(sw / 360, 0.8))` (valor) | [Início rápido](quick-start.md) · [Fórmulas em código](code-formulas.md) |
| Manter a fórmula em JSON ou config remota | `scalingFormula('base * pow(sw / 360, 0.8)')` · `cdp(16, '…')` | [Fórmulas em texto](text-formulas.md) |
| Comportamento diferente por dispositivo, faixa de tela ou orientação, limites, política de escala de fonte | `defineScalingStrategy({ id: 'brand', … })` | [Configuração](configuration.md) |
| Compartilhar uma definição entre apps e plataformas | um arquivo JSON de estratégias | [Formato JSON](json.md) |

## Guias

1. [Início rápido](quick-start.md): instalação, as quatro formas e sua primeira estratégia em cinco minutos.
2. [Fórmulas em código](code-formulas.md): `customScaleStrategy(…)` e `scalingFormula(…)`, com todos os nomes disponíveis no escopo.
3. [Fórmulas em texto](text-formulas.md): a linguagem de fórmulas (operadores, funções, variáveis, erros, caminho rápido).
4. [Configuração](configuration.md): referência, eixos, curvas, limites, proporção, escala de fonte, multijanela, regras, `extend`, embutidas e presets.
5. [Formato JSON](json.md): o documento multiplataforma, carregamento, exportação e erros de validação.
6. [Referência da API](api-reference.md): todas as funções de `webdimens/custom`, as variáveis CSS e literais, os helpers de React / Vue / Svelte / Angular e os helpers de depuração.
7. [Desempenho](performance.md): o custo de cada forma, memoização e o caminho das variáveis CSS.
8. [Receitas](cookbook.md): estratégias prontas (tablets, TV, relógio, HUD de jogo, texto legível, testes A/B).
9. [Solução de problemas](troubleshooting.md): mensagens de erro, `explain()` e perguntas frequentes.

## Como funciona, numa imagem

```
ratio  = axis(janela) / axis(referência)                 // ex.: sw / 300
factor = clamp( curve(ratio) × multiplier × AR , min, max )   // uma vez por snapshot da janela
scaled = valueClamp( base × factor )   // o resultado configurado
value  = formula ? formula(base, scaled, factor) : scaled   // a fórmula substitui o resultado (recebe o base original)
```

`customScaleStrategy(…)` substitui a linha `factor` inteira. `scalingFormula(…)` substitui a linha `value` inteira. A configuração completa permite definir cada peça e mudá-la por dispositivo com regras. Valores são dp, que na web são px CSS. Os números são os mesmos em todas as plataformas AppDimens: uma fixture compartilhada de 540 casos verifica isso (`tests/fixtures/custom-strategy-fixture.json`).

[Voltar ao índice da documentação](../README.md) · [Página de visão geral](../custom.md)
