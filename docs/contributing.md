# Contributing

How the repository is organized, how to build and test it, and how releases are made.

## Requirements

- **Node 22+** to develop (vitest 5, jsdom 30, vite 8). The published package itself runs on Node 18+ and every modern browser.
- Chromium for the browser checks (`npx playwright install chromium`).

```bash
git clone https://github.com/bodenberg/appdimens-web.git
cd appdimens-web
npm ci
npm run check
```

## Layout

| Path | Contents |
|---|---|
| `src/core/` | runtime, metrics snapshot, strategy plumbing, builder, tokens, declarative compiler, DOM runtime, scopes |
| `src/strategies/` | one definition per satellite strategy (formula only) |
| `src/generated/` | per-strategy API, **generated** by `scripts/generate.mjs` — do not edit |
| `src/*.ts` | entry points: `index`, each strategy, `resize`, `units`, `postcss`, framework adapters, CDN bundles |
| `css/`, `scss/` | generated fallback stylesheets and Sass functions |
| `docs/`, `docs/pt-BR/` | this documentation (both languages must have the same pages) |
| `examples/` | runnable pages, checked in Chromium |
| `skills/`, `LLMS.txt` | guidance for AI assistants |
| `tests/` | vitest suites |
| `scripts/` | generator, checks, benchmark |

`scripts/generate.mjs` is the single source of the naming rules: it writes `src/generated/*.ts`, `css/` and `scss/` from one
strategy list, and fails if two strategies would produce the same name.

## Scripts

| Command | What it does |
|---|---|
| `npm run generate` | regenerate `src/generated`, `css/`, `scss/` (`-- --check` fails if they are stale) |
| `npm run docs` | check every relative link and anchor in the docs, and EN / pt-BR page parity |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | vitest: parity with the Android kernels, API, runtime, declarative, resize, units, frameworks, tree-shaking, assets |
| `npm run build` | tsup: ESM + CJS + types per entry, and the two CDN bundles |
| `npm run check` | generate check + docs + typecheck + tests + build + `scripts/verify-dist.mjs` (runs before `npm publish`) |
| `npm run examples` | load every `examples/*.html` in Chromium and assert values |
| `node scripts/browser-check.mjs` | end-to-end checks in Chromium (CSS variables, live resize, declarative units, auto-resize) |
| `npm run bench` | micro-benchmark of the built package |
| `npm run strategy-table` | regenerate the comparison table used in `docs/strategies.md` |

## Tests that matter most

- `tests/parity.test.ts` compares every strategy × axis variant × flag on 12 window sizes against an independent transcription
  of the Kotlin kernels of AppDimens Dynamic. Any formula change must keep it green.
- `tests/treeshake.test.ts` bundles apps with Rolldown (Vite's bundler) and checks that `install()` alone still publishes the
  scaled tokens.
- `scripts/verify-dist.mjs` loads the ESM, CJS and CDN builds as a consumer would; CI also runs it on Node 18 and 20 against the
  built package.

## CI

| Job | Runs |
|---|---|
| `check (22)`, `check (24)` | `npm ci && npm run check` |
| `dist-compat (18)`, `dist-compat (20)` | `verify-dist` on the package built by `check (22)` |
| `browser` | `browser-check.mjs` and `examples-check.mjs` in Chromium |

## Adding a strategy

1. Add `src/strategies/<id>.ts` with `defineStrategy({ id, prefix, ar, axisFree?, scale })`.
2. Add it to `STRATEGIES` in `scripts/generate.mjs` (prefix, CSS fallback expression) and to `src/core/defs.ts`.
3. Add an entry `src/<id>.ts` (`export * from './generated/<id>'`), the tsup entry, the `exports` map in `package.json`, and
   `src/global.ts`.
4. Run `npm run generate`, add the oracle formula to `tests/parity.test.ts`, regenerate the docs table, document it in
   `docs/strategies.md` (both languages).

## Releasing

1. Update `version` in `package.json` and `VERSION` in `src/core/constants.ts` (verify-dist fails if they differ), and
   `CHANGELOG.md`.
2. `npm run check`, then `npm publish --access public` (`prepublishOnly` runs the check again).
3. npm may first create a `0.0.0-stage` placeholder for a new package (staged publishing); the real version appears within
   seconds. If your account requires it, approve the staged release with `npm stage approve <id>` (2FA).
4. Tag the release: `git tag v<version> && git push --tags`.

Next: [Back to the index](./README.md)
