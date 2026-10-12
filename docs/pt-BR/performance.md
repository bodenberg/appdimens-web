# Desempenho

O webdimens é projetado para que as operações comuns custem (quase) nada: resolver um valor é uma multiplicação, redimensionar a janela reescreve um punhado de variáveis CSS uma vez por quadro, e as regras declarativas são compiladas uma vez e nunca mais são tocadas.
Esta página mostra como isso funciona, os números medidos, os tamanhos de bundle e as práticas que mantêm um app rápido.

## Como funciona o caminho crítico

1. **Evento → flag de invalidação.** `resize`, orientação, DPR e eventos de postura apenas marcam uma flag; nada é calculado no handler.
2. **Reconstrução do snapshot, uma vez.** A próxima leitura (ou o próximo quadro de animação) constrói um `DimenMetrics` imutável e preenche um `Float64Array` de 44 fatores por estratégia registrada (11 variantes de eixo × 4 flags). A matemática transcendental (`pow`, `ln`, `sqrt`) roda aqui, uma vez por mudança de janela, nunca por chamada.
3. **Acessores.** `sdp(v)` é `if (S.dirty) sync(); return v * table[0];` — sem alocação, sem busca de objeto, sem desvio por opções. `ssp` acrescenta × escala de fonte, e as variantes `Px` acrescentam × devicePixelRatio.
4. **CSS.** O runtime reescreve as propriedades customizadas (uma folha de estilo construível, só quando o texto mudou) e notifica os assinantes no máximo uma vez por quadro de animação.
5. **Regras declarativas.** Cada classe / atributo distinto é compilado uma vez. Redimensionar não as toca: elas referenciam as variáveis.

## Medições

`node scripts/bench.mjs` após `npm run build` (Node 22, um contêiner em nuvem com 4 vCPUs; 20 M chamadas cada, por meio de uma chamada indireta, então o próprio harness custa cerca de 2 ns):

| Chamada | ns/op | ops/s |
|---|---:|---:|
| linha de base `v * 412 / 300` | 2.2 | 460 M |
| `sdp(v)` | 9.3 | 108 M |
| `sdpa(v)` | 9.8 | 103 M |
| `ssp(v)` | 10.8 | 93 M |
| `pwsdp(v)` (potência) | 9.1 | 110 M |
| `toDynamicScaledDp(v, HEIGHT, { applyAspectRatio: true })` | 26.7 | 37 M |
| `builder.sdp` (memoizado por snapshot) | 17.9 | 56 M |

Runtime declarativo, medido no Chromium:

| Cenário | Custo |
|---|---|
| `install()` numa página com 10.000 elementos com classes de dimensão | ~26 ms, uma vez |
| 1.000 alternâncias de classe | ~3 ms |
| 1.000 novos nós | ~5 ms |
| redimensionamento da janela | 0 ms de JavaScript para as regras compiladas (só as variáveis mudam) |

Execute o micro-benchmark na sua máquina com `npm run build && npm run bench`.

## Tamanhos de bundle

Minificado + gzip, medido com esbuild:

| O que você importa | Tamanho |
|---|---:|
| `import { sdp } from 'webdimens'` | ≈ 5.3 KB |
| `import { install } from 'webdimens'; install()` (runtime, variáveis CSS, compilador declarativo, todas as definições de estratégia) | ≈ 8.8 KB |
| CDN `webdimens.global.js` (tudo, incluindo resize e unidades) | ≈ 15 KB |
| CDN `webdimens.lite.global.js` (runtime + escalas) | ≈ 12 KB |

O pacote não tem dependências de runtime e é tree-shakable: acessores de estratégia, facilitadores, resize e unidades só são incluídos quando importados.

## Boas práticas

- **Prefira formas CSS para layout.** Classes, `data-dimen`, `dimens()` e `var(--sdp)` são atualizados sem nenhum JavaScript no redimensionamento e nunca re-renderizam componentes.
- **Re-renderize apenas o que precisa de números.** No React, use `useDimen(() => …, deps)` nos componentes que realmente precisam de um número (canvas, layouts medidos), e não `useDimens()` na raiz do app.
- **Mantenha os builders no escopo do módulo.** `const gutter = scaledDp(16).screen(…)` uma vez; ler `.sdp` é memoizado por snapshot.
- **`Px` apenas para pixels de dispositivo.** Canvas e WebGL; nunca para CSS.
- **Use `subscribe()` para atualizações imperativas** (redesenho de canvas) em vez de seus próprios listeners de `resize`: ele já é agrupado em uma chamada por quadro e só dispara quando o snapshot realmente mudou.
- **Evite layout forçado em loops.** `fittingTextSize` / `autoResizeText` medem o DOM (uma busca binária de ≈ log₂(passos) layouts); para muitos rótulos, prefira `fittingTextPx` (canvas, sem reflow).
- **Registre estratégias que você só usa em CSS escrito à mão** com `install({ strategies })`; todas as outras se registram no primeiro uso, e apenas estratégias registradas custam algo a cada redimensionamento.

Próximo: [Receitas](./recipes.md) · [Voltar ao índice](./README.md)
