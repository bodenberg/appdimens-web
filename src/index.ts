/**
 * webdimens — AppDimens Dynamic for the web.
 *
 * Principal module (Android `appdimens-dynamic`): runtime + scaled strategy
 * (`sdp` / `hdp` / `wdp` / `ssp` / `sem` …). Other strategies live in
 * `webdimens/<strategy>` (percent, power, fluid, auto, diagonal, fill, fit,
 * interpolated, logarithmic, perimeter, density), plus `webdimens/resize` and
 * `webdimens/units`.
 *
 * Author: Jean Bodenberg — Apache-2.0
 */
export * from './generated/scaled';
export * from './core/public';
