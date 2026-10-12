# Solução de problemas

Problemas comuns, suas causas e as correções. Comece pela seção de depuração se o seu problema não estiver listado.

## Depuração

```js
import { getMetrics, registeredStrategies } from 'webdimens';

getMetrics();                                   // o que o runtime mediu: tamanho, orientação, uiModeType, fontScale…
registeredStrategies().map((s) => s.id);        // quais estratégias publicam variáveis CSS
getComputedStyle(document.documentElement).getPropertyValue('--sdp');   // '2px' → o runtime está publicando
document.documentElement.dataset;               // adMode, adOrientation, adMultiWindow
```

Nas ferramentas de desenvolvedor do navegador, procure as propriedades customizadas `--sdp`, `--ad-w`, `--ad-sw` … em `:root`, e as folhas de estilo construíveis (ou `<style id="webdimens-vars">` / `<style id="webdimens-declarative">`).

## Os valores não mudam quando a janela é redimensionada

- **CSS / classes:** o `install()` foi chamado (ou o script do CDN foi carregado)? Sem isso não há variáveis nem regras de classe.
- **Números em JavaScript:** um número lido uma vez não se atualiza sozinho. Leia novamente a cada mudança: `subscribe()`, `useDimens()`, `useDimen()`, os bindings de Vue / Svelte / Angular.
- **Um snapshot fixado:** `setMetrics({...})` congela os valores até `setMetrics(null)`.

## Uma classe de dimensão não tem efeito

| Causa | Correção |
|---|---|
| O runtime não está instalado | `install()` no ponto de entrada |
| Erro de digitação em uma condição (`p@landscap:16sdp`) ou em uma propriedade | condições desconhecidas e nomes de propriedade inválidos transformam a classe numa classe comum; confira a grafia ([Declarativo](./declarative.md#condições)) |
| Token exclusivo de JavaScript (`p:2sdpPx`, `fs:14sspLw`) | use um token em dp ou um token `sp` sem inversor; o console mostra um aviso único |
| Caracteres inseguros (`{`, `}`, `;`, `<`, `/*`) | rejeitados pela proteção contra injeção de CSS; escreva o valor de outra forma |
| Outra regra prevalece | regras compiladas têm especificidade de uma classe; um seletor mais específico no seu CSS as sobrescreve (adicione `!` para `!important`) |
| Dentro de um shadow root | o compilador de classes examina o documento principal; veja [Frameworks](./frameworks.md#web-components-e-shadow-dom) |
| O elemento está em um `<iframe>` | cada documento precisa do seu próprio runtime |

## `var(--fsdp)` (ou outra estratégia) está vazio no meu CSS

Estratégias se registram automaticamente quando o runtime encontra um dos seus tokens (JS, uma classe, `data-dimen`, `ad-<id>`). CSS que o runtime nunca analisa — uma folha de estilo que você escreveu com `var(--fsdp)`, ou saída do PostCSS — precisa de `install({ strategies: ['fluid'] })` (ou `'all'`).

## Tamanhos de texto ignoram a configuração de tamanho de fonte do usuário

Valores `sp` usam o tamanho de fonte padrão do navegador (Configurações → Aparência → Tamanho da fonte), medido uma vez. Se o usuário mudar isso com a página aberta, chame `refresh()`. Use `ssp` / `--ssp` para texto; `sem` / `--sem` ignoram a configuração de propósito. O zoom da página é diferente: ele muda `devicePixelRatio` e o tamanho da viewport, o que o runtime acompanha automaticamente.

## Texto com redimensionamento automático fica sempre no tamanho máximo, ou transborda

A caixa do elemento não está restringida: em um layout grid ou flex ela cresce com o conteúdo. Dê à trilha `minmax(0, 1fr)` ou ao item `min-width: 0`, e dê uma altura ao elemento (ou use `maxLines`). Veja [Resize](./resize.md#a-caixa-precisa-ter-restrição-de-tamanho).

## Avisos de incompatibilidade de hidratação (SSR)

Um número JavaScript (`sdp(16)`) foi renderizado no servidor (onde o snapshot é 300 × 533) e difere no navegador. Use classes, `dimens()` ou variáveis CSS para marcação renderizada no servidor, ou renderize os números depois da montagem. Veja [SSR](./ssr.md).

## Estilos são bloqueados por uma Content Security Policy

O runtime prefere folhas de estilo construíveis, que a CSP não bloqueia. Se o seu ambiente recorrer a elementos `<style>` e a sua CSP exigir nonces, passe `install({ cssNonce: '…' })`.

## Valores diferem do app Android

| Motivo | Detalhe |
|---|---|
| Janela vs tela | a web mede a viewport do navegador (descontando a interface do navegador), o Android mede a janela do app |
| Heurística de multijanela | uma janela de desktop não maximizada pode contar como multijanela; force `configure({ multiWindow: false })` |
| Modo de UI | detectado pelo user agent; force `install({ uiModeType })` em TVs e quiosques |
| Unidades físicas | CSS usa 96 px/in em vez do DPI real do painel; calibre com `setPhysicalCalibration()` |

## O build do PostCSS falha

- `has no CSS token` — um token `Px` ou `sp`/`em` com inversor em CSS; eles existem apenas em JavaScript.
- `unknown condition in "@dimen …"` — confira os nomes das condições (`landscape`, `sw600`, `tv`, …).
- `@dimen must be nested inside a style rule` — coloque `@dimen` dentro da regra que ele modifica.

## `npm install` traz uma versão antiga ou um placeholder `0.0.0-stage`

O npm faz cache dos metadados do pacote. Execute `npm cache clean --force` (ou `npm install webdimens@latest --prefer-online`) e confira com `npm view webdimens version`.

Próximo: [Contribuindo](./contributing.md) · [Voltar ao índice](./README.md)
