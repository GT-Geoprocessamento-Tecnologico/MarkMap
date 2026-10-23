# MarkMap — A18/A19: retorno do segundo plano e recursos por geração

**Data:** 2026-10-10  
**Branch:** `dev/markmap-pwa-v2`  
**HEAD de partida auditado:** `8a986d37065f4f51295f146b5a9101f7cbc23dfd`  
**Entrega:** implementação de desenvolvimento, sem deploy ou merge.

## Objetivo

Recuperar a seleção e a geração regional corretas após suspensão da aba ou WebView, mesmo quando eventos `storage`/`BroadcastChannel` não forem entregues; impedir a combinação de estilo, glifos e outros recursos de gerações IndexedDB diferentes durante atualizações concorrentes. Operação inteiramente offline: IndexedDB e localStorage seguem como fonte operacional.

## Auditoria antes de alterar

- **FUNCIONA em código:** A16/A17 atualizam seleção com `useSyncExternalStore`, desmontam o mapa ao trocar região e observam `BroadcastChannel`; A14 protege a ativação com compare-and-swap (CAS) em IndexedDB.
- **PARCIAL:** se a WebView for suspensa e perder eventos de outra aba, a geração do MapLibre já montado pode ficar desatualizada até uma nova notificação.
- **PARCIAL:** o `CommandCenterPage` lia o manifest da região e os blobs por transações independentes usando a geração ativa no instante de cada consulta. Uma atualização concorrente poderia misturar referências do pacote anterior com recursos novos ou gerar falha de inicialização.
- **NÃO IMPLEMENTADO no HEAD:** reconciliação por `focus/pageshow/visibilitychange`, leitura explícita de asset + marcador de geração ativa na mesma transação.
- **NÃO COMPROVADO:** comportamento em WebView e armazenamento físico, benchmark de memória e renderização MapLibre após suspensão.

## A18 — escopo

1. `subscribeRegionForeground`: observar `pageshow`, `focus` e `visibilitychange` somente quando o documento estiver visível, sem timer, polling, rede ou escrever dados.
2. `createRegionRevisionReconciler`: após uma região ser efetivamente montada, comparar o ID de seleção e a geração ativa de `OfflineMapStore.getActiveRevision` com o estado renderizado. Em diferença, solicitar refresh uma única vez para a mesma revisão; coalescer despertares concorrentes e ignorar leitura concluída após desmontagem/troca de seleção.
3. `selected-offline-map.mjs`: ao voltar do segundo plano, reler a chave histórica `geonexo:selected-offline-map-package` do localStorage e notificar `useSyncExternalStore` somente quando houver seleção diferente, mesmo que o evento `storage` original tenha sido perdido.
4. `SettingsPage`: atualizar catálogo e seleção a partir do armazenamento local no retorno/foco, invalidando confirmações de update antigas. Falha de leitura não remove pacotes.
5. `CommandCenterPage`: revalidar a geração da região exibida ao voltar ou receber aviso A15; região diferente do mapa selecionado não reconstrói MapLibre; GeoPDF tem precedência.

## A19 — escopo

1. `readActiveGenerationAsset`: ler, em uma **única transação readonly IndexedDB**, o marcador do pacote ativo e o Blob solicitado para uma geração explícita; falhar com `null` se o marcador não for ativo, se o asset pertencer a outra geração/path ou não for Blob.
2. `OfflineMapStore.assetAtRevision`: reutilizar o helper, sem nova store, contrato ou migration.
3. `CommandCenterPage`: obter `getActiveRevision` uma vez para o pacote em inicialização e carregar PMTiles/estilo/contornos e os recursos do protocolo de fontes pelo mesmo identificador de geração. Quando uma atualização substituir a geração durante a leitura, reinicializar com a nova revisão em vez de misturar assets.
4. Preservar o mapa carregado até a nova renderização; erros/transições devem ser explícitos, sem limpar desenhos, projetos, outbox, banco ou dados de campo.

## Fora do escopo

Não criar backend, sincronização online adicional, armazenamento duplicado, polling, timers, migração, alteração de quotas, reconfiguração de Service Worker, assinatura de pacote, alteração na versão de IndexedDB, publicação Vercel/lojas ou execução de workflows CI remotos.

## Arquivos afetados

- `apps/admin/src/lib/storage/region-foreground-reconcile.mjs` e `.d.mts` (novos).
- `apps/admin/src/lib/storage/region-generation-asset.mjs` e `.d.mts` (novos).
- `apps/admin/src/lib/storage/selected-offline-map.mjs` (reconciliação da seleção).
- `apps/admin/src/lib/storage/offline-map-store.ts` (`assetAtRevision`).
- `apps/admin/src/pages/workspace/CommandCenterPage.tsx` (seleção/geração/recursos).
- `apps/admin/src/pages/settings/SettingsPage.tsx` (catálogo ao retornar).
- `scripts/region-foreground-reconcile.test.mjs`, `scripts/region-generation-asset.test.mjs` e `scripts/selected-offline-map.test.mjs`.
- `docs/MARKMAP_MASTER.md`, `docs/master-checklist.md`, `docs/handoff.md` e este PRD.

## Segurança e critérios de aceite

- Dada geração A exibida, quando aba for retomada e IndexedDB indicar geração B, então a UI deve solicitar reconstrução uma vez, sem rede nem alteração de dados.
- Dada mesma geração A, múltiplos eventos focus/pageshow/visible não devem reconstruir sem necessidade.
- Dado documento oculto, callbacks de foreground não devem executar leitura até estar visível.
- Dada troca de seleção ou desmontagem durante um `await`, resultado obsoleto não pode iniciar refresh de outro mapa.
- Dada falha de leitura IndexedDB, NÃO interpretar como pacote removido; preservar seleção, mapa e dados.
- Dada transação de leitura do asset, marcador da geração ativa e Blob devem pertencer à mesma geração. Blob antigo da geração `staged` deve ser rejeitado.
- Dado GeoPDF ativo, permanecer no PDF e ignorar mudança de basemap regional.
- Dado mapa removido, só limpar ID de seleção se ainda apontar ao ID ausente, sem apagar pacotes ou outbox.

## Testes e QA — evidências executadas

**Ambiente:** Node.js 22.16.0 (Linux), sem npm install nem alteração de dependências.

- `node --test scripts/*.test.mjs` no recorte local A10–A19: **36/36 PASS, 0 falhas/0 skips**. Inclui 8 testes A18 de retomada/race/falha, 5 testes A19 de snapshot de assets, 6 testes de seleção A16/A18 e regressões A10–A15.
- `node --check` para os novos helpers JS e para `selected-offline-map.mjs`: **PASS**.
- `tsc --noEmit --strict --target es2022 --lib dom,es2022 --module nodenext --moduleResolution nodenext` nas declarações `.d.mts` e na fachada de seleção TS: **PASS**.
- `CommandCenterPage.tsx`, `SettingsPage.tsx` e `OfflineMapStore.ts`: alterações em blobs auditados no HEAD; **não foi executado build/typecheck completo desses arquivos**.

**NÃO EXECUTADO e NÃO BLOQUEANTE para próximas fases de código:** lint/typecheck/build Vitest/E2E completo do monorepo, múltiplas abas reais, IndexedDB/MapLibre em navegador, testes físicos Android/iOS e avaliação RAM/GPS. Não anunciar homologação ou Release Candidate validado.

## Riscos, regras Git, ações proibidas e rollback

- `BroadcastChannel` e eventos de foreground são _hints_, não fonte de verdade; IndexedDB é reconsultado. `assetAtRevision` garante coerência do instante da transação, mas não impede que uma aba remova os assets depois; a reconciliação deve solicitar remount.
- Retornar do background pode recarregar o basemap se a geração mudou; rotas transitórias associadas ao pacote antigo são reiniciadas por A17. Dados de campo e outbox permanecem.
- Trabalho apenas na `dev/markmap-pwa-v2`, com HEAD revalidado, update fast-forward e `[skip ci]`. Não sobrescrever branches de agentes.
- **Proibido sem autorização:** force push, merge na `main`, GitHub Actions remoto, deploy público na Vercel, release/tag, publicação Android/iOS, Neon/migration, operações destrutivas ou exclusão de secrets/dados.
- **Rollback:** revert do commit A18/A19 na branch dev, sem reversão de schema ou exclusões.

## Relatório final e próxima continuidade

Reportar commit/HEAD, paths alterados, testes efetivamente executados, QA pendente e riscos conhecidos. Atualizar `docs/handoff.md`, `docs/master-checklist.md` e Checklist Mestre no Notion. Próxima avaliação de código: integrar teste de UI/estado após retomada em harness de browser quando ambiente permitir, sem bloquear evolução de funcionalidades.
