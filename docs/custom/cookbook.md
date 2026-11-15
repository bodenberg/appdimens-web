# Cookbook

> **Languages:** English · [Português (BR)](../pt-BR/custom/cookbook.md)

Ready-to-use strategies. Each one shows the code form and, where it matters, the JSON form. All imports are from `webdimens/custom`.

## Grow on phones, calm down on tablets

```ts
const calm = customScaleStrategy(({ sw, ratio }) => (sw < 600 ? ratio : 2 + (sw - 600) / 1000));
```

```ts
const calm = CustomPresets.TABLET_FRIENDLY;          // linear on phones, power(0.5) on tablets, ≤ 1.8
```

## Design frame of 360 dp, never below 85% or above 160%

```ts
const brand = customScaleStrategy(({ sw, clamp }) => clamp(sw / 360, 0.85, 1.6), { id: 'brand' });
```

```json
{ "id": "brand", "reference": { "width": 360, "height": 640 }, "clamp": { "min": 0.85, "max": 1.6 } }
```

## Sublinear growth (big screens grow slower)

```ts
const soft = customScaleStrategy(({ sw, pow }) => pow(sw / 360, 0.75));
```

```json
{ "id": "soft", "reference": { "width": 360, "height": 640 }, "curve": { "type": "power", "exponent": 0.75 } }
```

## TV: scale by height, 10-foot UI

```ts
const living = customScaleStrategy(({ tv, height, ratio, clamp }) => (tv ? clamp(height / 540, 1, 2) : ratio));
```

```json
{ "id": "living", "rules": [ { "when": { "device": "tv" },
  "set": { "axis": "height", "reference": { "width": 960, "height": 540 }, "clamp": { "min": 1, "max": 2 } } } ] }
```

On the web the TV class comes from the user agent or `install({ uiModeType: UiModeType.TELEVISION })` for kiosks and TV apps.

## Watch: almost fixed sizes

```ts
const wrist = customScaleStrategy(({ watch, shortSide, ratio, clamp }) => (watch ? clamp(shortSide / 192, 0.85, 1.15) : ratio));
```

## Game HUD: shorter side, aspect-ratio aware

```ts
const hud = defineScalingStrategy({
  id: 'hud',
  axis: 'min',
  curve: { type: 'power', exponent: 0.85 },
  aspectRatio: true,
  clamp: { min: 0.75, max: 2.5 },
  fontScale: 'ignore',                     // HUD text never follows the browser text size
});
canvasCtx.font = `${hud.spPx(14)}px system-ui`;   // device px for a canvas
```

## Readable text: grow slowly, cap the font scale

```ts
const body = defineScalingStrategy({ id: 'body', curve: { type: 'logarithmic', k: 0.4 }, fontScale: { max: 1.3 } });
```

```css
article p { font-size: 16csp-body; }       /* PostCSS → calc(16 * var(--csp-body)) */
```

## Minimum tap target

```ts
const touch = defineScalingStrategy({ id: 'touch', valueClamp: { min: 48 } });
button.style.minHeight = `${cdp(40, touch)}px`;   // never below 48 px (value-dependent: css() gives px)
```

## Whole px only

```ts
const snap = scalingFormula(({ base, ratio, round }) => round(base * ratio));
```

```json
{ "id": "snap", "formula": "round(base * ratio)" }
```

## Never smaller than the design value

```ts
const floor = scalingFormula(({ base, ratio, max }) => max(base * ratio, base));
```

## Split or non-maximized window: keep the design values

```ts
const steady = defineScalingStrategy({ id: 'steady', ignoreMultiWindow: true });
```

## Landscape phones: a bit smaller

```ts
const brand = defineScalingStrategy({
  id: 'brand',
  curve: { type: 'power', exponent: 0.8 },
  rules: [{ when: { smallestWidth: { max: 600 }, orientation: 'landscape' }, set: { multiplier: 0.9 } }],
});
```

## Desktop layouts by width, not by device

```ts
const wide = defineScalingStrategy({
  id: 'wide',
  rules: [{ name: 'desktop', when: { width: { min: 1024 } }, set: { curve: { type: 'logarithmic', k: 0.4 }, clamp: { max: 1.5 } } }],
});
```

Width ranges do not depend on device detection, so they behave the same on a touch laptop and a desktop browser.

## A/B test or remote config

```ts
try {
  const json = await fetch('/config/appdimens-strategies.json').then((r) => r.text());
  loadScalingStrategies(json);                          // atomic: a bad document changes nothing
} catch (e) {
  console.warn('bad strategies JSON', e);
}
const s = requireScalingStrategy('brand');
el.style.padding = s.css(16);
```

## React subtree with its own law

```tsx
import { ScalingStrategyProvider, useScalingStrategy } from 'webdimens/react';

<ScalingStrategyProvider strategy="hud"><Scoreboard /></ScalingStrategyProvider>;
function Scoreboard() {
  const s = useScalingStrategy();
  return <div style={{ padding: s.css(12), fontSize: s.cssSp(18) }}>…</div>;   // CSS variables, SSR-safe
}
```

## One growth law for a design system

Ship a single `appdimens-strategies.json` with the design tokens, load it in every app with `loadScalingStrategies`, and use the ids only (`16cdp-brand` in CSS, `cdp(16, 'brand')` in JS). Android, iOS, Flutter, React Native, KMP, Games and .NET read the same file and get the same numbers.

[Back to the custom docs](README.md)
