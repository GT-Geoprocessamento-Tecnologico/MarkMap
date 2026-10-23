# MarkMap — PRD MM-MAP-A50/A51: concorrência de sync e retomada rápida

Data: 2026-10-12. Base: `dev/markmap-pwa-v2@de50526`, Checklist Mestre Notion e GitHub HEAD inspecionados, sem PRs/issues abertos.

## Objetivo e contexto

Preservar trabalho offline e evitar revalidação remota desnecessária ao sincronizar simultaneamente em duas abas. Stack existente React/Vite/TS, Hono, Neon e IndexedDB/outbox mantida.

## Auditoria inicial

FUNCIONA: single-flight `syncNow`, cursores CAS A44, capability transacional A49, PWA foreground A47. QUEBRADO: token de outra aba não era reutilizado após HTTP 401; mutação durante sync ativo não acionava nova rodada. PARCIAL: testes com stubs; NÃO IMPLEMENTADO: homologação real multiabas e dispositivos.

## Escopo e arquivos

- `apps/admin/src/lib/sync/sync-engine.ts`: após 401 ler capability local mais recente; tentar bearer local superior uma vez, depois recovery remoto se necessário.
- `apps/admin/src/lib/sync/SyncController.tsx`: marcar `rerunRequested` durante sync ativo e executar rodada posterior; preservar debounce, offline, unmount, foco e invalidação de conflitos.
- `scripts/sync-cross-tab-capability.test.mjs`: 4 testes (cache mais novo, recovery normal, retry rejeitado e estabilidade).
- `scripts/sync-single-flight-mutations.test.mjs`: 4 testes (mutação durante voo, agregação, offline, desmontagem).
- Atualizar `docs/handoff.md`, `docs/master-checklist.md`, `docs/MARKMAP_MASTER.md`, `docs/release-checklist.md` e Notion.

## Fora do escopo e segurança

Nenhum schema/migração, alteração de API Hono, bearer em logs, limpeza de IndexedDB/outbox, alterações de tokens remotos, deploy, release/tag, merge main, secrets ou GitHub CI. Não disparar requests se `navigator.onLine=false`.

## Critérios de aceite

Dado 401 com capability mais nova na mesma instalação, quando houver nova tentativa, então usar token mais novo sem recuperação desnecessária. Dado bearer também inválido, fallback para recovery normal. Dada mutação enquanto sync está ativo, quando a promessa termina então executar nova rodada única; permanecer offline não chama rede; unmount evita execução tardia.

## Testes, QA e riscos

Baseline: A50 3 falhas/4 casos e A51 2 falhas/4 casos antes dos patches. Depois: 8/8 novos PASS, **235/235 testes Node PASS em duas execuções**, Node v22.16.0; TypeScript isolado com contratos stub em dois tsconfigs PASS; sintaxe Node dos testes PASS. Browser real, lint/typecheck/build/Vitest/Playwright integrais, Android/iOS físicos e sync remoto NÃO EXECUTADOS. Mock não equivale a E2E em produção.

## Git/QA, rollback e relatório esperado

Somente `dev/markmap-pwa-v2`, commits [skip ci], sem GitHub Actions/CI, merge main, deploy, Neon/migration, force push, secrets, releases/lojas ou operações destrutivas. Rollback reversível por revert dos commits A50/A51, sem alteração de dados. Registrar status no GitHub Handoff/Checklist e Checklist Mestre Notion. A38 segue bloqueada para release, não para desenvolvimento.
