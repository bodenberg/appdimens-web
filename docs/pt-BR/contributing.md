# Contribuindo

Como o repositório é organizado, como compilar e testar, e como os releases são feitos.

## Requisitos

- **Node 22+** para desenvolver (vitest 5, jsdom 30, vite 8). O pacote publicado em si roda em Node 18+ e em todos os navegadores modernos.
- Chromium para as verificações de navegador (`npx playwright install chromium`).

```bash
git clone https://github.com/bodenberg/appdimens-web.git
cd appdimens-web
npm ci
npm run check
```

## Estrutura

| Caminho | Conteúdo |
|---|---|
| `src/core/` | runtime, snapshot de métricas, infraestrutura de estratégias, builder, tokens, compilador declarativo, runtime de DOM, escopos |
| `src/strategies/` | uma definição por estratégia satélite (apenas a fórmula) |
| `src/generated/` | API por estratégia, **gerada** por `scripts/generate.mjs` — não edite |
| `src/*.ts` | pontos de entrada: `index`, cada estratégia, `resize`, `units`, `postcss`, adaptadores de frameworks, bundles de CDN |
| `css/`, `scss/` | folhas de estilo de fallback geradas e funções Sass |
| `docs/`, `docs/pt-BR/` | esta documentação (os dois idiomas devem ter as mesmas páginas) |
| `examples/` | páginas executáveis, verificadas no Chromium |
| `skills/`, `LLMS.txt` | orientações para assistentes de IA |
| `tests/` | suítes do vitest |
| `scripts/` | gerador, verificações, benchmark |

`scripts/generate.mjs` é a fonte única das regras de nomenclatura: ele gera `src/generated/*.ts`, `css/` e `scss/` a partir de uma única lista de estratégias, e falha se duas estratégias produzirem o mesmo nome.

## Scripts

| Comando | O que faz |
|---|---|
| `npm run generate` | regenera `src/generated`, `css/`, `scss/` (`-- --check` falha se estiverem desatualizados) |
| `npm run docs` | verifica todos os links relativos e âncoras da documentação, e a paridade de páginas EN / pt-BR |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | vitest: paridade com os kernels Android, API, runtime, declarativo, resize, unidades, frameworks, tree-shaking, assets |
| `npm run build` | tsup: ESM + CJS + tipos por entrada, e os dois bundles de CDN |
| `npm run check` | verificação de geração + docs + typecheck + testes + build + `scripts/verify-dist.mjs` (roda antes do `npm publish`) |
| `npm run examples` | carrega cada `examples/*.html` no Chromium e verifica os valores |
| `node scripts/browser-check.mjs` | verificações end-to-end no Chromium (variáveis CSS, redimensionamento ao vivo, unidades declarativas, ajuste automático) |
| `npm run bench` | micro-benchmark do pacote compilado |
| `npm run strategy-table` | regenera a tabela comparativa usada em `docs/strategies.md` |

## Testes mais importantes

- `tests/parity.test.ts` compara cada estratégia × variante de eixo × flag em 12 tamanhos de janela com uma transcrição independente dos kernels Kotlin do AppDimens Dynamic. Qualquer mudança de fórmula deve mantê-lo verde.
- `tests/treeshake.test.ts` empacota apps com Rolldown (o bundler do Vite) e verifica se só `install()` ainda publica os tokens escalados.
- `scripts/verify-dist.mjs` carrega os builds ESM, CJS e CDN como um consumidor faria; o CI também o executa no Node 18 e 20 contra o pacote compilado.

## CI

| Job | Executa |
|---|---|
| `check (22)`, `check (24)` | `npm ci && npm run check` |
| `dist-compat (18)`, `dist-compat (20)` | `verify-dist` no pacote compilado por `check (22)` |
| `browser` | `browser-check.mjs` e `examples-check.mjs` no Chromium |

## Adicionando uma estratégia

1. Adicione `src/strategies/<id>.ts` com `defineStrategy({ id, prefix, ar, axisFree?, scale })`.
2. Adicione-a a `STRATEGIES` em `scripts/generate.mjs` (prefixo, expressão de fallback CSS) e em `src/core/defs.ts`.
3. Adicione uma entrada `src/<id>.ts` (`export * from './generated/<id>'`), a entrada do tsup, o mapa `exports` em `package.json` e `src/global.ts`.
4. Execute `npm run generate`, adicione a fórmula de referência (oracle) em `tests/parity.test.ts`, regenere a tabela da documentação e documente-a em `docs/strategies.md` (nos dois idiomas).

## Publicando uma versão

1. Atualize `version` em `package.json` e `VERSION` em `src/core/constants.ts` (o verify-dist falha se forem diferentes), e o `CHANGELOG.md`.
2. `npm run check`, depois `npm publish --access public` (`prepublishOnly` executa a verificação novamente).
3. O npm pode primeiro criar um placeholder `0.0.0-stage` para um pacote novo (publicação em etapas); a versão real aparece em segundos. Se a sua conta exigir, aprove a versão em etapas com `npm stage approve <id>` (2FA).
4. Crie a tag da versão: `git tag v<version> && git push --tags`.

Próximo: [Voltar ao índice](./README.md)
