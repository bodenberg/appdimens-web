import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  createEnvironmentInjector,
  DestroyRef,
  EnvironmentInjector,
  Injector,
  runInInjectionContext,
  type ProviderToken,
} from '@angular/core';
import { flush, setMetrics, sdp, uninstall } from '../src/index';
import { injectDimen, injectDimens, provideWebDimens } from '../src/angular';

type EnvProviders = Parameters<typeof createEnvironmentInjector>[0];

// No TestBed or platform is needed: the environment injector only needs a parent to fall back to.
// createEnvironmentInjector's typings demand an EnvironmentInjector, so the null injector is cast.
const rootParent = Injector.NULL as unknown as EnvironmentInjector;

const liveInjectors = new Set<EnvironmentInjector>();

function createEnv(providers: EnvProviders = []): EnvironmentInjector {
  const env = createEnvironmentInjector(providers, rootParent);
  liveInjectors.add(env);
  return env;
}

function destroyEnv(env: EnvironmentInjector): void {
  liveInjectors.delete(env);
  env.destroy();
}

/** DestroyRef that the test controls: runs every registered teardown on destroy(). */
class ManualDestroyRef extends DestroyRef {
  private readonly hooks = new Set<() => void>();

  onDestroy(callback: () => void): () => void {
    this.hooks.add(callback);
    return () => {
      this.hooks.delete(callback);
    };
  }

  destroy(): void {
    for (const hook of [...this.hooks]) hook();
    this.hooks.clear();
  }
}

/**
 * Minimal injection context that only answers DestroyRef. Injector.create({ providers: [{ provide: DestroyRef }] })
 * does not work for this: R3Injector resolves DestroyRef to itself (the NG_ENV_ID short-circuit), so the
 * provider is never consulted.
 */
class MinimalInjector extends Injector {
  constructor(private readonly destroyRef: DestroyRef) {
    super();
  }

  override get<T>(token: ProviderToken<T>): T {
    if (token === DestroyRef) return this.destroyRef as unknown as T;
    throw new Error('MinimalInjector only provides DestroyRef');
  }
}

function pin(screenWidthDp: number, screenHeightDp: number): void {
  setMetrics({ screenWidthDp, screenHeightDp });
  flush();
}

function styleText(): string {
  return document.getElementById('webdimens-vars')?.textContent ?? '';
}

beforeEach(() => {
  pin(300, 533);
});

afterEach(() => {
  for (const env of [...liveInjectors]) destroyEnv(env);
  setMetrics(null);
  uninstall();
});

describe('injectDimens', () => {
  it('returns a signal that follows setMetrics + flush', () => {
    const env = createEnv();
    const metrics = runInInjectionContext(env, () => injectDimens());

    expect(metrics().screenWidthDp).toBe(300);
    pin(600, 800);
    expect(metrics().screenWidthDp).toBe(600);
    expect(metrics().screenHeightDp).toBe(800);

    destroyEnv(env);
  });

  it('unsubscribes when the environment injector is destroyed', () => {
    const env = createEnv();
    const metrics = runInInjectionContext(env, () => injectDimens());

    destroyEnv(env);

    expect(() => pin(600, 800)).not.toThrow();
    expect(metrics().screenWidthDp).toBe(300);
  });

  it('works in a minimal Injector that provides DestroyRef', () => {
    const destroyRef = new ManualDestroyRef();
    const injector = new MinimalInjector(destroyRef);
    const metrics = runInInjectionContext(injector, () => injectDimens());

    pin(600, 800);
    expect(metrics().screenWidthDp).toBe(600);

    destroyRef.destroy();
    pin(900, 900);
    expect(metrics().screenWidthDp).toBe(600);
  });
});

describe('injectDimen', () => {
  it('computes sdp(16) as 16 and then 32 after a snapshot change', () => {
    const env = createEnv();
    const pad = runInInjectionContext(env, () => injectDimen(() => sdp(16)));

    expect(pad()).toBe(16);
    pin(600, 800);
    expect(pad()).toBe(32);

    destroyEnv(env);
  });
});

describe('provideWebDimens', () => {
  it('installs the CSS variables when the environment injector is created', () => {
    expect(document.getElementById('webdimens-vars')).toBeNull();

    const env = createEnv([provideWebDimens()]);
    expect(styleText()).toContain('--sdp:1px');

    pin(600, 800);
    expect(styleText()).toContain('--sdp:2px');

    destroyEnv(env);
  });
});
