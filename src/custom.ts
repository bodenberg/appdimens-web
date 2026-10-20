/**
 * webdimens/custom — custom scaling strategies (Android `appdimens-dynamic-custom`).
 *
 * Define your own growth law (reference frame, axis, curve, bounds, font-scale policy and
 * rules per device class / screen range) in code or JSON — the same JSON every AppDimens
 * platform reads — then use `cdp(16, brand)` / `csp(14, brand)` / `brand.css(16)` or the
 * `16cdp-brand` literal in `dimens()` / PostCSS.
 */
export * from './custom/index';
