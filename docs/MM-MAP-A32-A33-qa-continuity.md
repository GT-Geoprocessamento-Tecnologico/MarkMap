# A32/A33 — Evidência de execução (2026-10-11)

Base: dev/markmap-pwa-v2@29d8e0e. Sem PRs/issues abertos antes da implementação.

- 22 arquivos Node test recuperados fielmente do HEAD. Baseline: node --test scripts/*.test.mjs, 144/144 PASS.
- Falha A33: Worker de roteamento retornava Error.message interno (ex.: token de URL/path do armazenamento) diretamente à interface. Reproduzido com vm e injeção de Error.
- Correção: falhas conhecidas mapeadas por allowlist; demais exceções produzem diagnóstico genérico sem dados sensíveis. Nenhum acesso a rede ou alteração em IndexedDB/outbox.
- Node após correção: 150/150 PASS, incluindo 6 novos testes. node --check, tsc da declaração isolada e transpilação sintática TS PASS.
- A32/A34 PARCIAL: checkout privado por Git não acessível por DNS; corepack pnpm sem acesso a registry.npmjs.org. Lint/typecheck/build/Vitest/E2E integrais, browser WebGL/PMTiles/IndexedDB não executados.
- A35 Android físico, A36 iOS físico, A37 sync entre instalações e A38 revisão privacy/security/RC: PENDENTES.
- Sem CI remoto, deploy, merge main, Neon/migration, tag/release, publicação móvel ou operação destrutiva.

## A34 — leitores offline presos à geração ativa (2026-10-11)

- **Reprodução:** testes de contrato inicialmente falharam com manifesto antigo e Blob novo; 5 falhas direcionadas antes da mudança. Também havia eco de exceção interna na UI de busca/conteúdo/altitude.
- **Patch:** consumidores de busca, Worker rotas, conhecimento e DEM ancorados na geração ativa; rejeitam atualização concorrente e sanitizam diagnósticos. Nenhum schema, rede, banco ou dado do usuário alterado.
- **Comandos locais:** `NODE_PATH=$(npm root -g) node --test scripts/*.test.mjs` **164/164 PASS**. Sintaxe JS e TSX PASS. `tsc --strict --noEmit` isolado com stubs para quatro módulos **4/4 PASS**; não é typecheck monorepo.
- **Bloqueios:** git remoto por DNS; pnpm/node_modules de checkout indisponíveis; navegador Chromium 144 bloqueia `localhost`/`file`/`data` com `ERR_BLOCKED_BY_ADMINISTRATOR`; `about:blank` bloqueia IndexedDB por SecurityError. Logo, Vitest/Playwright reais, lint/typecheck/build integrais e Android/iOS físicos NÃO EXECUTADOS.
- **CI GitHub:** NÃO EXECUTADO. Todos os commits na branch `dev` usam `[skip ci]`; main/produção não alteradas.
- **Riscos remanescentes:** timing IndexedDB real, performance, visual MapLibre/PMTiles/WebGL, reinstalação PWA e sync físico necessitam ambiente autorizado. Sem RC aprovado. Rollback reversível dos três commits A34.
