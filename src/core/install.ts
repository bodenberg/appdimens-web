import { ensureStrategy, STRATEGY_DEFS } from './defs';
import { startDeclarative, stopDeclarative } from './dom';
import { register } from './runtime';
import { SCALED } from './scaled';
import { install as installRuntime, uninstall as uninstallRuntime, type WebDimensConfig } from './runtime';

export interface InstallOptions extends WebDimensConfig {
  /**
   * Compile dimension classes (`p:16sdp`, `fs@tv:28ssp`), `data-dimen` attributes and the
   * modifier classes (`ad-a`, `ad-i`, `ad-ia`, `ad-<strategy>`). Default `true`.
   */
  declarative?: boolean;
  /**
   * Strategies whose CSS variables must exist even if no token of theirs is seen by the runtime —
   * needed for hand-written `var(--fsdp)` or PostCSS output. Ids (`['power', 'fluid']`) or `'all'`.
   * Strategies also register automatically on first use (a JS token, class, `data-dimen`, `ad-<id>`).
   */
  strategies?: readonly string[] | 'all';
}

/**
 * Starts webdimens: viewport tracking, CSS custom properties and (by default) the
 * declarative class / `data-dimen` compiler. Idempotent; later calls update options.
 */
export function install(options: InstallOptions = {}): void {
  const { declarative, strategies, ...runtime } = options;
  // Explicit, never tree-shaken: the scaled tokens (--sdp, --ssp…) must exist even when the app
  // only calls install() and never imports an accessor such as sdp().
  register(SCALED);
  const wanted = strategies === 'all' ? STRATEGY_DEFS.map((d) => d.id) : (strategies ?? []);
  for (const id of wanted) {
    if (!ensureStrategy(id)) throw new RangeError(`webdimens: unknown strategy "${id}" in install({ strategies })`);
  }
  installRuntime(runtime);
  if (declarative === false) stopDeclarative();
  else if (typeof document !== 'undefined') startDeclarative({ cssNonce: runtime.cssNonce });
}

/** Stops everything and removes the generated CSS and `<html>` attributes. */
export function uninstall(): void {
  stopDeclarative();
  uninstallRuntime();
}
