# Declarative units

Write `16sdp`, `14ssp`, `12sspa` instead of px directly in HTML: dimension **classes**, **`data-dimen`** attributes and
**`<style data-webdimens>`** blocks, with Android-qualifier **conditions** (`@landscape`, `@sw600`, `@tv`…) and **modifier
classes** that switch flags or the strategy of a whole subtree. Everything here compiles once to ordinary CSS; resizing the
window never runs JavaScript for these rules.

Requires the runtime: `install()` in your entry point, or the CDN script (which installs on load).

## Dimension classes

```html
<div class="p:16sdp r:12sdp fs:14ssp">…</div>
<div class="m:8sdp_16sdp w:120wdp h:48hdp">…</div>
<h1 class="fs:20ssp fs@landscape:24ssp fs@sw600:28ssp fs@tv:40ssp">…</h1>
```

Syntax: **`property[@condition…]:value[!]`**

- `property`: a short alias (table below), any CSS property name (`border-top-width:2sdp`) or a custom property (`--gap:12sdp`).
- `value`: one or more literals; `_` stands for a space (`m:8sdp_16sdp`). Plain CSS values may be mixed in (`m:8sdp_auto`).
- `!` at the end adds `!important`.

Each class compiles once into a rule. Real compiler output:

| Class | Compiled CSS |
|---|---|
| `p:16sdp` | `.p\:16sdp{padding:calc(16 * var(--sdp))}` |
| `m:8sdp_16sdp` | `.m\:8sdp_16sdp{margin:calc(8 * var(--sdp)) calc(16 * var(--sdp))}` |
| `size:48sdp` | `.size\:48sdp{width:calc(48 * var(--sdp));height:calc(48 * var(--sdp))}` |
| `--gap:12sdp` | `.--gap\:12sdp{--gap:calc(12 * var(--sdp))}` |
| `p:16sdp!` | `.p\:16sdp\!{padding:calc(16 * var(--sdp)) !important}` |
| `p@landscape:24sdp` | `@media (orientation: landscape){.p\@landscape\:24sdp{padding:calc(24 * var(--sdp))}}` |
| `p@sw600:32sdp` | `@media (min-width: 600px) and (min-height: 600px){.p\@sw600\:32sdp{…}}` |
| `fs@tv:28ssp` | `:root[data-ad-mode="tv"] .fs\@tv\:28ssp{font-size:calc(28 * var(--ssp))}` |
| `p@tv@sw600:48sdp` | `@media (min-width: 600px) and (min-height: 600px){:root[data-ad-mode="tv"] .p\@tv\@sw600\:48sdp{…}}` |
| `w@mw:100wdp` | `:root[data-ad-multi-window] .w\@mw\:100wdp{width:calc(100 * var(--wdp))}` |

### Property aliases

| Alias | Property | Alias | Property |
|---|---|---|---|
| `p` | padding | `m` | margin |
| `pt` `pr` `pb` `pl` | padding-top / right / bottom / left | `mt` `mr` `mb` `ml` | margin-top / right / bottom / left |
| `px` `py` | padding-inline / padding-block | `mx` `my` | margin-inline / margin-block |
| `ps` `pe` | padding-inline-start / end | `ms` `me` | margin-inline-start / end |
| `w` `h` | width / height | `size` | width **and** height |
| `minw` `minh` | min-width / min-height | `maxw` `maxh` | max-width / max-height |
| `fs` | font-size | `lh` | line-height |
| `ls` | letter-spacing | `indent` | text-indent |
| `gap` | gap | `gapx` `gapy` | column-gap / row-gap |
| `r` `radius` | border-radius | `bw` `ow` | border-width / outline-width |
| `basis` | flex-basis | | |

The aliases are exported as `PROPERTY_ALIASES`.

## Conditions

Conditions follow `@` and mirror Android resource qualifiers and the `.screen()` builder:

| Condition | Matches | Compiles to |
|---|---|---|
| `@landscape` / `@portrait` | orientation | `@media (orientation: landscape)` |
| `@sw600` (or `@sw600dp`) | smallest width ≥ 600 dp (`values-sw600dp`) | `@media (min-width: 600px) and (min-height: 600px)` |
| `@w840` | width ≥ 840 dp | `@media (min-width: 840px)` |
| `@h480` | height ≥ 480 dp | `@media (min-height: 480px)` |
| `@tv` (`@television`) | UI mode TELEVISION | `:root[data-ad-mode="tv"] …` |
| `@car` `@watch` `@desk` `@appliance` `@vr` `@normal` `@undefined` | other UI modes | `:root[data-ad-mode="car"]` … |
| `@fold-open` `@fold-half` `@fold-closed` `@flip-open` `@flip-half` `@flip-closed` | foldable postures | `:root[data-ad-mode="fold-half"]` … |
| `@mw` (`@multi-window`) | split / floating window (web-only) | `:root[data-ad-multi-window] …` |

Conditions combine with `@a@b` (`p@tv@sw600:48sdp`, `gap@portrait@h700:12hdp`) and are case-insensitive. The UI-mode names are
exported as `MODE_CONDITIONS`. An unknown condition makes the class a non-dimension class (ignored).

### Priority

When several rules for the same property match, the result follows Android's `.screen()` priority, **whatever the order of the
classes or the order in which they were discovered**:

1. UI mode **and** qualifier (`@tv@sw600`)
2. UI mode (`@tv`, `@mw`)
3. qualifier (`@sw600`, `@w840`, `@h480`) — a larger threshold wins over a smaller one
4. orientation (`@landscape`)
5. no condition

```html
<div class="p:8sdp p@landscape:12sdp p@sw600:16sdp p@tv:24sdp p@tv@sw600:32sdp">…</div>
```

| Window | Matching rules | Padding |
|---|---|---|
| 360 × 740 phone | default | 8sdp = 9.6 px |
| 740 × 360 phone, landscape | default, `@landscape` | 12sdp = 14.4 px |
| 900 × 600 tablet, landscape | default, `@landscape`, `@sw600` | 16sdp = 32 px |
| 1920 × 1080 TV | all five | 32sdp = 115.2 px |
| 500 × 400 TV box | default, `@landscape`, `@tv` | 24sdp = 32 px |

This exact behaviour is checked in a real browser by `scripts/examples-check.mjs` on [examples/declarative.html](../examples/declarative.html).

## `data-dimen` attributes

Several declarations in one attribute, with the same properties, aliases and conditions:

```html
<section data-dimen="padding: 8sdp 16sdp; font-size: 14ssp; padding@landscape: 12sdp 24sdp; font-size@tv: 28ssp">
```

Compiled (abbreviated):

```css
[data-dimen="padding: 8sdp 16sdp; font-size@landscape: 18ssp"]{padding:calc(8 * var(--sdp)) calc(16 * var(--sdp))}
@media (orientation: landscape){[data-dimen="…"]{font-size:calc(18 * var(--ssp))}}
```

Declarations without a unit are passed through as plain CSS (`data-dimen="padding: 8sdp; color: red"`). Malformed input
(missing `:`, unknown property or condition, empty value, unsafe characters) logs a `SyntaxError` to the console and the
attribute is skipped; the rest of the page is still compiled.

## `<style data-webdimens>` blocks

For CSS written in the page without a build step:

```html
<style data-webdimens>
  .card { padding: 8sdp 16sdp; font-size: 14ssp; }
  .card img { width: 48sdp; height: 48sdp; }
</style>
```

The runtime replaces each literal in place (`.card{padding:calc(8 * var(--sdp)) calc(16 * var(--sdp));…}`) and recompiles the
block if a framework edits it later. Use normal `@media` rules for conditions here; the `@dimen` block syntax belongs to the
[PostCSS plugin](./css.md#postcss-plugin).

## Modifier classes

Modifier classes change what the unprefixed tokens mean **inside a subtree**, by redirecting the CSS custom properties:

| Class | Effect inside the element | Example |
|---|---|---|
| `ad-a` | `sdp` behaves as `sdpa`, `ssp` as `sspa`, … (aspect ratio) | `<section class="ad-a">` |
| `ad-i` | ignore multi-window (`sdp` → `sdpi`) | |
| `ad-ia` | both | |
| `ad-<strategy>` | every unprefixed token uses that strategy: `ad-power`, `ad-fluid`, `ad-auto`, `ad-percent`, `ad-logarithmic`, `ad-interpolated`, `ad-diagonal`, `ad-perimeter`, `ad-fill`, `ad-fit`, `ad-density` | `<aside class="ad-power">` |

```html
<main>
  <article class="p:16sdp">scaled</article>
  <article class="p:16sdp ad-a">scaled + aspect ratio</article>
  <aside class="ad-power">
    <div class="p:16sdp">power</div>             <!-- 16 × (sw/300)^0.75 -->
    <div class="p:16sdp ad-a">power + aspect ratio</div>
  </aside>
</main>
```

How it works: `.ad-a` sets `--sdp: var(--sdpa); --sdpi: var(--sdpia); …` and `.ad-power` sets `--sdp: var(--pwsdp); …`, so
every rule that reads `var(--sdp)` (classes, `data-dimen`, your own CSS) follows. The classes nest and combine
(`class="ad-fluid ad-a"`), and they also work on `<html>`. Using `ad-power` registers the power strategy
automatically. Explicit tokens always win: `p:16pwsdpa` is power + aspect ratio anywhere.

## `<html>` attributes

While installed, the runtime keeps these on `<html>` (used by the `@tv` / `@mw` rules and available to your own CSS):

| Attribute | Values |
|---|---|
| `data-ad-mode` | `normal`, `tv`, `car`, `watch`, `desk`, `appliance`, `vr`, `undefined`, `fold-open`, `fold-closed`, `fold-half`, `flip-open`, `flip-closed`, `flip-half` |
| `data-ad-orientation` | `portrait` / `landscape` |
| `data-ad-multi-window` | present while the window is split / floating |

```css
:root[data-ad-mode="tv"] .menu { display: none; }
```

## What is ignored, and safety

- **Classes without a unit token** are not touched, so other frameworks' classes stay theirs: `hover:bg-red-500`, `md:p-4`,
  `p:4px` are ignored.
- **JavaScript-only tokens** (`2sdpPx`, `14sspLw`) cannot be CSS. Such a class is skipped with a one-time console warning; it
  never stops the rest of the page from compiling.
- **Strategies register themselves**: `p:10pwsdp` compiles to `calc(10 * var(--pwsdp))` and registers the power strategy, so
  `--pwsdp` is published; nothing needs to be imported.
- **CSS-injection guard**: values containing `{`, `}`, `;`, `<`, `/*` or a backslash that could escape the rule are rejected
  (`p:16sdp)}body{background:red` is ignored). Ordinary escapes such as `content: "\201C"` remain allowed in `data-dimen`.
- Text inside `url(...)` and quoted strings is never rewritten.

## API and options

| | |
|---|---|
| `install({ declarative: false })` | keep CSS variables and JS, skip the class / attribute compiler |
| `flushDeclarative()` | compile what was added since the last frame immediately (tests, or before reading layout) |
| `dimenClassesToCss(classes, attributeValues?)` | compile to a CSS string without a DOM (SSR, build tools) — see [SSR](./ssr.md) |
| `compileDimenClass(name)` / `compileDimenAttribute(text)` | compile one class / attribute (returns `{ css, order }` rules) |
| `compileCssText(text)` | compile a stylesheet text (what `<style data-webdimens>` uses) |
| `modifierCss(strategies)` | the CSS of the modifier classes |

```js
import { dimenClassesToCss } from 'webdimens';
dimenClassesToCss(['p:16sdp', 'fs@tv:28ssp']);
// .p\:16sdp{padding:calc(16 * var(--sdp))}
// :root[data-ad-mode="tv"] .fs\@tv\:28ssp{font-size:calc(28 * var(--ssp))}
```

## Performance

- Each distinct class or attribute string is compiled **once**; a `MutationObserver` picks up new nodes and class changes
  (batched per animation frame). Attribute changes only re-check the changed element, never its subtree.
- Resizing the window rewrites only the CSS custom properties; the compiled rules never change, so there is no per-resize
  JavaScript for them.
- Measured in Chromium: `install()` on a page with 10,000 elements with dimension classes takes about 26 ms; 1,000 class
  toggles about 3 ms; 1,000 new nodes about 5 ms. See [Performance](./performance.md).

Next: [CSS, Sass and PostCSS](./css.md) · [Back to the index](./README.md)
