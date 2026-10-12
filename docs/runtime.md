# Runtime

The runtime is the web counterpart of Android's `DimenCache`: it measures the viewport into an immutable snapshot, keeps one
precomputed factor table per strategy, publishes the CSS custom properties and notifies subscribers. This page covers its
options, events, snapshots, UI-mode and multi-window detection, CSP, element scopes and strategy registration.

## install(), configure(), uninstall()

```js
import { install, configure, uninstall, UiModeType } from 'webdimens';

install();                                   // tracking + CSS variables + declarative compiler
configure({ fontScale: 1.2 });               // change options later; unspecified keys keep their value
uninstall();                                 // stop tracking, remove generated CSS and <html> attributes
```

| Option | Type | Default | Effect |
|---|---|---|---|
| `cssVariables` | `boolean` | `true` once `install()` runs | publish `--sdp`, `--ssp`, … on `:root` |
| `declarative` *(install only)* | `boolean` | `true` | compile classes, `data-dimen`, `<style data-webdimens>`, modifier classes |
| `strategies` *(install only)* | `string[]` or `'all'` | `[]` | register strategies whose variables are used by CSS the runtime never parses (hand-written `var(--fsdp)`, PostCSS output); throws `RangeError` for an unknown id |
| `cssNonce` | `string` | — | nonce for the fallback `<style>` element under a strict CSP |
| `uiModeType` | `UiModeType` or `(size) => UiModeType` | detected | force the UI mode (kiosk, TV app) |
| `fontScale` | `number` | measured | force the font scale |
| `multiWindow` | `boolean` or `(size) => boolean` | detected | force the multi-window state |
| `measure` | `() => ({ width, height })` | `innerWidth` × layout-viewport height | measure something else as "the window" |

`install()` is idempotent: later calls update options. The CDN bundles call it on load (opt out with
`<script … data-no-install>`). Accessors such as `sdp()` work without `install()`; they start tracking the viewport lazily.

```js
// A TV app that always renders the 10-foot UI, with a custom measure:
install({
  uiModeType: UiModeType.TELEVISION,
  measure: () => ({ width: document.documentElement.clientWidth, height: window.innerHeight }),
});

// Resolver functions are re-evaluated on every snapshot:
configure({ uiModeType: ({ width }) => (width >= 1280 ? UiModeType.TELEVISION : UiModeType.NORMAL) });
```

## Events and the update cycle

The runtime listens to `resize`, `orientationchange`, `pageshow`, a `(resolution: Ndppx)` media query (page zoom / moving the
window to another monitor) and the Device Posture `change` event. A listener only **marks the snapshot dirty**:

1. The next read (`sdp()`, `getMetrics()`, …) rebuilds the snapshot synchronously, so a value read right after a resize is never
   stale.
2. At the next animation frame the runtime writes the CSS custom properties (if they changed) and calls subscribers, at most
   once per frame however many events fired.

The height comes from the layout viewport, so mobile URL bars appearing or disappearing while scrolling do not change `hdp`.

## Snapshots

```js
import { getMetrics, getVersion, subscribe, refresh, flush, setMetrics, DimenMetrics } from 'webdimens';

const m = getMetrics();          // immutable DimenMetrics for the current window
getVersion();                    // increments whenever the snapshot really changes

const off = subscribe((m) => {   // at most once per frame
  console.log(m.screenWidthDp, m.orientation, m.uiModeType);
});
off();

refresh();                       // re-measure (also the font scale), e.g. after a settings change
flush();                         // apply a pending change now (CSS + subscribers), useful in tests

setMetrics({ screenWidthDp: 412, screenHeightDp: 915, density: 2.625 });   // pin (SSR, tests, previews)
setMetrics(new DimenMetrics({ screenWidthDp: 1920, screenHeightDp: 1080 }));
setMetrics(null);                // back to the live viewport
```

`DimenMetrics` fields are listed in [Concepts](./concepts.md#the-viewport-snapshot). Invalid inputs are sanitized (negative or
`NaN` sizes become 0, density and font scale fall back to 1). `m.equals(other)` compares the raw inputs.

## UI mode detection

`detectUiModeType()` is a heuristic, applied unless you force `uiModeType`:

| Signal | Result |
|---|---|
| user agent mentions SmartTV, Tizen TV, webOS, HbbTV, Apple TV, Google TV, Android TV, BRAVIA, NetCast, Roku, Chromecast, Fire TV | `TELEVISION` |
| Oculus / Pico / Quest browsers | `VR_HEADSET` |
| "Watch" / Wear OS | `WATCH` |
| Android Automotive | `CAR` |
| Viewport Segments API reports two segments | `FOLD_OPEN` / `FOLD_HALF_OPENED` (side by side) or `FLIP_OPEN` / `FLIP_HALF_OPENED` (stacked), half-opened when Device Posture reports `folded` |
| otherwise | `NORMAL` |

Browsers expose little about the device, so force the mode whenever you know it (TV apps, kiosks, car displays).
The current mode is also on `<html data-ad-mode="…">`.

## Multi-window detection

Android knows when an app is in split screen; browsers do not. The heuristic mirrors Android's fallback: the window counts as
multi-window when it is at least 10 % narrower than the screen (`screen.availWidth − outerWidth ≥ 10 %`). Both values ignore
page zoom in Chromium. It drives the `i` variants, the `ad-i` class and the `@mw` condition. Force it with
`configure({ multiWindow: false })` if a desktop window that is not maximized should still scale normally.

## Font scale

The font scale is the browser's default font size divided by 16, measured once with a hidden `font-size: medium` element
(so a site rule like `html { font-size: 62.5% }` does not affect it). Users change it in the browser settings; call `refresh()`
to measure again, or force it with `configure({ fontScale })`.

## CSP and where the CSS goes

CSS variables and compiled rules are written to **constructable stylesheets** (`document.adoptedStyleSheets`), which a Content
Security Policy does not block. Where those are unavailable, the runtime falls back to `<style id="webdimens-vars">` and
`<style id="webdimens-declarative">` elements; pass `cssNonce` if your CSP requires a nonce for them. The variables use the
selector `:root:root`, so they override the pure-CSS fallback file.

## Element scopes

`createDimenScope(element)` treats an element's content box as the "window" — the web version of Android's per-window
snapshots. The CSS variables are written on the element, so every `var(--sdp)` inside follows the element instead of the
viewport.

```html
<div id="panel" style="resize: both; overflow: auto; width: 300px; height: 260px">
  <div class="card" style="padding: calc(16 * var(--sdp))">Scoped</div>
</div>
<script type="module">
  import { createDimenScope } from 'webdimens';

  const scope = createDimenScope(document.getElementById('panel'), {
    onChange: (m) => console.log('panel sw', m.smallestWidthDp),   // also fires once during creation
  });
  scope.metrics;            // DimenMetrics of the panel
  scope.dp(16);             // 16 × panelSw / 300
  scope.sp(14);             // × font scale
  scope.update();           // re-measure now
  scope.disconnect();       // stop observing, remove the variables from the element
</script>
```

| Option | Default | |
|---|---|---|
| `strategies` | every registered strategy | which strategies' variables are written on the element |
| `cssVariables` | `true` | write the variables on the element |
| `onChange(metrics)` | — | called when the element snapshot changes (and once at creation) |

The scope uses a `ResizeObserver`; density, font scale, UI mode and multi-window come from the global snapshot. Scopes are
ideal for widgets, resizable panels, previews of a phone layout inside a desktop page and micro-frontends. A runnable demo is
[examples/scope.html](../examples/scope.html); React has `useDimenScope(ref)`.

## Strategies and registration

The runtime keeps a factor table only for **registered** strategies. Scaled is registered by `install()`. Other strategies
register on first use (a JS token or function, a class, `data-dimen`, `ad-<id>`), via `install({ strategies })` or with
`register(DEF)`:

```js
import { register, registeredStrategies } from 'webdimens';
import { FLUID } from 'webdimens/fluid';

register(FLUID);              // idempotent; returns the live Float64Array factor table
registeredStrategies();       // [SCALED, FLUID, …]
```

`cssDeclarations(metrics, strategies?)` returns the declarations the runtime would write for a snapshot
(`'--ad-w:600px;…;--sdp:2px;…'`), which is useful to pre-render the variables on the server ([SSR](./ssr.md)).
`readEnvironment()` returns the raw inputs the runtime would measure now.

Next: [Resize](./resize.md) · [Back to the index](./README.md)
