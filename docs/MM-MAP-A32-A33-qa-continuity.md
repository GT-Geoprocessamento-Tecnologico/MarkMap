# A32/A33 — Evidência de execução (2026-10-11)

Base: dev/markmap-pwa-v2@29d8e0e. Sem PRs/issues abertos antes da implementação.

- 22 arquivos Node test recuperados fielmente do HEAD. Baseline: node --test scripts/*.test.mjs, 144/144 PASS.
- Falha A33: Worker de roteamento retornava Error.message interno (ex.: token de URL/path do armazenamento) diretamente à interface. Reproduzido com vm e injeção de Error.
- Correção: falhas conhecidas mapeadas por allowlist; demais exceções produzem diagnóstico genérico sem dados sensíveis. Nenhum acesso a rede ou alteração em IndexedDB/outbox.
- Node após correção: 150/150 PASS, incluindo 6 novos testes. node --check, tsc da declaração isolada e transpilação sintática TS PASS.
- A32/A34 PARCIAL: checkout privado por Git não acessível por DNS; corepack pnpm sem acesso a registry.npmjs.org. Lint/typecheck/build/Vitest/E2E integrais, browser WebGL/PMTiles/IndexedDB não executados.
- A35 Android físico, A36 iOS físico, A37 sync entre instalações e A38 revisão privacy/security/RC: PENDENTES.
- Sem CI remoto, deploy, merge main, Neon/migration, tag/release, publicação móvel ou operação destrutiva.
