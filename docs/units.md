# Units and space

Two small modules for sizes that are not "dp scaled by the window": **physical units** (`webdimens/units`, mm / cm / inch) and
**literal percentages** of the window (`space*` in `webdimens/percent`).

## Physical units

```js
import { mm, cm, inch, toPxFromMm, toSpFromMm, unitSizeInDp, radius, radiusFromCircumference, UnitType } from 'webdimens/units';

mm(10);          // 37.80  CSS px (dp)
cm(2.5);         // 94.49
inch(1);         // 96
toPxFromMm(10);  // 113.39 device px on a DPR-3 screen (× devicePixelRatio)
toSpFromMm(3);   // the text size that renders 3 mm tall under the current font scale
```

Browsers do not expose the real screen DPI, so conversions use the CSS definition of absolute units: **1in = 96 CSS px**
(1 cm = 37.795 px, 1 mm = 3.7795 px). That is exactly what CSS `in`, `cm` and `mm` do, so in stylesheets you can write them
directly: `width: 10mm`. Android uses the panel's real `xdpi`; on the web, physical accuracy depends on the device.

For kiosks, signage or a known panel, calibrate once:

```js
import { setPhysicalCalibration } from 'webdimens/units';

setPhysicalCalibration(110);  // this panel shows 110 CSS px per real inch; returns the previous value (96)
mm(10);                        // 43.31
```

| Function | Result |
|---|---|
| `mm(v)` `cm(v)` `inch(v)` (= `toDpFromMm/Cm/Inch`) | CSS px |
| `toPxFromMm/Cm/Inch(v)` | device px |
| `toSpFromMm/Cm/Inch(v)` | sp (CSS px ÷ font scale) |
| `convertMmToCm`, `convertMmToInch`, `convertCmToMm`, `convertCmToInch`, `convertInchToCm`, `convertInchToMm` | pure conversions |
| `unitSizeInDp(UnitType)` | size of one unit in CSS px: `INCH` 96, `CM` 37.80, `MM` 3.78, `DP` 1, `SP` font scale, `PX` 1 / devicePixelRatio |
| `radius(diameter, type = DP)` (= `radiusFromDiameter`) | radius in CSS px: `radius(48, UnitType.MM)` → 90.71 |
| `radiusFromCircumference(c, type = DP)` | `radiusFromCircumference(100)` → 15.92 |
| `measureDiameter(value, isCircumference)` (= `displayMeasureDiameter`) | diameter from a diameter or circumference |

Typical use: minimum touch targets (`minh: 9mm` in CSS, or `mm(9)` in JS), print-like rulers, physical mock-ups.

## Literal percentages: `space*`

`webdimens/percent` also exports Android's `space*` API: the receiver is a percentage (0–100) of an axis, not a dp value.

```js
import { spaceW, spaceSw, spaceH, space, spaceWPx, spaceWSp } from 'webdimens/percent';

// 600 × 900 window
spaceW(10);        // 60    10 % of the width
spaceSw(10);       // 60    10 % of the smallest side
spaceH(10);        // 90
space(25, 200);    // 50    25 % of a reference length
spaceWPx(10);      // 120   device px on DPR 2
spaceWSp(5);       // 30 × font scale (fontScale defaults to true; pass false for the plain length)
```

| Family | Functions |
|---|---|
| width / smallest side / height | `spaceW` `spaceSw` `spaceH`, with `Px`, `i` and `Pxi` variants (`spaceWPx`, `spaceWi`, `spaceWPxi`, …) |
| reference length | `space(p, ref)`, `spaceI`, `spacePx`, `spacePxi` |
| text | `spaceWSp(p, fontScale = true, ignoreMultiWindows = false)`, `spaceSwSp`, `spaceHSp`, `spaceSp(p, ref, fontScale)` with `i` / `Px` variants |

The `i` variants follow Android's `literalPercentOfScreenDp`: in a multi-window state they return the raw percentage
(`spaceWi(50)` → 50) instead of a length. In CSS, plain viewport units already do this job: `width: 10vw`, `10vmin`.

`space*` is different from the **percent strategy** (`psdp`): `psdp(16)` scales a 16 dp design value linearly with the axis
(`16 × d / 300`), while `spaceW(16)` is 16 % of the width.

Next: [Performance](./performance.md) · [Back to the index](./README.md)
