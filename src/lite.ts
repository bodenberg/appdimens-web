/** Lite CDN build: runtime + scaled strategy only, on `window.WebDimens`. */
import * as core from './core/public';
import { buildNamespace } from './core/namespace';
import { install } from './core/runtime';
import { SCALED } from './core/scaled';

const api: Record<string, unknown> = { ...core, ...buildNamespace(SCALED) };

if (typeof window !== 'undefined') {
  (window as unknown as { WebDimens: typeof api }).WebDimens = api;
  const script = typeof document !== 'undefined' ? (document.currentScript as HTMLScriptElement | null) : null;
  if (!script || !script.hasAttribute('data-no-install')) install();
}
