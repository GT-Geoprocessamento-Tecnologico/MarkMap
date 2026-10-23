# MarkMap — A44: cursor pull protegido entre abas (2026-10-12)

## Objetivo/contexto

Eliminar regressão de cursor quando duas abas aplicam páginas remotas fora de ordem. Base: dev/markmap-pwa-v2@4cd7708, Checklist Mestre do Notion e HEAD conferidos. IndexedDB/outbox continuam fonte operacional.

## Auditoria

FUNCIONA: transação readwrite de LocalRepository, cursor persistido, sincronização A37-A43.
QUEBRADO: página recebida por aba atrasada podia sobrescrever meta.syncCursor depois de outra aba avançar.
PARCIAL: inFlight coordena apenas chamadas na mesma aba.
NÃO IMPLEMENTADO: homologação browser multiabas e dispositivo físico.

## Escopo/arquivos

- apps/admin/src/lib/local-repositories/index.ts: CAS do cursor dentro da mesma transação, antes de escrever entidade/ACK/tombstone.
- apps/admin/src/lib/sync/sync-engine.ts: transmite o cursor enviado ao servidor como expectedCursor.
- apps/admin/src/lib/sync/sync-engine.test.ts: expectativas para opção do cursor.
- scripts/sync-cursor-cas.test.mjs: teste de CAS, rollback, compatibilidade, propagação.

## Fora de escopo/segurança

Sem alterar banco Neon, contratos HTTP, esquema IndexedDB, outbox ou recursos cartográficos; exceções não exibem token/cursor na UI. Proibidos CI GitHub, deploy, migrações destrutivas, merge main, force push, secrets, tag/release ou publicação.

## Critérios de aceite e QA

- Cursor esperado idêntico: página aplica e avança.
- Cursor modificado por outra aba: página rejeitada antes de afetar registros/cursor.
- Chamadas antigas de 3 argumentos continuam compatíveis.
- syncEngine informa cursor que pediu na rede.
- Baseline: 3/5 testes direcionados falhavam antes. Após correção: 5/5 PASS.
- NODE_PATH=$(npm root -g) node --test scripts/*.test.mjs: 202/202 PASS em três rodadas locais, Node 22.16.0; node --check PASS, typecheck isolado com stub do sync PASS.
- Full lint/build/Vitest/Playwright, browser IndexedDB real, Android/iOS e duas instalações físicas NÃO EXECUTADOS: dívida de homologação A38, não bloqueio para desenvolver.

## Git, riscos, rollback e relatório

Commit [skip ci] somente dev/markmap-pwa-v2, sem tocar main/Neon/produção. Quando cursor muda, retorno error seguro e próxima sync relê cursor avançado; nenhum descarte da outbox. Rollback por revert pontual sem migration. Atualizar Handoff/Checklist com evidência real.
