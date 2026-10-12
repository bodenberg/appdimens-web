/**
 * Regression: an app that only calls install() must still publish the scaled tokens after a
 * production bundle (Vite/Rolldown tree-shaking). 3.2.0 dropped the scaled registration.
 */
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { rolldown } from 'rolldown';
import { expect, it } from 'vitest';

const src = join(dirname(fileURLToPath(import.meta.url)), '../src/index.ts');

async function bundle(code: string): Promise<string> {
  const dir = mkdtempSync(join(tmpdir(), 'wd-treeshake-'));
  try {
    const entry = join(dir, 'entry.js');
    writeFileSync(entry, code.replace('SRC', JSON.stringify(src)));
    const build = await rolldown({ input: entry, treeshake: true, logLevel: 'silent' });
    const { output } = await build.generate({ format: 'esm' });
    return output[0].code;
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

it('install() alone keeps the scaled strategy registered', async () => {
  const code = await bundle(`import { install } from SRC; install();`);
  expect(code).toMatch(/id: "scaled"/);
  expect(code).toMatch(/register\(SCALED\)/);
}, 60_000);

it('dimen() alone can resolve any strategy (definitions ship with the core)', async () => {
  const code = await bundle(`import { dimen } from SRC; console.log(dimen('10pwsdp'));`);
  expect(code).toMatch(/id: "power"/);
}, 60_000);

it('install({ strategies }) registers strategies for hand-written CSS', async () => {
  const { install, uninstall, registeredStrategies } = await import('../src/index');
  install({ strategies: ['fluid', 'fit'] });
  const ids = registeredStrategies().map((d) => d.id);
  expect(ids).toEqual(expect.arrayContaining(['scaled', 'fluid', 'fit']));
  expect(() => install({ strategies: ['nope'] })).toThrow(RangeError);
  install({ strategies: 'all' });
  expect(registeredStrategies()).toHaveLength(12);
  uninstall();
});
