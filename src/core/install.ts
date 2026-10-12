import { startDeclarative, stopDeclarative } from './dom';
import { install as installRuntime, uninstall as uninstallRuntime, type WebDimensConfig } from './runtime';

export interface InstallOptions extends WebDimensConfig {
  /**
   * Compile dimension classes (`p:16sdp`, `fs@tv:28ssp`), `data-dimen` attributes and the
   * modifier classes (`ad-a`, `ad-i`, `ad-ia`, `ad-<strategy>`). Default `true`.
   */
  declarative?: boolean;
}

/**
 * Starts webdimens: viewport tracking, CSS custom properties and (by default) the
 * declarative class / `data-dimen` compiler. Idempotent; later calls update options.
 */
export function install(options: InstallOptions = {}): void {
  const { declarative, ...runtime } = options;
  installRuntime(runtime);
  if (declarative === false) stopDeclarative();
  else if (typeof document !== 'undefined') startDeclarative({ cssNonce: runtime.cssNonce });
}

/** Stops everything and removes the generated CSS and `<html>` attributes. */
export function uninstall(): void {
  stopDeclarative();
  uninstallRuntime();
}
