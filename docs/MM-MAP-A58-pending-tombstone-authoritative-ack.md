# MarkMap — PRD A58: exclusões pendentes e tombstone sem identidade

**Data:** 2026-10-13. **Base auditada:** `dev/markmap-pwa-v2@180e017`, Checklist Mestre do Notion, zero PRs/issues abertos. **Track:** EVOLUIR EXISTENTE; preservar offline-first React/Vite/TypeScript, IndexedDB/outbox, Hono, Neon/PostGIS e Capacitor.

## Objetivo e contexto
Evitar que o pull confunda o tombstone de uma exclusão local já aplicada (cujo ACK de push ainda não chegou) com exclusão concorrente. No contrato `tombstoneSchema` não há `operationId`; a igualdade entre versão prevista e tombstone **não é prova de autoria**. Não inventar ACK nem descartar outbox.

## Auditoria do estado real
- **FUNCIONA:** push com receipt por operationId e idempotência backend; IndexedDB transacional; CAS do cursor; conflitos monotônicos A57.
- **QUEBRADO (reproduzido):** `applyServerPage` registra `VERSION_CONFLICT` sempre que há tombstone e pendência local, mesmo se tombstone já está incluído em `baseVersion` ou pode ser a própria exclusão ainda sem ACK. Isso bloqueia retry da outbox.
- **PARCIAL:** sem identificação de operação no tombstone wire; a conciliação final depende de push/replay autenticado.
- **NÃO IMPLEMENTADO:** integração de duas instalações com Postgres real e aparelho Android/iOS na fase de QA.

## Escopo e arquivos
- `apps/admin/src/lib/local-repositories/index.ts`: ignorar tombstone com versão <= baseVersion local conhecida; se pendência for `delete` com base válida e `tombstone.version === baseVersion+1`, **adiar decisão** sem criar conflito ou ACK e manter outbox imutável até retorno de `push`.
- `scripts/local-pending-delete-replay.test.mjs`: dez testes A58 positivos/negativos/concorrência, CAS e ACK posterior.
- Atualização posterior de `docs/handoff.md`, `docs/master-checklist.md`, `docs/MARKMAP_MASTER.md`, `docs/release-checklist.md` e Notion.

## Fora do escopo e regras de negócio
Nenhum `operationId` sintético em tombstone, novo endpoint, alteração Zod, mudança de PostgreSQL/Neon/PostGIS, migração IndexedDB, alteração de MapLibre/Terra Draw, PWA, deploy ou exclusão de arquivos. Um tombstone com versão **mais nova** (fora da faixa ambígua) continua gerando conflito real; base nula exige comportamento conservador.

## Segurança e critérios de aceite
1. Base conhecida v1 + delete local + tombstone v2 não gera conflito nem ACK presumido; outbox preservada para retry idempotente.
2. Mesmo caso com exclusão de outro dispositivo também não é confundido com ACK: push resolverá por `alreadyApplied` ou conflito.
3. Tombstone v3 sobre base v1 gera conflito explícito; base nula não é forçada a sucesso.
4. Tombstone histórica v2 sobre edição baseada em v3 não bloqueia envio.
5. ACK explícito posterior remove apenas a operação correta e atualiza versão; cursor é transacional.

## Testes e QA observados
Baseline no código A57: **5/10 FAIL**. Após patch e correção do fixture cross-realm: **10/10 PASS**. A suíte Node local A53–A58: **55/55 PASS em duas execuções**; TypeScript estrito `tsc -p tsconfig.qa.json` com stubs do contrato PASS; `node --check` PASS. Testes usam MemoryLocalDb, **não equivalem a IndexedDB real no browser ou homologação Postgres**.

## Riscos, rollback e convivência
Risco: exclusão de outro dispositivo na exata versão esperada não é apresentada como conflito no pull, mas o próximo push autenticado a rejeitará e criará conflito, sem perda de outbox. Rollback por revert isolado do commit, sem migration. Revalidar HEAD/PRs antes de push e não sobrescrever outro agente.

## Git, proibições e relatório final esperado
Branch `dev/markmap-pwa-v2`, commit `[skip ci]`. Proibido GitHub Actions/CI remoto, merge main, Vercel/deploy, migração e alteração Neon/produção, rotação de secrets, force push, release/tag, lojas ou DELETE destrutivo. Relatar SHA do commit, SHA do blob, casos antes/depois, QA realmente executado e limites do gate A38; atualizar Handoff/Checklist. A38 impede apenas release, não desenvolvimento.

## Instrução para executor
Inspecione o HEAD e Checklist Mestre; reproduza os dez cenários; aplique diff mínimo na conciliação dos tombstones; preserve outbox sem presumir ACK; execute Node e TypeScript isolados, faça QA por hashes e registre pendências.
