# Formato JSON

> **Idiomas:** [English](../../custom/json.md) · Português (BR)

Um documento JSON descreve qualquer quantidade de estratégias. O mesmo arquivo carrega em todas as plataformas AppDimens e dá os mesmos números, então um design system pode distribuí-lo como design token, via config remota ou para um teste A/B.

```ts
import { loadScalingStrategies, requireScalingStrategy, exportScalingStrategies } from 'webdimens/custom';

const res = await fetch('/appdimens-strategies.json');
loadScalingStrategies(await res.text());   // registra todas + aplica "default"; retorna Map<id, ScalingStrategy>
loadScalingStrategies(documentObject);     // o mesmo, a partir de um objeto, uma spec ou um array de specs
const brand = requireScalingStrategy('brand');
brand.toJSON();                            // exporta uma estratégia (JSON.stringify(brand) também funciona)
exportScalingStrategies();                 // exporta todas as registradas + o padrão
```

Com um bundler você também pode fazer `import doc from './appdimens-strategies.json'` e passar o objeto.

## Documento

```json
{
  "$schema": "https://github.com/bodenberg/appdimens-skills/schemas/custom-strategy.schema.json",
  "version": 1,
  "default": "brand",
  "strategies": [
    {
      "id": "brand",
      "reference": { "width": 360, "height": 640 },
      "curve": { "type": "power", "exponent": 0.8 },
      "clamp": { "min": 0.85, "max": 1.6 },
      "fontScale": { "max": 1.3 },
      "rules": [
        { "name": "large", "when": { "device": ["tablet", "desktop"] },
          "set": { "curve": { "type": "logarithmic", "k": 0.4 } } },
        { "when": { "smallestWidth": { "min": 600 }, "orientation": "landscape" },
          "set": { "multiplier": 0.9 } }
      ]
    },
    { "id": "brandText", "extends": "brand", "valueClamp": { "min": 10, "max": 32 } },
    { "id": "hud", "formula": "base * pow(sw / 360, 0.8)" }
  ]
}
```

| Chave | Significado |
|---|---|
| `version` | versão do formato, hoje 1 (uma versão maior é rejeitada) |
| `default` | id que vira a estratégia padrão (`setDefaultScalingStrategy`), opcional |
| `strategies[]` | as estratégias, cada uma com um `id` único |

## Campos da estratégia

| Campo | Exemplo | Notas |
|---|---|---|
| `id` | `"brand"` | obrigatório, único no documento |
| `extends` | `"power"` | outra estratégia do documento, uma registrada, uma embutida (`scaled` `power` `logarithmic` `interpolated` `diagonal` `perimeter` `fixed`) ou um preset (`tabletFriendly`…). As regras do pai vêm primeiro |
| `reference` | `{"width": 360, "height": 640}` | quadro de design (dp) |
| `axis` | `"smallestWidth"` | `smallestWidth` `width` `height` `min` `max` `diagonal` `perimeter` |
| `curve` | `"linear"` ou `{"type": …}` | veja a [tabela de curvas](configuration.md#curvas) |
| `multiplier` | `0.9` | |
| `clamp` | `{"min": 0.85, "max": 1.6}` | limites do fator; `null` limpa os herdados |
| `valueClamp` | `{"min": 10, "max": 32}` | limites em px, ≥ 0; `null` limpa |
| `aspectRatio` | `true` ou `{"enabled": true, "sensitivity": 0.004}` | |
| `sensitivity` | `0.004` | o k da proporção sozinho (útil numa regra) |
| `fontScale` | `"follow"` · `"ignore"` · `{"max": 1.3}` | política do `csp` |
| `ignoreMultiWindow` | `true` | |
| `formula` | `"max(scaled, base)"` | [fórmula em texto](text-formulas.md) por valor; `null` limpa uma herdada |
| `rules` | `[{"name": …, "when": {…}, "set": {…}}]` | `set` aceita qualquer campo acima, exceto `id`, `extends` e `rules` |

## Condições das regras (`when`)

| Chave | Exemplo |
|---|---|
| `device` | `"tv"` ou `["tablet", "desktop"]` (`phone` `tablet` `desktop` `tv` `watch` `car` `vr`) |
| `orientation` | `"landscape"` ou `"portrait"` |
| `smallestWidth` · `width` · `height` · `aspectRatio` | `{"min": 600, "max": 840}`, com `min <= valor < max` |
| `multiWindow` | `true` |

Um `when` omitido casa com qualquer tela.

## Validação

O carregamento é estrito e atômico: toda estratégia (e o `default`) é verificada antes de qualquer registro, então em qualquer erro **nada** muda. Os erros são `TypeError` (tipo errado, id desconhecido), `RangeError` (limites) ou `SyntaxError` (fórmulas, texto que não é JSON) e trazem o caminho no JSON. Exemplos:

| Entrada | Erro |
|---|---|
| `"curve": {"type": "cubic"}` | `TypeError: brand.curve.type 'cubic' is not one of linear, power, logarithmic, interpolated, constant, breakpoints, expression` |
| `"when": "tablet"` | `TypeError: brand.rules[0].when must be an object` |
| `"width": 600` numa condição | `TypeError: brand.rules[0].when.width must be an object with min/max` |
| `"ignoreMultiWindow": "true"` | `TypeError: brand.ignoreMultiWindow must be a boolean` |
| `"valueClamp": {"max": -1}` | `RangeError: strategy: maxValue must be >= 0` |
| `"formula": "base * sww"` | `SyntaxError: brand.formula: Invalid expression at 7: unknown variable 'sww' …` |
| `"default": "missing"` | `TypeError: No scaling strategy 'missing'. Registered: …`; nada é registrado |
| ids duplicados · ciclos em `extends` · pai desconhecido | `Duplicate strategy id 'brand'` · `Cyclic 'extends': a → b → a` · `'x' extends unknown strategy 'y'` |
| texto que não é JSON | `SyntaxError: Invalid JSON: …` |

Verifique um arquivo antes de publicar com o kit AppDimens (`npx appdimens-skills kit custom check <arquivo>`), que usa o mesmo motor e o [JSON schema](https://github.com/bodenberg/appdimens-skills/blob/main/schemas/custom-strategy.schema.json).

## Exportação

`strategy.toJSON()` retorna a spec de uma estratégia; um documento a recarrega sem mudanças. `exportScalingStrategies(strategies?)` retorna um documento inteiro (`version`, `default`, `strategies`). Código (`customScaleStrategy(…)`, `scalingFormula((s) => …)`, `curve: { type: 'custom' }`, `transform`) não pode ser exportado e lança erro (`TypeError: Custom curve functions cannot be encoded to JSON`, `TypeError: transform functions cannot be encoded to JSON`). Use os equivalentes em texto quando precisar de JSON.

[Voltar à documentação de estratégias personalizadas](README.md)
