# Referência da API

> **Idiomas:** [English](../../custom/api-reference.md) · Português (BR)

Tudo abaixo é exportado por `webdimens/custom` (e fica em `window.WebDimens` no bundle CDN), salvo quando outra entrada é indicada. Valores são dp, que são px CSS; resultados `…Px` são px de dispositivo (× `devicePixelRatio`).

## Criando estratégias

| Função | Retorna | Notas |
|---|---|---|
| `customScaleStrategy(fn, { id?, register? })` | `ScalingStrategy` | fator programável, argumento `ScreenScope` ([fórmulas em código](code-formulas.md)) |
| `scalingFormula(fn, { id?, register? })` | `ScalingStrategy` | fórmula em código, argumento `FormulaScope` |
| `scalingFormula('texto', { id?, register? })` | `ScalingStrategy` | fórmula em texto, compartilhada por texto sem id ([fórmulas em texto](text-formulas.md)) |
| `getFormulaScalingStrategy('texto')` | `ScalingStrategy` | a estratégia compartilhada de uma fórmula em texto |
| `defineScalingStrategy(spec, { register? })` | `ScalingStrategy` | configuração completa, registrada por padrão ([configuração](configuration.md)) |
| `strategy.extend(id, patch?, { register? })` | `ScalingStrategy` | filha de uma estratégia existente, registrada por padrão |
| `strategy.withAxis(axis)` | `ScalingStrategy` | a mesma estratégia em outro eixo, id `"<id>@<axis>"`, em cache por instância |
| `new ScalingStrategy(id, config)` | `ScalingStrategy` | envolve um `ScalingConfig` normalizado (ex.: de `configFromSpec`) |
| `BuiltInStrategies.SCALED` … `FIXED` · `CustomPresets.TV_SAFE` … | `ScalingStrategy` | pais prontos |

## Registro

| Função | Notas |
|---|---|
| `getDefaultScalingStrategy()` | estratégia usada por `cdp(16)` / `csp(14)` / `16cdp` sem id; inicialmente `BuiltInStrategies.SCALED` |
| `setDefaultScalingStrategy(s \| id \| texto \| null)` | troca a padrão (`null` volta para `SCALED`) |
| `registerScalingStrategy(s)` · `unregisterScalingStrategy(id)` | adiciona ou substitui · remove |
| `getScalingStrategy(id)` · `requireScalingStrategy(id)` | busca, incluindo embutidas e presets; `require…` lança `No scaling strategy 'x'. Registered: …` |
| `registeredScalingStrategies()` | estratégias registradas pelo app |
| `pickScalingStrategy(s?)` | resolve uma instância, um id, uma fórmula em texto ou a padrão |
| `loadScalingStrategies(json)` | registra um [documento JSON](json.md) e aplica o `default` dele; atômico |
| `exportScalingStrategies(lista?)` | documento JSON das estratégias registradas |

## Funções curtas

| Chamada | Retorna |
|---|---|
| `cdp(16, s?)` | px CSS |
| `cdpPx(16, s?)` | px de dispositivo |
| `csp(14, s?)` | px CSS para texto (política de escala de fonte aplicada) |
| `cspPx(14, s?)` | px de dispositivo para texto |
| `cdpCss(16, s?)` · `cspCss(14, s?)` | CSS responsivo: `calc(16 * var(--cdp-<id>))`, ou `var(--cdp)` / `var(--csp)` para a padrão |

`s` é uma `ScalingStrategy`, um id registrado / embutido / de preset ou uma fórmula em texto. Sem ele, a estratégia padrão é usada.

## Membros da estratégia (`ScalingStrategy`)

| Membro | Notas |
|---|---|
| `id` · `config` · `valueDependent` | identidade · config normalizada · se o resultado depende do valor (aí `css()` retorna px) |
| `cssVar` · `cssSpVar` | `--cdp-<id>` · `--csp-<id>` |
| `dp(v, metrics?)` · `px(v, metrics?)` | px CSS · px de dispositivo |
| `sp(v, metrics?)` · `spPx(v, metrics?)` | texto, px CSS · px de dispositivo |
| `css(v)` · `cssSp(v)` | `calc(v * var(--cdp-<id>))` · `calc(v * var(--csp-<id>))` |
| `factor(metrics?)` · `explain(metrics?)` | depuração |
| `resolve(metrics?)` → `ResolvedScaling` | memoizado por snapshot: `factor`, `appliedRules`, `valueFactor`, `scale(base)`, `scaleSpDp(base)`, `scaleSpUnits(base)`, `effectiveFontScale()`, `explain(id)` |
| `resolveScreen(screen)` | o mesmo para um `ScreenSnapshot` montado por você (testes, previews, SSR) |
| `extend(…)` · `withAxis(…)` · `toJSON()` | veja acima; `toJSON()` lança erro para funções de código |

`metrics` tem como padrão o snapshot do viewport atual. Passe o `scope.metrics` de um escopo por elemento para resolver contra um elemento ([Runtime › Escopos por elemento](../runtime.md#escopos-por-elemento)).

## Variáveis CSS e literais

| API | Notas |
|---|---|
| `--cdp-<id>` · `--csp-<id>` em `:root` | fator de layout (px) · fator de texto × escala de fonte efetiva (px), para toda estratégia registrada e toda fórmula em texto / fator de id automático usado via `css()` |
| `--cdp` · `--csp` | o mesmo para a estratégia padrão |
| `16cdp-<id>` · `14csp-<id>` · `16cdp` · `14csp` | literais em `dimens()`, `dimenCss()`, `<style data-webdimens>` e no plugin PostCSS; `dimen('16cdp-brand')` / `dimensPx()` os resolvem em JS |
| `installCustomCss()` | começa a publicar as variáveis quando o seu CSS só usa `16cdp` / `var(--cdp)` e nenhuma estratégia é definida |
| `customCssDeclarations(metrics?, strategies?)` | as declarações como string, por exemplo para um escopo por elemento |

Ids viram identificadores CSS (caracteres fora de `A-Z a-z 0-9 _ -` viram `_`; fórmulas em texto usam `formula-<hash>`). As variáveis atualizam no máximo uma vez por frame no resize.

## Helpers de framework

| Framework | Escopo | Uso |
|---|---|---|
| React (`webdimens/react`) | `<ScalingStrategyProvider strategy={brand}>` | `const s = useScalingStrategy(); s.dp(16)` (re-renderiza quando o snapshot muda) |
| Vue (`webdimens/vue`) | `provideScalingStrategy(brand)` | `const s = useScalingStrategy(); s.dp(16)` (reativo) · `useCdp(16, 'brand')`: `ComputedRef<number>` |
| Svelte (`webdimens/svelte`) | — | `const brand = scalingStrategy('brand')` → `{$brand.dp(16)}` |
| Angular (`webdimens/angular`) | `providers: [provideScalingStrategy(brand)]` · token `SCALING_STRATEGY` | `s = injectScalingStrategy()` → `s().dp(16)` |

Cada helper aceita uma estratégia opcional (instância, id ou fórmula em texto) e retorna um `BoundScalingStrategy`: `strategy`, `dp`, `px`, `sp`, `spPx`, `css`, `cssSp`, `factor()`, `explain()`. `bindScalingStrategy(s, track?)` cria um para outros frameworks. Para estilos seguros em SSR, prefira `s.css(16)` (variáveis CSS).

## Motor (independente de plataforma)

| Export | Notas |
|---|---|
| `screenSnapshot({ widthDp, heightDp, … })` | cria um `ScreenSnapshot(widthDp, heightDp, smallestWidthDp, density, fontScale, isLandscape, isMultiWindow, device)` com padrões |
| `toScreenSnapshot(metrics)` · `defaultDeviceClass(metrics)` · `setDeviceClassResolver(fn \| null)` | snapshot da web → snapshot do motor, detecção de dispositivo |
| `resolveScaling(config, screen)` · `configFromSpec(spec, parent, path)` · `configToSpec(id, config)` · `parseStrategiesDocument(input, lookup)` | o motor puro usado pelo registro |
| `screenScope(screen)` · `formulaScope(screen, base)` | os escopos que as fórmulas em código recebem |
| `ScalingExpression.parse(texto, allowed?)` · `.evaluate(lookup)` · `.source` | a linguagem em texto |
| `SCREEN_VARIABLES` · `CURVE_VARIABLES` · `FORMULA_VARIABLES` · `SCALING_AXES` · `DEVICE_CLASSES` | listas de nomes |
| `DEFAULT_CONFIG` · `BUILT_IN_SPECS` · `PRESET_SPECS` | padrões e specs das embutidas e dos presets |

Tipos: `ScalingStrategySpec`, `ScalingPatchSpec`, `ScalingRuleSpec`, `ScreenConditionSpec`, `CurveSpec`, `FontScaleSpec`, `ScalingStrategiesDocument`, `ScalingConfig`, `ScreenSnapshot`, `ScreenScope`, `FormulaScope`, `DeviceClass`, `ScalingAxis`, `CurveFunction`, `ValueTransform`, `BoundScalingStrategy`, `ScalingFormulaOptions`.

`resetScalingStrategiesForTest()` limpa o registro, a padrão, as fórmulas compartilhadas e o CSS (só para testes).

[Voltar à documentação de estratégias personalizadas](README.md)
