# Resize

`webdimens/resize` is the web version of AppDimens' resize module (`autoResizeTextSp`, `ResizeBound`). It is **not** a scaling
curve: it finds the **largest** size in a `[min, max]` range, in `step` increments, that still fits the available space, by
binary search over a step table. Use it for headlines and labels that must fill a box without overflowing, and for boxes sized
to the space they get.

```js
import { autoResizeText, fittingTextSize, fittingTextPx, fittingBoxPx } from 'webdimens/resize';
```

The CDN bundle exposes the same functions on `window.WebDimens`.

## Auto-fitting text in an element

```html
<h1 id="title" style="height: 64px; overflow: hidden; white-space: nowrap">Single-line headline that always fits</h1>
<p id="lead" style="height: 72px; overflow: hidden; line-height: 1.2">A paragraph that may wrap onto at most two lines…</p>
<script type="module">
  import { autoResizeText } from 'webdimens/resize';

  const title = autoResizeText(document.getElementById('title'), { min: 10, max: 48 });
  const lead = autoResizeText(document.getElementById('lead'), { min: 10, max: 32, step: 0.5, maxLines: 2 });

  title.fontSize;      // the applied size in CSS px
  title.refit();       // fit again now
  title.disconnect();  // stop observing
</script>
```

`autoResizeText(element, options)` fits immediately, sets `element.style.fontSize` and keeps it fitted: it re-fits when the
element's box changes (`ResizeObserver`, ignoring the change its own font-size write causes), when its text changes
(`MutationObserver`) and on window resize — at most once per animation frame.

`fittingTextSize(element, options)` does a single fit and returns the size (CSS px). Both measure the element's own layout, so
they respect its font family, weight, letter-spacing, padding and `line-height`.

| Option | Default | Meaning |
|---|---|---|
| `min` | `8` | smallest size; a number is **sp** (× font scale) or a bound (below) |
| `max` | `96` | largest size |
| `step` | `1` | granularity |
| `maxLines` | unlimited | also require the text to use at most this many lines |

Lines are counted from the rendered line boxes (`Range.getClientRects()`); when layout gives none (old engines, tests) the
content height is measured at `height: auto` and divided by the line height. If nothing fits, the minimum is applied.

### The box must be constrained

The element needs a definite width (and height, unless you rely on `maxLines`). Inside grid and flex layouts, items default to
`min-width: auto` and grow to fit their content, so the text always "fits" at the maximum size:

```css
/* before: the nowrap headline stretches the grid track — always 48px, page overflows */
.page { display: grid; }

/* after: the track can shrink below its content */
.page { display: grid; grid-template-columns: minmax(0, 1fr); }
.row > .title { min-width: 0; }          /* flex items */
```

## Canvas-based fitting (no reflow)

`fittingTextPx(options)` measures with a canvas 2D context instead of the DOM, so it never forces layout — useful for many
labels, virtualized lists, or canvas / WebGL UIs.

```js
import { fittingTextPx } from 'webdimens/resize';

fittingTextPx({ text: 'Revenue by region', maxWidth: 240, maxLines: 1, font: '600 Inter, sans-serif' });   // → px
fittingTextPx({ text: longText, maxWidth: 320, maxHeight: 96, lineHeight: 1.3, min: 10, max: 28 });
```

| Option | Default | |
|---|---|---|
| `text` | required | `\n` starts a new paragraph |
| `maxWidth` | required | CSS px |
| `maxHeight` | none | CSS px; with `lineHeight` limits the number of lines |
| `maxLines` | unlimited | |
| `font` | `'sans-serif'` | CSS font without (or with) a size: `'600 italic Inter, sans-serif'`; the size is inserted per candidate |
| `lineHeight` | `1.2` | multiplier |
| `letterSpacing` | `0` | CSS px per character |
| `min` / `max` / `step` | `8` / `96` / `1` | as above |

Words are wrapped greedily; a single word wider than `maxWidth` does not fit at that size. Returns `0` when nothing fits.
Without a canvas (Node), glyphs are approximated as 0.55 em wide.

## Boxes

`fittingBoxPx(min, max, step, availablePx)` returns the largest step not exceeding the available size — square thumbnails,
avatars, tiles:

```js
import { fittingBoxPx, resizePercentW } from 'webdimens/resize';

fittingBoxPx(48, 160, 8, container.clientWidth / 3);        // largest of 48, 56, … 160 that fits a third of the container
fittingBoxPx(48, resizePercentW(30), 4, 100);               // max = 30 % of the viewport width → 100 on a wide window
```

For boxes, plain numbers are **dp** (CSS px); for text they are **sp**.

## Bounds

| Bound | Meaning |
|---|---|
| a number | sp for text, dp for boxes |
| `resizeFixedDp(dp)` | fixed CSS px |
| `resizeFixedSp(sp)` | sp × font scale |
| `resizePercentSw(p)` / `resizePercentW(p)` / `resizePercentH(p)` | 0–100 % of the viewport's smallest side / width / height |
| `resizePercentBox(p, basis = MIN_SIDE)` | 0–100 % of the element's inner box; `AutoResizePercentBasis.WIDTH`, `HEIGHT` or `MIN_SIDE` |

```js
import { autoResizeText, resizePercentBox, resizeFixedSp, AutoResizePercentBasis } from 'webdimens/resize';

autoResizeText(badge, {
  min: resizeFixedSp(10),
  max: resizePercentBox(60, AutoResizePercentBasis.HEIGHT),  // at most 60 % of the badge height
});
```

`resolveBound(bound, box?, metrics?)` converts a bound to CSS px. Percentages are clamped to 0–100 and negative sizes to 0.

## Low-level helpers

```js
import { buildResizeStepsPx, findLargestFittingResizePx, ResizeRangePx } from 'webdimens/resize';

buildResizeStepsPx(10, 15, 2);                     // Float64Array [10, 12, 14, 15] (max always included, ≤ 4096 steps)
findLargestFittingResizePx(steps, (px) => px <= 13);  // 12 — binary search, O(log n) calls to fits()
new ResizeRangePx(10, 15, 2).resolveFitting((px) => px <= 13);   // 12
```

A runnable page with three fitted boxes is [examples/resize.html](../examples/resize.html).

Next: [Units and space](./units.md) · [Back to the index](./README.md)
