/**
 * CDN / `<script>` build: everything on `window.WebDimens`; installs the runtime
 * (CSS variables) on load. Opt out with `<script data-no-install …>`.
 *
 * Strategy APIs are built at runtime (`buildNamespace`) to keep the file small;
 * names and results are identical to the ESM modules.
 */
import * as core from './core/public';
import * as space from './core/space';
import { buildNamespace } from './core/namespace';
import { install } from './core/runtime';
import { SCALED } from './core/scaled';
import { AUTO } from './strategies/auto';
import { DENSITY } from './strategies/density';
import { DIAGONAL } from './strategies/diagonal';
import { FILL } from './strategies/fill';
import { FIT } from './strategies/fit';
import { FLUID } from './strategies/fluid';
import { INTERPOLATED } from './strategies/interpolated';
import { LOGARITHMIC } from './strategies/logarithmic';
import { PERCENT } from './strategies/percent';
import { PERIMETER } from './strategies/perimeter';
import { POWER } from './strategies/power';
import * as resize from './resize';
import * as units from './units';

const api: Record<string, unknown> = { ...core, ...space, ...resize, ...units };
for (const def of [SCALED, PERCENT, POWER, FLUID, AUTO, DIAGONAL, FILL, FIT, INTERPOLATED, LOGARITHMIC, PERIMETER, DENSITY]) {
  Object.assign(api, buildNamespace(def));
}

if (typeof window !== 'undefined') {
  (window as unknown as { WebDimens: typeof api }).WebDimens = api;
  const script = typeof document !== 'undefined' ? (document.currentScript as HTMLScriptElement | null) : null;
  if (!script || !script.hasAttribute('data-no-install')) install();
}
