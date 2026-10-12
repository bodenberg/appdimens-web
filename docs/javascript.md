# JavaScript API

The JavaScript side mirrors the Android `Number` extensions as functions (`sdp(16)` for `16.sdp`), and adds string helpers so
you can write units instead of px (`dimen('16sdp')`, `dimens({ padding: '8sdp 16sdp' })`). All examples use a pinned
600 × 900 window with devicePixelRatio 2 and font scale 1.25, so the numbers are reproducible:

```js
import { setMetrics } from 'webdimens';
setMetrics({ screenWidthDp: 600, screenHeightDp: 900, density: 2, fontScale: 1.25 });
```

## Accessors

Each strategy module exports 264 functions named after the Android properties. They take a value in dp and return CSS px
(or device px for `Px` names):

```js
import { sdp, hdp, wdp, ssp, sem, sdpa, sdpPx, sspPx, sdpPh, hdpLw } from 'webdimens';

sdp(16);    // 32       16 × 600/300
hdp(16);    // 48       height axis
wdp(16);    // 32       width axis
ssp(16);    // 40       × font scale 1.25
sem(16);    // 32       text without font scale
sdpa(16);   // 29.81    aspect-ratio variant
sdpPx(16);  // 64       device px (× DPR 2)
sspPx(16);  // 80
sdpPh(16);  // 48       portrait → height
hdpLw(16);  // 48       landscape → width (portrait here: height)
```

The full set per strategy: `<prefix><s|h|w><dp|sp|em><inverter?><a|i|ia?><Px?>` (see [Concepts](./concepts.md#token-grammar)).
Other strategies come from their modules:

```js
import { pwsdp, pwhspa } from 'webdimens/power';
import { fsdp } from 'webdimens/fluid';

pwsdp(16);  // 26.91    16 × (600/300)^0.75
```

The functions read a precomputed table: one branch and one multiply, about 9 ns per call
(see [Performance](./performance.md)). In a framework, re-render when the window changes (`useDimens()`, `useDimen()`, … in
[Frameworks](./frameworks.md)) or prefer CSS for layout.

## Units as strings

```js
import { dimen, dimenCss, dimens, dimensPx, parseToken, parseDimenLiteral, cssDimen } from 'webdimens';

dimen('16sdp');      // 32      any token: '14sspa', '8hdpLw', '10pwsdp'
dimen('14ssp');      // 35
dimen('2sdpPx');     // 8       device px
dimen(12);           // 12      numbers pass through
dimen('12px');       // 12      so does px
dimen('12vh');       // TypeError: cannot resolve "12vh"

dimenCss('8sdp 16sdp');          // 'calc(8 * var(--sdp)) calc(16 * var(--sdp))'
dimenCss('max(16sdp, 10px)');    // 'max(calc(16 * var(--sdp)), 10px)'
cssDimen('sdpa', 16);            // 'calc(16 * var(--sdpa))'
```

### Style objects

`dimens()` compiles every string value to responsive CSS (no re-render needed, SSR-safe). `dimensPx()` resolves to px for the
current window (re-render on change):

```js
dimens({ padding: '8sdp 16sdp', fontSize: '14ssp', opacity: 0.5 });
// { padding: 'calc(8 * var(--sdp)) calc(16 * var(--sdp))', fontSize: 'calc(14 * var(--ssp))', opacity: 0.5 }

dimensPx({ padding: '8sdp 16sdp', width: '120wdp' });
// { padding: '16px 32px', width: 240 }
```

```jsx
<div style={dimens({ padding: '16sdp', borderRadius: '12sdp' })} />
```

```js
Object.assign(element.style, dimens({ padding: '8sdp 16sdp', fontSize: '14ssp' }));
```

### Parsing

```js
parseDimenLiteral('-8sdp');   // { value: -8, token: { name: 'sdp', … } }
parseToken('pwhdpLwa');
// { name: 'pwhdpLwa', prefix: 'pw', strategy: 'power', axis: 'h', kind: 'dp',
//   inverter: 'Lw', flags: 'a', px: false, slot: 29, css: true }
```

Any strategy works without importing its module: `dimen('10logsdp')` registers the logarithmic strategy on first use.
Errors are explicit: `dimenCss('2sdpPx')` throws because `Px` tokens are JavaScript-only.

## Generic resolvers

`toDynamic<Strategy>Dp / Px / Sp / SpPx(value, qualifier?, options?)` reach every combination, including a custom
aspect-ratio sensitivity:

```js
import { toDynamicScaledDp, toDynamicScaledSp, DpQualifier, Inverter } from 'webdimens';

toDynamicScaledDp(10, DpQualifier.HEIGHT, { applyAspectRatio: true });                 // 27.26
toDynamicScaledDp(10, DpQualifier.SMALL_WIDTH, { applyAspectRatio: true, customSensitivityK: 0.01 }); // 14.87
toDynamicScaledDp(10, DpQualifier.WIDTH, { inverter: Inverter.PW_TO_LH });             // = wdpLh(10)
toDynamicScaledSp(10);                                                                 // 25
toDynamicScaledSp(10, DpQualifier.SMALL_WIDTH, { fontScale: false });                  // 20
```

| Option | Default | Meaning |
|---|---|---|
| `inverter` | `Inverter.DEFAULT` | orientation axis swap |
| `ignoreMultiWindows` | `false` | unscaled value in a split / floating window |
| `applyAspectRatio` | `false` | aspect-ratio correction |
| `customSensitivityK` | `null` (= 0.08 / 30) | sensitivity of the correction; must be finite (else `RangeError`) |
| `fontScale` | `true` | `Sp` resolvers only: multiply by the font scale |

Other strategies: `toDynamicPowerDp`, `toDynamicFluidPx`, … (`toDynamic` + strategy name).

## Facilitators

Pick an alternate value depending on orientation, UI mode or a dp threshold, like the Android facilitators. Each exists for
`sdp`/`hdp`/`wdp` and `ssp`/`hsp`/`wsp`, with a `Px` variant, in every strategy (`pwsdpRotate`, …).

```js
import { sdpRotate, sdpMode, sdpQualifier, sdpScreen, DpQualifier, Orientation, UiModeType } from 'webdimens';

// sdpRotate(value, rotationValue, orientation = LANDSCAPE, options?)
sdpRotate(10, 30);                         // 20  (portrait window → value)
sdpRotate(10, 30, Orientation.PORTRAIT);   // 60  (portrait matches → rotationValue)

// sdpMode(value, modeValue, uiModeType, options?)
sdpMode(10, 40, UiModeType.TELEVISION);    // 20 here; 144 on a 1920 × 1080 TV

// sdpQualifier(value, qualifiedValue, qualifierType, qualifierValue, options?)
sdpQualifier(10, 20, DpQualifier.SMALL_WIDTH, 600);   // 40  (sw 600 ≥ 600)
sdpQualifier(10, 20, DpQualifier.SMALL_WIDTH, 601);   // 20

// sdpScreen(value, screenValue, uiModeType, qualifierType, qualifierValue, options?)
sdpScreen(10, 30, UiModeType.TELEVISION, DpQualifier.SMALL_WIDTH, 1000); // 108 on a 1920 × 1080 TV
```

The alternate value is scaled on the function's own axis unless `options.finalQualifierResolver` says otherwise:

```js
sdpRotate(10, 30, Orientation.LANDSCAPE, { finalQualifierResolver: DpQualifier.WIDTH }); // on 900 × 600: 30 × 900/300 = 90
```

Options also accept `ignoreMultiWindows`, `applyAspectRatio`, `customSensitivityK` and (for `sp`) `fontScale`.

### Plain branches

When both values are already final, branch without scaling:

```js
import { plainRotate, plainMode, plainQualifier, plainScreen } from 'webdimens';

plainRotate('1fr', '1fr 1fr');                       // two columns in landscape
plainQualifier('a', 'b', DpQualifier.WIDTH, 600);    // 'b' on 600 × 900
plainMode(menuCompact, menuTv, UiModeType.TELEVISION);
```

## Builders

`scaledDp(value)` (and `scaledSp`) mirror Android's `16.scaledDp()`: immutable, with `.screen()` rules resolved by priority.

```js
import { scaledDp, UiModeType, DpQualifier, Orientation } from 'webdimens';

const gutter = scaledDp(16)
  .screen(UiModeType.TELEVISION, 40)            // priority 2: UI mode
  .screen(DpQualifier.SMALL_WIDTH, 600, 24)     // priority 3: qualifier
  .screen(Orientation.LANDSCAPE, 20);           // priority 4: orientation

gutter.sdp;
// 360 × 740 phone  → 19.2   (16 × 1.2, nothing matches)
// 1000 × 500       → 33.33  (landscape: 20 × 500/300)
// 600 × 900        → 48     (sw600: 24 × 2)
// 1920 × 1080 TV   → 144    (TV: 40 × 3.6)
```

| `.screen(…)` overload | Priority |
|---|---|
| `(uiModeType, qualifierType, qualifierValue, value, finalQualifierResolver?, inverter?, orientation?)` | 1 |
| `(uiModeType, value, finalQualifierResolver?, inverter?, orientation?)` | 2 |
| `(qualifierType, qualifierValue, value, finalQualifierResolver?, inverter?, orientation?)` | 3 (larger threshold first) |
| `(orientation, value, finalQualifierResolver?, inverter?)` | 4 |
| `({ uiModeType?, qualifier?: [type, value] or { type, value }, orientation?, value, finalQualifierResolver?, inverter? })` | derived from the fields |

Other methods: `.aspectRatio(apply = true, k?)`, `.applyAspectRatio(apply)`, `.ignoreMultiWindows(ignore = true)`.
Terminals: `.sdp .hdp .wdp .ssp .hsp .wsp .sem .hem .wem`, each with a `Px` twin (`.sdpPx` …), `.dp(q)`, `.px(q)`,
`.sp(q, fontScale)`, `.spPx(q, fontScale)` and `.all()` → `{ sdp, hdp, wdp }`. Results are memoized per snapshot, so reading
`.sdp` in a render loop costs about 18 ns.

Strategy builders have prefixed terminals: `powerDp(16).pwsdp` (26.91 on 600 × 900), `fluidSp(14).fssp`, …
Invalid input throws: `.screen('NOPE', 2)` and non-finite values raise `TypeError`.

## Enums

| Enum | Values |
|---|---|
| `DpQualifier` | `SMALL_WIDTH`, `HEIGHT`, `WIDTH` |
| `Orientation` | `PORTRAIT`, `LANDSCAPE`, `DEFAULT` |
| `Inverter` | `PH_TO_LW`, `PW_TO_LH`, `LH_TO_PW`, `LW_TO_PH`, `SW_TO_LH`, `SW_TO_LW`, `SW_TO_PH`, `SW_TO_PW`, `DEFAULT` |
| `UiModeType` | `NORMAL`, `TELEVISION`, `CAR`, `WATCH`, `DESK`, `APPLIANCE`, `VR_HEADSET`, `UNDEFINED`, `FOLD_OPEN`, `FOLD_CLOSED`, `FLIP_OPEN`, `FLIP_CLOSED`, `FOLD_HALF_OPENED`, `FLIP_HALF_OPENED` |
| `UnitType` | `INCH`, `CM`, `MM`, `SP`, `DP`, `PX` |
| `AutoResizePercentBasis` | `HEIGHT`, `WIDTH`, `MIN_SIDE` |

They are frozen string maps, so the literal strings work too: `sdpMode(10, 40, 'TELEVISION')`.

## Canvas: device pixels

```js
import { hdp, sdpPx, sspPx, subscribe } from 'webdimens';

function draw(canvas) {
  const cssHeight = hdp(220);                      // layout: CSS px
  canvas.style.height = `${cssHeight}px`;
  canvas.width = canvas.clientWidth * devicePixelRatio;
  canvas.height = cssHeight * devicePixelRatio;
  const ctx = canvas.getContext('2d');
  ctx.lineWidth = sdpPx(2);                        // drawing: device px
  ctx.font = `${sspPx(12)}px system-ui`;
  // …
}
subscribe(() => draw(canvas));                     // redraw when the window changes
```

A complete chart is in [examples/canvas.html](../examples/canvas.html).

Next: [Strategies](./strategies.md) · [Back to the index](./README.md)
