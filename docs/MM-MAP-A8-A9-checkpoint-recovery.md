# MarkMap — A8/A9, Blobs persistentes e recuperação de checkpoints

**Data:** 2026-10-10  
**Branch alvo:** `dev/markmap-pwa-v2`  
**Base auditada:** `716f112e549dcba997b29e2d51760080f5c51dd8`  
**Estado:** implementado em código, testes Node direcionados; homologação browser/WebView **não executada**.

## Objetivo e contexto

Dar continuidade ao Maps Engine offline-first sem travar desenvolvimento por QA física/real (decisão expressa do responsável). A7 evitou instalar simultaneamente a mesma região em abas com Web Locks. Persistiam dois gargalos: arrays de até 250 MiB retidos durante montagem do arquivo e pré-checagem de retomada contabilizando qualquer linha de chunk, inclusive tamanho/offset inválido. A exclusão de hashes era global e poderia apagar checkpoints ainda referenciados por outra região.

## Auditoria do HEAD (antes da alteração)

- **FUNCIONA em testes Node anteriores (46/46):** verificação SHA-256 incremental, descarga HTTP 206 limitada, fallback 200 e retomada por hash; ativação por geração transacional.
- **PARCIAL:** downloader mantinha `Uint8Array[]` completo até `new Blob`; IndexedDB gravava `ArrayBuffer`; contagem por cursor sem checagem de offsets nem tamanho.
- **PARCIAL:** limpeza após instalar/atualizar fazia `deleteAsset` para cada hash, sem verificar se outro pacote em download o utilizava.
- **NÃO IMPLEMENTADO:** fallback seguro HTTP 200 se o servidor ignorasse Range em offset diferente de zero durante retomada.

## Escopo A8 — caminho Blob-first

1. `RegionDownloadCheckpoints.put` passa a persistir cada bloco como `Blob` (em vez de `ArrayBuffer`) usando apenas cópia limitada por chunk. A mesma **versão 1** do IndexedDB permanece; `getBlob` lê tanto registros novos `Blob` quanto antigos `ArrayBuffer` sem migração destrutiva.
2. `downloadVerifiedAsset` prefere `getBlob` quando disponível e faz hash do **exato Blob retornado** do checkpoint. Não retém a lista de `Uint8Array[]`, usa `Blob[]` referenciando chunks persistidos e monta o arquivo final após verificação SHA. Mantém contrato anterior `Promise<Blob>` e o adaptador legado de armazenamento em memória.
3. Arquivo `.d.mts` do downloader passa a declarar `getBlob?`; parsing/validação de pacotes, mapa ativo, outbox e fluxo de stage/activate permanecem inalterados.

**Limite da otimização:** construção de `Blob` composto e persistência IndexedDB dependem da implementação do navegador. Nenhum benchmark de RAM/CPU foi realizado; não prometer 250 MiB instaláveis em todos os dispositivos. O checksum SHA-256 confere integridade, não autenticidade do publicador.

## Escopo A9 — retomada e cleanup

1. Nova função `isValidCheckpoint`: só conta offsets alinhados e tamanhos **exatamente** iguais ao chunk esperado (padrão canônico 1 MiB, incluindo último bloco). Checkpoints incompletos/excedentes não reduzem o preflight de quota.
2. `setSession` registra referências imutáveis `{ sha256, size }` opcionalmente. Sessões antigas da v1 continuam legíveis e poderão retomar ao iniciar instalação com manifest atual, mas `checkResume` não anuncia quantia confiável sem tamanhos. **Nenhuma migração/descarte automático**.
3. `finishSession` remove uma sessão e somente os hashes que nenhuma outra sessão referencia, na mesma transação IndexedDB; não toca dados do projeto nem outbox.
4. Se um servidor ignorar `Range` e retornar HTTP 200 durante retomada, o downloader descarta a montagem parcial **em memória**, reinicia o hash e reprocessa a resposta inteira em chunks antes de aceitar. SHA e tamanho continuam obrigatórios; erros de stream limpam apenas os checkpoints da resposta inválida. Progresso visível não retrocede.

## Arquivos afetados

- `apps/admin/src/lib/storage/checkpoint-rules.mjs` e `.d.mts` — geometria de blocos e proteção de hashes compartilhados.
- `apps/admin/src/lib/storage/region-download-checkpoints.ts` — Blobs, contagem validada, sessão e limpeza transacional.
- `apps/admin/src/lib/storage/verified-range-download.mjs` e `.d.mts` — hash de Blob persistido, montagem sem arrays retidos, HTTP 200 em retomada.
- `apps/admin/src/lib/storage/resumable-installer.ts` — contas/assinatura por asset, cleanup seguro.
- `scripts/regional-checkpoint-recovery.test.mjs` — casos Node A8/A9.
- `docs/MARKMAP_MASTER.md`, `docs/master-checklist.md`, `docs/handoff.md` — espelhos da execução.

## Critérios de aceite e evidência

1. **Reinício:** dado dois chunks persistidos como Blob, ao retomar o downloader **não requisita** aqueles offsets, retorna bytes idênticos e usa apenas operações de Blob.
2. **Hash:** caso o storage devolva Blob alterado após `put`, a instalação falha com `checksum-mismatch` e a geração ativa nunca é alterada.
3. **Corrupção/recuperação:** checkpoint com comprimento errado é substituído pela resposta remota íntegra.
4. **HTTP sem Range:** dado `200` em offset >0, a montagem/hash são reiniciados do zero; resultado tem tamanho/hash corretos e progresso monotônico.
5. **Quota:** blocos incompletos, desalinhados ou excedentes não contam como bytes recuperáveis; sessões legadas não indicam progresso incerto.
6. **Concorrência/limpeza:** encerramento de sessão só escolhe hashes que outra região **não** referencia; rollback não afeta mapa, outbox, outros agentes ou branches.

**Executado no container:** Node `v22.16.0`, `node --test scripts/*.test.mjs apps/admin/src/lib/storage/*.test.mjs apps/admin/scripts/*.test.mjs`: **53/53 PASS**, 0 skipped/fail (46 anteriores + 7 testes A8/A9). `node --check` nos dois `.mjs` novos/alterados sem erro. `tsc --noEmit --strict --target ES2022 --module ES2022 --moduleResolution bundler --lib ES2022,DOM --skipLibCheck apps/admin/src/lib/storage/region-download-checkpoints.ts`: **0 erros**. Checagem sintática `transpileModule` também realizada nos módulos TS alterados; **não é typecheck do monorepo**.

**NÃO EXECUTADO:** monorepo completo `pnpm lint/typecheck/test/build`, browser IndexedDB real, MapLibre/UI, Android/iOS e benchmarks de memória. Continuar desenvolvimento normalmente; são pendências de homologação, não testes aprovados nem autorização de release.

## Segurança, riscos e rollback

- Não mudar contrato manifest v2, schema IndexedDB, API Hono ou Neon/PostGIS.
- Estruturas de Blob e `IDBCursor` ainda devem ser medidas nos WebViews reais; estado de persistência e quota depende do dispositivo.
- Hashes são IDs de conteúdo, não segredos, e não autorizam origem remota; mantenha URL HTTPS + checksums do manifest + validação de pacote.
- Falhas de transação em `finishSession` devem abortar apenas o cleanup; instalação já confirmada permanece sucesso.
- Para rollback, **reverter somente o commit A8/A9**; checkpoints novos armazenados como Blob poderão ser ignorados pelo código antigo que lê `ArrayBuffer` diretamente — recomendação: efetuar forward-fix na branch dev em vez de downgrade para releases anteriores sem migrador. Nenhum release foi distribuído.

## Regras de Git / ações proibidas / relatório esperado

Trabalhar somente em `dev/markmap-pwa-v2`, fast-forward mediante confirmação de HEAD, commit `[skip ci]`, sem duplicar branches/agentes nem push forçado. Proibidos: deploy Vercel, merge `main`, CI remoto, migration/drop/delete real, release/tag, rotação de secrets e publicação mobile sem autorização explícita.

Relatório final: HEAD/commit, arquivos, comandos/resultados reais, riscos, rollback/forward-fix e próximos itens livres; sincronizar Notion + `docs/master-checklist.md` + `docs/handoff.md` na mesma execução.
