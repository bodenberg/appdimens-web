# Troubleshooting

Common problems, their cause and the fix. Start with the debugging section if your problem is not listed.

## Debugging

```js
import { getMetrics, registeredStrategies } from 'webdimens';

getMetrics();                                   // what the runtime measured: size, orientation, uiModeType, fontScale…
registeredStrategies().map((s) => s.id);        // which strategies publish CSS variables
getComputedStyle(document.documentElement).getPropertyValue('--sdp');   // '2px' → the runtime is publishing
document.documentElement.dataset;               // adMode, adOrientation, adMultiWindow
```

In the browser dev tools, look for the `--sdp`, `--ad-w`, `--ad-sw` … custom properties on `:root`, and for the
constructable stylesheets (or `<style id="webdimens-vars">` / `<style id="webdimens-declarative">`).

## Values do not change when the window is resized

- **CSS / classes:** was `install()` called (or the CDN script loaded)? Without it there are no variables and no class rules.
- **JavaScript numbers:** a number read once does not update by itself. Re-read it on change: `subscribe()`, `useDimens()`,
  `useDimen()`, the Vue / Svelte / Angular bindings.
- **A pinned snapshot:** `setMetrics({...})` freezes the values until `setMetrics(null)`.

## A dimension class has no effect

| Cause | Fix |
|---|---|
| The runtime is not installed | `install()` in the entry point |
| Typo in a condition (`p@landscap:16sdp`) or property | unknown conditions / invalid property names make the class a normal class; check the spelling ([Declarative](./declarative.md#conditions)) |
| JavaScript-only token (`p:2sdpPx`, `fs:14sspLw`) | use a dp token or a `sp` token without inverter; the console shows a one-time warning |
| Unsafe characters (`{`, `}`, `;`, `<`, `/*`) | rejected by the CSS-injection guard; write the value differently |
| Another rule wins | compiled rules have one-class specificity; a more specific selector in your CSS overrides them (add `!` for `!important`) |
| Inside a shadow root | the class compiler scans the main document; see [Frameworks](./frameworks.md#web-components-and-shadow-dom) |
| The element is in an `<iframe>` | each document needs its own runtime |

## `var(--fsdp)` (or another strategy) is empty in my CSS

Strategies register automatically when the runtime sees one of their tokens (JS, a class, `data-dimen`, `ad-<id>`). CSS the
runtime never parses — a stylesheet you wrote with `var(--fsdp)`, or PostCSS output — needs
`install({ strategies: ['fluid'] })` (or `'all'`).

## Text sizes ignore the user's font size setting

`sp` values use the browser's default font size (Settings → Appearance → Font size), measured once. If the user changes it
while the page is open, call `refresh()`. Use `ssp` / `--ssp` for text; `sem` / `--sem` deliberately ignore the setting. Page
zoom is different: it changes `devicePixelRatio` and the viewport size, which the runtime tracks automatically.

## Auto-resized text is always at the maximum size, or overflows

The element's box is not constrained: in a grid or flex layout it grows with its content. Give the track `minmax(0, 1fr)` or the
item `min-width: 0`, and give the element a height (or use `maxLines`). See [Resize](./resize.md#the-box-must-be-constrained).

## Hydration mismatch warnings (SSR)

A JavaScript number (`sdp(16)`) was rendered on the server (where the snapshot is 300 × 533) and differs in the browser. Use
classes, `dimens()` or CSS variables for server-rendered markup, or render numbers after mount. See [SSR](./ssr.md).

## Styles are blocked by a Content Security Policy

The runtime prefers constructable stylesheets, which CSP does not block. If your environment falls back to `<style>` elements
and your CSP requires nonces, pass `install({ cssNonce: '…' })`.

## Values differ from the Android app

| Reason | Detail |
|---|---|
| Window vs display | the web measures the browser viewport (minus browser UI), Android the app window |
| Multi-window heuristic | a non-maximized desktop window may count as multi-window; force `configure({ multiWindow: false })` |
| UI mode | detected from the user agent; force `install({ uiModeType })` on TVs and kiosks |
| Physical units | CSS 96 px/in instead of the panel's real DPI; calibrate with `setPhysicalCalibration()` |

## The PostCSS build fails

- `has no CSS token` — a `Px` or `sp`/`em`-with-inverter token in CSS; these exist only in JavaScript.
- `unknown condition in "@dimen …"` — check the condition names (`landscape`, `sw600`, `tv`, …).
- `@dimen must be nested inside a style rule` — put `@dimen` inside the rule it modifies.

## `npm install` gives an old version or a `0.0.0-stage` placeholder

npm caches package metadata. Run `npm cache clean --force` (or `npm install webdimens@latest --prefer-online`) and check with
`npm view webdimens version`.

Next: [Contributing](./contributing.md) · [Back to the index](./README.md)
