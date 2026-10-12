# Referência da API

Cada exportação pública de cada ponto de entrada, com assinaturas TypeScript extraídas das declarações de tipo publicadas. Os
valores são px CSS, a menos que o nome termine em `Px` (pixels do dispositivo). As páginas de tópicos com exemplos estão
linkadas em cada seção.

## `webdimens` — núcleo e estratégia escalonada

### Configuração e runtime ([Runtime](./runtime.md))

```ts
function install(options?: InstallOptions): void;
function uninstall(): void;
function configure(next: WebDimensConfig): void;
function refresh(): void;                                    // medir de novo, incluindo a escala de fonte
function flush(): void;                                      // aplica um snapshot pendente (CSS + assinantes) agora
function subscribe(listener: (m: DimenMetrics) => void): () => void;
function getMetrics(): DimenMetrics;
function getVersion(): number;
function setMetrics(metrics: DimenMetrics | DimenMetricsInit | null): void;
function register(def: StrategyDef): Float64Array;           // idempotente
function registeredStrategies(): readonly StrategyDef[];
function cssDeclarations(m: DimenMetrics, strategies?: readonly StrategyDef[]): string;
function readEnvironment(size?: { width: number; height: number }): DimenMetricsInit;
function detectUiModeType(size: { width: number; height: number }): UiModeType;
function flushDeclarative(): void;
function createDimenScope(element: HTMLElement, options?: DimenScopeOptions): DimenScope;
```

| Tipo | Campos |
|---|---|
| `InstallOptions` | `WebDimensConfig` + `declarative?: boolean` (padrão `true`) + `strategies?: readonly string[] \| 'all'` |
| `WebDimensConfig` | `cssVariables?`, `cssNonce?`, `uiModeType?: UiModeType \| (size) => UiModeType`, `fontScale?`, `multiWindow?: boolean \| (size) => boolean`, `measure?: () => { width, height }` |
| `DimenMetricsInit` | `screenWidthDp`, `screenHeightDp`, `smallestScreenWidthDp?`, `density?`, `fontScale?`, `orientation?`, `uiModeType?`, `isInMultiWindowMode?` |
| `DimenScopeOptions` | `strategies?`, `cssVariables?` (padrão `true`), `onChange?(m)` |
| `DimenScope` | `metrics`, `dp(value, qualifier?, options?)`, `sp(value, qualifier?, options?)`, `update()`, `disconnect()` |

`class DimenMetrics` — snapshot imutável. Construtor `new DimenMetrics(init: DimenMetricsInit)`; estático `DEFAULT`
(300 × 533). Campos: `screenWidthDp`, `screenHeightDp`, `smallestScreenWidthDp`, `smallestWidthDp`, `density`, `fontScale`,
`orientation`, `isLandscape`, `isPortrait`, `uiModeType`, `isInMultiWindowMode`, `minDimensionDp`, `maxDimensionDp`, `scale`,
`screenWidthFactor`, `screenHeightFactor`, `normalizedAspectRatio`, `logNormalizedAspectRatio`, `defaultAspectRatioMultiplier`,
`defaultScaledAspectRatioMultiplier`, `powerScale`, `interpolatedScale`, `diagonalScale`, `perimeterScale`,
`logarithmicScale`. Métodos: `scaledMultiplier(applyAspectRatio, k?)`, `aspectRatioMultiplier(k?)`, `equals(other)`.

### Acessores (gerados, 264 por estratégia) ([API JavaScript](./javascript.md#acessores))

```ts
const sdp: (value: number) => number;        // e todo nome que segue a gramática abaixo
```

`<prefixo><s|h|w><dp|sp|em><Ph|Lh|Pw|Lw>?<a|i|ia>?<Px>?` com inversores `s`: `Ph Lh Pw Lw`, `h`: `Lw Pw`, `w`: `Lh Ph`.
Exemplos exportados por `webdimens`: `sdp`, `sdpa`, `sdpi`, `sdpia`, `sdpPx`, `sdpaPx`, `hdp`, `wdp`, `sdpPh`, `sdpLwa`, `hdpLw`,
`wdpPhiaPx`, `ssp`, `sspa`, `hspPx`, `sem`, `wemLhia`, …

### Resolvedores genéricos, facilitadores, builder

```ts
const toDynamicScaledDp:   (value: number, qualifier?: DpQualifier, options?: SpOptions) => number;
const toDynamicScaledPx:   (value: number, qualifier?: DpQualifier, options?: SpOptions) => number;
const toDynamicScaledSp:   (value: number, qualifier?: DpQualifier, options?: SpOptions) => number;
const toDynamicScaledSpPx: (value: number, qualifier?: DpQualifier, options?: SpOptions) => number;

// para s|h|w × dp|sp, cada um também com sufixo Px (sdpRotatePx, …):
const sdpRotate:    (value: number, rotationValue: number, orientation?: Orientation, options?: FacilitatorOptions) => number;
const sdpMode:      (value: number, modeValue: number, uiModeType: UiModeType, options?: FacilitatorOptions) => number;
const sdpQualifier: (value: number, qualifiedValue: number, qualifierType: DpQualifier, qualifierValue: number, options?: FacilitatorOptions) => number;
const sdpScreen:    (value: number, screenValue: number, uiModeType: UiModeType, qualifierType: DpQualifier, qualifierValue: number, options?: FacilitatorOptions) => number;

const scaledDp: (value: number) => DimenScaled;     // class DimenScaled extends DimenBuilder
const scaledSp: (value: number) => DimenScaled;
const SCALED: StrategyDef;
```

| Tipo de opções | Campos |
|---|---|
| `DimenOptions` | `inverter?`, `ignoreMultiWindows?`, `applyAspectRatio?`, `customSensitivityK?: number \| null` |
| `SpOptions` | `DimenOptions` + `fontScale?` (padrão `true`) |
| `FacilitatorOptions` | `SpOptions` + `finalQualifierResolver?: DpQualifier` |

`class DimenBuilder` — `aspectRatio(apply?, k?)`, `applyAspectRatio(apply?)`, `ignoreMultiWindows(ignore?)`, `screen(…)` (quatro
sobrecargas + forma de objeto `ScreenRule`), `dp(q?)`, `px(q?)`, `sp(q?, fontScale?)`, `spPx(q?, fontScale?)`, `all()`, getters
`sdp hdp wdp ssp hsp wsp sem hem wem` e suas formas `Px`. Veja [API JavaScript](./javascript.md#builders).

```ts
function plainRotate<T>(value: T, rotation: T, orientation?: Orientation): T;
function plainMode<T>(value: T, mode: T, uiModeType: UiModeType): T;
function plainQualifier<T>(value: T, qualified: T, qualifierType: DpQualifier, qualifierValue: number): T;
function plainScreen<T>(value: T, screen: T, uiModeType: UiModeType, qualifierType: DpQualifier, qualifierValue: number): T;
```

### Tokens de unidade e compilador declarativo ([Unidades declarativas](./declarative.md))

```ts
function dimen(input: string | number): number;
function dimenCss(value: string): string;
function dimens<T extends Record<string, string | number | null | undefined>>(style: T): { [K in keyof T]: … };
function dimensPx<T extends Record<string, string | number | null | undefined>>(style: T): { [K in keyof T]: string | number };
function cssDimen(token: string, value: number): string;
function parseToken(name: string): ParsedToken | null;
function parseDimenLiteral(literal: string): { value: number; token: ParsedToken } | null;
function compileCssText(css: string): string;
function compileDimenClass(className: string): DimenRule | null;
function compileDimenAttribute(text: string, selector?: string): DimenRule[];   // lança SyntaxError em entrada malformada
function dimenClassesToCss(classNames: Iterable<string>, attributeValues?: Iterable<string>): string;
function modifierCss(strategies: readonly { id: string; prefix: string }[]): string;
const STRATEGY_PREFIXES: Readonly<Record<string, string>>;      // '' → 'scaled', 'pw' → 'power', …
const PROPERTY_ALIASES: Readonly<Record<string, readonly string[]>>;
const MODE_CONDITIONS: Readonly<Record<string, UiModeType>>;
```

`ParsedToken`: `name`, `prefix`, `strategy`, `axis`, `kind`, `inverter`, `flags`, `px`, `slot`, `css`.
`DimenRule`: `css`, `order`.

### Enumerações, constantes e infraestrutura

| Exportação | Valores |
|---|---|
| `DpQualifier` | `SMALL_WIDTH` `HEIGHT` `WIDTH` |
| `Orientation` | `PORTRAIT` `LANDSCAPE` `DEFAULT` |
| `Inverter` | `PH_TO_LW` `PW_TO_LH` `LH_TO_PW` `LW_TO_PH` `SW_TO_LH` `SW_TO_LW` `SW_TO_PH` `SW_TO_PW` `DEFAULT` |
| `UiModeType` | `NORMAL` `TELEVISION` `CAR` `WATCH` `DESK` `APPLIANCE` `VR_HEADSET` `UNDEFINED` `FOLD_OPEN` `FOLD_CLOSED` `FLIP_OPEN` `FLIP_CLOSED` `FOLD_HALF_OPENED` `FLIP_HALF_OPENED` |
| `UnitType` | `INCH` `CM` `MM` `SP` `DP` `PX` |
| `AutoResizePercentBasis` | `HEIGHT` `WIDTH` `MIN_SIDE` |
| constantes | `BASE_WIDTH_DP` (300), `BASE_HEIGHT_DP` (533), `BASE_DIAGONAL_DP` (611.6305), `BASE_PERIMETER_DP` (833), `REFERENCE_ASPECT_RATIO` (1.78), `INV_BASE_RATIO` (1/300), `ADJUSTMENT_SCALE` (0.1/30), `SENSITIVITY_DEFAULT` (0.08/30), `VERSION` |
| infraestrutura | `computeFactor(def, m, qualifier, inverter?, ignoreMultiWindows?, applyAspectRatio?, k?)`, `effectiveQualifier(q, inverter, isLandscape, isPortrait)`, `readScreenDp(m, q)`, `VARIANTS` (as 11 variantes de eixo), tipos `StrategyDef`, `AxisVariant` |

## `webdimens/<strategy>` ([Estratégias](./strategies.md))

`percent`, `power`, `fluid`, `auto`, `diagonal`, `fill`, `fit`, `interpolated`, `logarithmic`, `perimeter`, `density`. Cada um exporta
a mesma forma da parte escalonada de `webdimens`, com o seu prefixo: 264 acessores (`pwsdp`, `pwhspa`, …),
`toDynamic<Name>Dp/Px/Sp/SpPx`, os 48 facilitadores (`pwsdpRotate`, `pwhspScreenPx`, …), `class Dimen<Name>` com getters
prefixados (`pwsdp`, `pwssp`, `pwsem` … e formas `Px`), `<id>Dp(value)` / `<id>Sp(value)` builders (`powerDp`, `fluidSp`) e a
constante de definição (`POWER`, `FLUID`, …).

`webdimens/percent` também exporta a API literal `space*` ([Unidades e space](./units.md#porcentagens-literais-space)):
`spaceW` `spaceWi` `spaceWPx` `spaceWPxi` `spaceSw` `spaceSwi` `spaceSwPx` `spaceSwPxi` `spaceH` `spaceHi` `spaceHPx` `spaceHPxi`
`space(p, ref)` `spaceI` `spacePx` `spacePxi` `spaceWSp(p, fontScale?, ignoreMultiWindows?)` `spaceWSpi` `spaceWSpPx` `spaceWSpiPx`
`spaceSwSp` `spaceSwSpi` `spaceSwSpPx` `spaceSwSpiPx` `spaceHSp` `spaceHSpi` `spaceHSpPx` `spaceHSpiPx` `spaceSp(p, ref, fontScale?)`
`spaceSpi` `spaceSpPx` `spaceSpiPx`.

## `webdimens/resize` ([Resize](./resize.md))

```ts
function autoResizeText(element: HTMLElement, options?: TextFitOptions): AutoResizeTextController;  // { fontSize, refit(), disconnect() }
function fittingTextSize(element: HTMLElement, options?: TextFitOptions): number;
function fittingTextPx(options: CanvasTextFitOptions): number;
function fittingBoxPx(min: ResizeBound | number, max: ResizeBound | number, step: ResizeBound | number, availablePx: number, box?: { width: number; height: number }): number;
function resolveBound(bound: ResizeBound | number, box?: { width: number; height: number }, metrics?: DimenMetrics): number;
function canvasFont(font: string, px: number): string;
const resizeFixedDp: (dp: number) => ResizeBound;
const resizeFixedSp: (sp: number) => ResizeBound;
const resizePercentSw: (percent: number) => ResizeBound;
const resizePercentW: (percent: number) => ResizeBound;
const resizePercentH: (percent: number) => ResizeBound;
const resizePercentBox: (percent: number, basis?: AutoResizePercentBasis) => ResizeBound;
function buildResizeStepsPx(minPx: number, maxPx: number, stepPx: number): Float64Array;
function findLargestFittingResizePx(sortedStepsPx: ArrayLike<number>, fits: (candidatePx: number) => boolean): number;
class ResizeRangePx { constructor(minPx, maxPx, stepPx); lowPx; highPx; steps; resolveFitting(fits): number }
```

`TextFitOptions`: `min?`, `max?`, `step?` (número = sp, ou um `ResizeBound`), `maxLines?`.
`CanvasTextFitOptions`: `TextFitOptions` + `text`, `maxWidth`, `maxHeight?`, `font?`, `lineHeight?`, `letterSpacing?`.

## `webdimens/units` ([Unidades e space](./units.md))

```ts
function setPhysicalCalibration(pxPerInch: number): number;   // retorna o valor anterior; RangeError se não for positivo
const mm, cm, inch, toDpFromMm, toDpFromCm, toDpFromInch: (value: number) => number;
const toPxFromMm, toPxFromCm, toPxFromInch, toSpFromMm, toSpFromCm, toSpFromInch: (value: number) => number;
const convertMmToCm, convertMmToInch, convertCmToMm, convertCmToInch, convertInchToCm, convertInchToMm: (v: number) => number;
function unitSizeInDp(type: UnitType): number;
const radius, radiusFromDiameter: (diameter: number, type?: UnitType) => number;
const radiusFromCircumference: (circumference: number, type?: UnitType) => number;
const measureDiameter, displayMeasureDiameter: (value: number, isCircumference: boolean) => number;
```

## `webdimens/postcss` ([CSS](./css.md#plugin-postcss))

```ts
export default function webdimens(options?: { atRule?: string }): WebDimensPostcssPlugin;   // webdimens.postcss === true
```

## Bindings de frameworks ([Frameworks](./frameworks.md))

```ts
// webdimens/react
function useDimens(): DimenMetrics;
function useDimensVersion(): number;
function useDimen<T>(compute: () => T, deps?: DependencyList): T;
function useWebDimens(config?: InstallOptions): DimenMetrics;
function useDimenScope<T extends HTMLElement>(ref: RefObject<T | null>, options?: DimenScopeOptions): DimenScope | null;

// webdimens/vue
const WebDimens: { install(app: App, config?: InstallOptions): void };
function useDimens(): Readonly<Ref<DimenMetrics>>;
function useDimen<T>(compute: () => T): ComputedRef<T>;

// webdimens/svelte
const metrics: Readable<DimenMetrics>;
function dimen<T>(compute: () => T): Readable<T>;

// webdimens/angular
function provideWebDimens(config?: InstallOptions): EnvironmentProviders;
function injectDimens(): Signal<DimenMetrics>;
function injectDimen<T>(compute: () => T): Signal<T>;
```

## Recursos

| Caminho | Conteúdo |
|---|---|
| `webdimens/css` (`css/webdimens.css`) | tokens escalonados em CSS puro |
| `webdimens/css/all.css`, `webdimens/css/strategies/<id>.css` | todas as estratégias / uma estratégia |
| `webdimens/scss` (`scss/_webdimens.scss`) | uma função Sass por token CSS + `dimen($token, $value)` |
| `webdimens/global` (`dist/webdimens.global.js`) | pacote de CDN: tudo em `window.WebDimens`, instala ao carregar, a menos que tenha `data-no-install` |
| `dist/webdimens.lite.global.js` | pacote de CDN: runtime + estratégia escalonada |

Próximo: [Receitas](./recipes.md) · [Voltar ao índice](./README.md)
