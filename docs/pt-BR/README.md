# Documentação do webdimens

O webdimens é o porte para a web do [AppDimens Dynamic](https://github.com/bodenberg/appdimens-dynamic) 3.2.0 para Android:
`dp` / `sp` responsivos com a mesma matemática e os mesmos nomes (`sdp`, `hdp`, `wdp`, `ssp`, `sem`, `16sdp` em classes e CSS…).
Estas páginas cobrem todos os recursos, com exemplos executáveis.

> **Idiomas:** [English](../README.md) · Português (BR) · Pacote: [npmjs.com/package/webdimens](https://www.npmjs.com/package/webdimens)

## Comece aqui

| Se você quer… | Leia |
|---|---|
| Instalar e ter uma primeira página responsiva em 5 minutos | [Primeiros passos](./getting-started.md) |
| Entender dp / sp / px na web, eixos, flags e a gramática dos tokens | [Conceitos](./concepts.md) |
| Portar um layout Android (Compose / Views) | [Migrando do Android](./migration-android.md) |

## Usando a biblioteca

| Assunto | Página |
|---|---|
| Classes `p:16sdp`, `data-dimen`, condições `@landscape` `@sw600` `@tv`, modificadores `ad-a` `ad-i` `ad-power` | [Unidades declarativas](./declarative.md) |
| Variáveis CSS, fallback em CSS puro, Sass, PostCSS (`padding: 16sdp`, `@dimen`) | [CSS, Sass e PostCSS](./css.md) |
| `sdp()`, `dimen('16sdp')`, `dimens({…})`, facilitadores, builders | [API JavaScript](./javascript.md) |
| As 12 estratégias de escala, fórmulas e tabela comparativa | [Estratégias](./strategies.md) |
| React, Next.js, Vue, Nuxt, Svelte, SvelteKit, Angular, CDN | [Frameworks](./frameworks.md) |
| Renderização no servidor e primeiro paint | [SSR](./ssr.md) |
| Opções do `install()`, eventos, snapshots, modo de UI, escopos por elemento | [Runtime](./runtime.md) |
| Ajuste automático de texto e caixas | [Resize](./resize.md) |
| mm / cm / polegada e porcentagens literais `space*` | [Unidades e space](./units.md) |

## Referência e ajuda

| | |
|---|---|
| Todas as exportações de todos os pontos de entrada | [Referência da API](./api-reference.md) |
| Soluções prontas (cards, tipografia, TV, dobráveis, canvas, dashboards…) | [Receitas](./recipes.md) |
| Quão rápida é e como manter rápida | [Desempenho](./performance.md) |
| Algo não funciona | [Solução de problemas](./troubleshooting.md) |
| Desenvolver, testar e publicar a biblioteca | [Contribuindo](./contributing.md) |
| Páginas de demonstração executáveis | [examples/](../../examples/README.md) |
| Skills para agentes (assistentes de IA) | [skills/SKILL.md](../../skills/SKILL.md) |

## A biblioteca numa tela

```html
<script src="https://cdn.jsdelivr.net/npm/webdimens@3.2.0/dist/webdimens.global.js"></script>

<!-- 16 dp de padding que escalam com o viewport, como 16.sdp no Android -->
<section class="p:16sdp r:12sdp ad-a">
  <h1 class="fs:20ssp fs@landscape:24ssp fs@sw600:28ssp fs@tv:40ssp">Olá</h1>
  <p data-dimen="font-size: 14ssp; margin-top: 8sdp">Unidades em vez de px.</p>
</section>

<style>
  .card { padding: calc(16 * var(--sdp)); }   /* ou `padding: 16sdp` com o plugin PostCSS */
</style>

<script>
  WebDimens.dimen('16sdp');   // → número de px CSS para a janela atual
</script>
```

Fórmulas, nomes e prioridades seguem a biblioteca Android. Onde a web difere (viewport em vez de tela física, ordem do `Px`
nos nomes, `@mw`), as páginas dizem isso explicitamente.
