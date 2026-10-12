# API reference

Every public export of every entry point, with TypeScript signatures taken from the published type declarations. Values are
CSS px unless a name ends in `Px` (device px). Topic pages with examples are linked in each section.

## `webdimens` — core and scaled strategy

### Setup and runtime ([Runtime](./runtime.md))

```ts
function install(options?: InstallOptions): void;
function uninstall(): void;
function configure(next: WebDimensConfig): void;
function refresh(): void;                                    // re-measure, including the font scale
function flush(): void;                                      // apply a pending snapshot (CSS + subscribers) now
function subscribe(listener: (m: DimenMetrics) => void): () => void;
function getMetrics(): DimenMetrics;
function getVersion(): number;
function setMetrics(metrics: DimenMetrics | DimenMetricsInit | null): void;
function register(def: StrategyDef): Float64Array;           // idempotent
function registeredStrategies(): readonly StrategyDef[];
function cssDeclarations(m: DimenMetrics, strategies?: readonly StrategyDef[]): string;
function readEnvironment(size?: { width: number; height: number }): DimenMetricsInit;
function detectUiModeType(size: { width: number; height: number }): UiModeType;
function flushDeclarative(): void;
function createDimenScope(element: HTMLElement, options?: DimenScopeOptions): DimenScope;
```

| Type | Fields |
|---|---|
| `InstallOptions` | `WebDimensConfig` + `declarative?: boolean` (default `true`) + `strategies?: readonly string[] \| 'all'` |
| `WebDimensConfig` | `cssVariables?`, `cssNonce?`, `uiModeType?: UiModeType \| (size) => UiModeType`, `fontScale?`, `multiWindow?: boolean \| (size) => boolean`, `measure?: () => { width, height }` |
| `DimenMetricsInit` | `screenWidthDp`, `screenHeightDp`, `smallestScreenWidthDp?`, `density?`, `fontScale?`, `orientation?`, `uiModeType?`, `isInMultiWindowMode?` |
| `DimenScopeOptions` | `strategies?`, `cssVariables?` (default `true`), `onChange?(m)` |
| `DimenScope` | `metrics`, `dp(value, qualifier?, options?)`, `sp(value, qualifier?, options?)`, `update()`, `disconnect()` |

`class DimenMetrics` — immutable snapshot. Constructor `new DimenMetrics(init: DimenMetricsInit)`; static `DEFAULT`
(300 × 533). Fields: `screenWidthDp`, `screenHeightDp`, `smallestScreenWidthDp`, `smallestWidthDp`, `density`, `fontScale`,
`orientation`, `isLandscape`, `isPortrait`, `uiModeType`, `isInMultiWindowMode`, `minDimensionDp`, `maxDimensionDp`, `scale`,
`screenWidthFactor`, `screenHeightFactor`, `normalizedAspectRatio`, `logNormalizedAspectRatio`, `defaultAspectRatioMultiplier`,
`defaultScaledAspectRatioMultiplier`, `powerScale`, `interpolatedScale`, `diagonalScale`, `perimeterScale`,
`logarithmicScale`. Methods: `scaledMultiplier(applyAspectRatio, k?)`, `aspectRatioMultiplier(k?)`, `equals(other)`.

### Accessors (generated, 264 per strategy) ([JavaScript](./javascript.md#accessors))

```ts
const sdp: (value: number) => number;        // and every name matching the grammar below
```

`<prefix><s|h|w><dp|sp|em><Ph|Lh|Pw|Lw>?<a|i|ia>?<Px>?` with inverters `s`: `Ph Lh Pw Lw`, `h`: `Lw Pw`, `w`: `Lh Ph`.
Examples exported by `webdimens`: `sdp`, `sdpa`, `sdpi`, `sdpia`, `sdpPx`, `sdpaPx`, `hdp`, `wdp`, `sdpPh`, `sdpLwa`, `hdpLw`,
`wdpPhiaPx`, `ssp`, `sspa`, `hspPx`, `sem`, `wemLhia`, …

### Generic resolvers, facilitators, builder

```ts
const toDynamicScaledDp:   (value: number, qualifier?: DpQualifier, options?: SpOptions) => number;
const toDynamicScaledPx:   (value: number, qualifier?: DpQualifier, options?: SpOptions) => number;
const toDynamicScaledSp:   (value: number, qualifier?: DpQualifier, options?: SpOptions) => number;
const toDynamicScaledSpPx: (value: number, qualifier?: DpQualifier, options?: SpOptions) => number;

// for s|h|w × dp|sp, each also with a Px suffix (sdpRotatePx, …):
const sdpRotate:    (value: number, rotationValue: number, orientation?: Orientation, options?: FacilitatorOptions) => number;
const sdpMode:      (value: number, modeValue: number, uiModeType: UiModeType, options?: FacilitatorOptions) => number;
const sdpQualifier: (value: number, qualifiedValue: number, qualifierType: DpQualifier, qualifierValue: number, options?: FacilitatorOptions) => number;
const sdpScreen:    (value: number, screenValue: number, uiModeType: UiModeType, qualifierType: DpQualifier, qualifierValue: number, options?: FacilitatorOptions) => number;

const scaledDp: (value: number) => DimenScaled;     // class DimenScaled extends DimenBuilder
const scaledSp: (value: number) => DimenScaled;
const SCALED: StrategyDef;
```

| Options type | Fields |
|---|---|
| `DimenOptions` | `inverter?`, `ignoreMultiWindows?`, `applyAspectRatio?`, `customSensitivityK?: number \| null` |
| `SpOptions` | `DimenOptions` + `fontScale?` (default `true`) |
| `FacilitatorOptions` | `SpOptions` + `finalQualifierResolver?: DpQualifier` |

`class DimenBuilder` — `aspectRatio(apply?, k?)`, `applyAspectRatio(apply?)`, `ignoreMultiWindows(ignore?)`, `screen(…)` (four
overloads + object form `ScreenRule`), `dp(q?)`, `px(q?)`, `sp(q?, fontScale?)`, `spPx(q?, fontScale?)`, `all()`, getters
`sdp hdp wdp ssp hsp wsp sem hem wem` and their `Px` forms. See [JavaScript](./javascript.md#builders).

```ts
function plainRotate<T>(value: T, rotation: T, orientation?: Orientation): T;
function plainMode<T>(value: T, mode: T, uiModeType: UiModeType): T;
function plainQualifier<T>(value: T, qualified: T, qualifierType: DpQualifier, qualifierValue: number): T;
function plainScreen<T>(value: T, screen: T, uiModeType: UiModeType, qualifierType: DpQualifier, qualifierValue: number): T;
```

### Unit tokens and declarative compiler ([Declarative](./declarative.md))

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
function compileDimenAttribute(text: string, selector?: string): DimenRule[];   // throws SyntaxError on malformed input
function dimenClassesToCss(classNames: Iterable<string>, attributeValues?: Iterable<string>): string;
function modifierCss(strategies: readonly { id: string; prefix: string }[]): string;
const STRATEGY_PREFIXES: Readonly<Record<string, string>>;      // '' → 'scaled', 'pw' → 'power', …
const PROPERTY_ALIASES: Readonly<Record<string, readonly string[]>>;
const MODE_CONDITIONS: Readonly<Record<string, UiModeType>>;
```

`ParsedToken`: `name`, `prefix`, `strategy`, `axis`, `kind`, `inverter`, `flags`, `px`, `slot`, `css`.
`DimenRule`: `css`, `order`.

### Enums, constants, plumbing

| Export | Values |
|---|---|
| `DpQualifier` | `SMALL_WIDTH` `HEIGHT` `WIDTH` |
| `Orientation` | `PORTRAIT` `LANDSCAPE` `DEFAULT` |
| `Inverter` | `PH_TO_LW` `PW_TO_LH` `LH_TO_PW` `LW_TO_PH` `SW_TO_LH` `SW_TO_LW` `SW_TO_PH` `SW_TO_PW` `DEFAULT` |
| `UiModeType` | `NORMAL` `TELEVISION` `CAR` `WATCH` `DESK` `APPLIANCE` `VR_HEADSET` `UNDEFINED` `FOLD_OPEN` `FOLD_CLOSED` `FLIP_OPEN` `FLIP_CLOSED` `FOLD_HALF_OPENED` `FLIP_HALF_OPENED` |
| `UnitType` | `INCH` `CM` `MM` `SP` `DP` `PX` |
| `AutoResizePercentBasis` | `HEIGHT` `WIDTH` `MIN_SIDE` |
| constants | `BASE_WIDTH_DP` (300), `BASE_HEIGHT_DP` (533), `BASE_DIAGONAL_DP` (611.6305), `BASE_PERIMETER_DP` (833), `REFERENCE_ASPECT_RATIO` (1.78), `INV_BASE_RATIO` (1/300), `ADJUSTMENT_SCALE` (0.1/30), `SENSITIVITY_DEFAULT` (0.08/30), `VERSION` |
| plumbing | `computeFactor(def, m, qualifier, inverter?, ignoreMultiWindows?, applyAspectRatio?, k?)`, `effectiveQualifier(q, inverter, isLandscape, isPortrait)`, `readScreenDp(m, q)`, `VARIANTS` (the 11 axis variants), types `StrategyDef`, `AxisVariant` |

## `webdimens/<strategy>` ([Strategies](./strategies.md))

`percent`, `power`, `fluid`, `auto`, `diagonal`, `fill`, `fit`, `interpolated`, `logarithmic`, `perimeter`, `density`. Each exports
the same shape as the scaled part of `webdimens` with its prefix: 264 accessors (`pwsdp`, `pwhspa`, …),
`toDynamic<Name>Dp/Px/Sp/SpPx`, the 48 facilitators (`pwsdpRotate`, `pwhspScreenPx`, …), `class Dimen<Name>` with prefixed
getters (`pwsdp`, `pwssp`, `pwsem` … and `Px` forms), `<id>Dp(value)` / `<id>Sp(value)` builders (`powerDp`, `fluidSp`) and the
definition constant (`POWER`, `FLUID`, …).

`webdimens/percent` additionally exports the literal `space*` API ([Units and space](./units.md#literal-percentages-space)):
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

`TextFitOptions`: `min?`, `max?`, `step?` (number = sp, or a `ResizeBound`), `maxLines?`.
`CanvasTextFitOptions`: `TextFitOptions` + `text`, `maxWidth`, `maxHeight?`, `font?`, `lineHeight?`, `letterSpacing?`.

## `webdimens/units` ([Units and space](./units.md))

```ts
function setPhysicalCalibration(pxPerInch: number): number;   // returns the previous value; RangeError if not positive
const mm, cm, inch, toDpFromMm, toDpFromCm, toDpFromInch: (value: number) => number;
const toPxFromMm, toPxFromCm, toPxFromInch, toSpFromMm, toSpFromCm, toSpFromInch: (value: number) => number;
const convertMmToCm, convertMmToInch, convertCmToMm, convertCmToInch, convertInchToCm, convertInchToMm: (v: number) => number;
function unitSizeInDp(type: UnitType): number;
const radius, radiusFromDiameter: (diameter: number, type?: UnitType) => number;
const radiusFromCircumference: (circumference: number, type?: UnitType) => number;
const measureDiameter, displayMeasureDiameter: (value: number, isCircumference: boolean) => number;
```

## `webdimens/postcss` ([CSS](./css.md#postcss-plugin))

```ts
export default function webdimens(options?: { atRule?: string }): WebDimensPostcssPlugin;   // webdimens.postcss === true
```

## Framework bindings ([Frameworks](./frameworks.md))

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

## Assets

| Path | Contents |
|---|---|
| `webdimens/css` (`css/webdimens.css`) | pure-CSS scaled tokens |
| `webdimens/css/all.css`, `webdimens/css/strategies/<id>.css` | every strategy / one strategy |
| `webdimens/scss` (`scss/_webdimens.scss`) | a Sass function per CSS token + `dimen($token, $value)` |
| `webdimens/global` (`dist/webdimens.global.js`) | CDN bundle: everything on `window.WebDimens`, installs on load unless `data-no-install` |
| `dist/webdimens.lite.global.js` | CDN bundle: runtime + scaled strategy |

Next: [Recipes](./recipes.md) · [Back to the index](./README.md)
