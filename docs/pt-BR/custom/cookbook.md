# Receitas

> **Idiomas:** [English](../../custom/cookbook.md) · Português (BR)

Estratégias prontas para usar. Cada uma mostra a forma em código e, quando importa, a forma em JSON. Todos os imports vêm de `webdimens/custom`.

## Crescer em celulares, acalmar em tablets

```ts
const calm = customScaleStrategy(({ sw, ratio }) => (sw < 600 ? ratio : 2 + (sw - 600) / 1000));
```

```ts
const calm = CustomPresets.TABLET_FRIENDLY;          // linear em celulares, power(0.5) em tablets, ≤ 1.8
```

## Quadro de design de 360 dp, nunca abaixo de 85% nem acima de 160%

```ts
const brand = customScaleStrategy(({ sw, clamp }) => clamp(sw / 360, 0.85, 1.6), { id: 'brand' });
```

```json
{ "id": "brand", "reference": { "width": 360, "height": 640 }, "clamp": { "min": 0.85, "max": 1.6 } }
```

## Crescimento sublinear (telas grandes crescem mais devagar)

```ts
const soft = customScaleStrategy(({ sw, pow }) => pow(sw / 360, 0.75));
```

```json
{ "id": "soft", "reference": { "width": 360, "height": 640 }, "curve": { "type": "power", "exponent": 0.75 } }
```

## TV: escalar pela altura, UI de 3 metros

```ts
const living = customScaleStrategy(({ tv, height, ratio, clamp }) => (tv ? clamp(height / 540, 1, 2) : ratio));
```

```json
{ "id": "living", "rules": [ { "when": { "device": "tv" },
  "set": { "axis": "height", "reference": { "width": 960, "height": 540 }, "clamp": { "min": 1, "max": 2 } } } ] }
```

Na web a classe TV vem do user agent ou de `install({ uiModeType: UiModeType.TELEVISION })` para quiosques e apps de TV.

## Relógio: tamanhos quase fixos

```ts
const wrist = customScaleStrategy(({ watch, shortSide, ratio, clamp }) => (watch ? clamp(shortSide / 192, 0.85, 1.15) : ratio));
```

## HUD de jogo: lado menor, atento à proporção

```ts
const hud = defineScalingStrategy({
  id: 'hud',
  axis: 'min',
  curve: { type: 'power', exponent: 0.85 },
  aspectRatio: true,
  clamp: { min: 0.75, max: 2.5 },
  fontScale: 'ignore',                     // o texto do HUD nunca segue o tamanho de texto do navegador
});
canvasCtx.font = `${hud.spPx(14)}px system-ui`;   // px de dispositivo para um canvas
```

## Texto legível: crescer devagar, limitar a escala de fonte

```ts
const body = defineScalingStrategy({ id: 'body', curve: { type: 'logarithmic', k: 0.4 }, fontScale: { max: 1.3 } });
```

```css
article p { font-size: 16csp-body; }       /* PostCSS → calc(16 * var(--csp-body)) */
```

## Alvo de toque mínimo

```ts
const touch = defineScalingStrategy({ id: 'touch', valueClamp: { min: 48 } });
button.style.minHeight = `${cdp(40, touch)}px`;   // nunca abaixo de 48 px (depende do valor: css() dá px)
```

## Só px inteiros

```ts
const snap = scalingFormula(({ base, ratio, round }) => round(base * ratio));
```

```json
{ "id": "snap", "formula": "round(base * ratio)" }
```

## Nunca menor que o valor de design

```ts
const floor = scalingFormula(({ base, ratio, max }) => max(base * ratio, base));
```

## Janela dividida ou não maximizada: manter os valores de design

```ts
const steady = defineScalingStrategy({ id: 'steady', ignoreMultiWindow: true });
```

## Celulares em paisagem: um pouco menores

```ts
const brand = defineScalingStrategy({
  id: 'brand',
  curve: { type: 'power', exponent: 0.8 },
  rules: [{ when: { smallestWidth: { max: 600 }, orientation: 'landscape' }, set: { multiplier: 0.9 } }],
});
```

## Layouts de desktop pela largura, não pelo dispositivo

```ts
const wide = defineScalingStrategy({
  id: 'wide',
  rules: [{ name: 'desktop', when: { width: { min: 1024 } }, set: { curve: { type: 'logarithmic', k: 0.4 }, clamp: { max: 1.5 } } }],
});
```

Faixas de largura não dependem da detecção de dispositivo, então se comportam igual num notebook com toque e num navegador de desktop.

## Teste A/B ou config remota

```ts
try {
  const json = await fetch('/config/appdimens-strategies.json').then((r) => r.text());
  loadScalingStrategies(json);                          // atômico: um documento ruim não muda nada
} catch (e) {
  console.warn('JSON de estratégias inválido', e);
}
const s = requireScalingStrategy('brand');
el.style.padding = s.css(16);
```

## Subárvore React com lei própria

```tsx
import { ScalingStrategyProvider, useScalingStrategy } from 'webdimens/react';

<ScalingStrategyProvider strategy="hud"><Scoreboard /></ScalingStrategyProvider>;
function Scoreboard() {
  const s = useScalingStrategy();
  return <div style={{ padding: s.css(12), fontSize: s.cssSp(18) }}>…</div>;   // variáveis CSS, seguro em SSR
}
```

## Uma lei de crescimento para um design system

Distribua um único `appdimens-strategies.json` com os design tokens, carregue em todo app com `loadScalingStrategies` e use só os ids (`16cdp-brand` no CSS, `cdp(16, 'brand')` em JS). Android, iOS, Flutter, React Native, KMP, Games e .NET leem o mesmo arquivo e obtêm os mesmos números.

[Voltar à documentação de estratégias personalizadas](README.md)
