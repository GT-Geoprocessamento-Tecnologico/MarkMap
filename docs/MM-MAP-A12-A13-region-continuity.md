# A12/A13 — Continuidade de downloads e atualização regional com consentimento fixado

**Data:** 2026-10-10  
**Base auditada:** `dev/markmap-pwa-v2@6cb65ca681bf6a6ced3dbdcd3214a06d47d647b1`  
**Estado:** código de desenvolvimento com verificações direcionadas; sem release ou deploy.

## Objetivo e contexto

Dar continuidade ao instalador de mapas offline após a navegação e impedir que o usuário confirme uma atualização e receba silenciosamente um manifest remoto diferente do consultado. A fonte operacional continua IndexedDB/outbox local; Neon/PostGIS permanecem fora deste incremento.

## Auditoria anterior

- **FUNCIONA em código:** A10/A11 consulta checkpoints de manifest explícito, cancela fetch/download e separa erros de quota.
- **PARCIAL:** `SettingsPage` reiniciava o campo de URL como vazio ao montar, apesar de existir origem HTTPS persistida para regiões instaladas. Um download novo interrompido perdia a URL ao navegar.
- **RISCO DE INTEGRIDADE (não reproduzido no navegador):** `RegionManager.applyUpdate` baixava o manifest novamente após a consulta; a mesma versão poderia apresentar hashes/recursos diferentes do pacote mostrado no botão.
- **NÃO VALIDADO:** comportamento E2E com duas abas/WebView, performance e 250 MiB físicos.

## Escopo de A12

1. Persistir **somente URL pública sanitizada** de `manifest.json` em `sessionStorage`, por aba; não guardar credenciais, queries, fragmentos, arquivos ou dados do usuário.
2. Ao reabrir Configurações, restaurar a URL temporária; sem rascunho, usar a origem já confiável da região selecionada, quando presente.
3. Nenhum fetch automático nem reativação de instalação: a pessoa escolhe **Verificar progresso salvo** ou **Retomar**; os blocos persistidos anteriormente no IndexedDB não são removidos.
4. Limpar rascunho após instalação bem-sucedida, ou quando URL digitada se torna inválida. Se `sessionStorage` for negado, continuar sem persistência, sem quebrar a interface.
5. Reutilizar o validador estrito de fontes HTTPS/localhost no registro de atualização existente.

## Escopo de A13

1. Produzir fingerprint SHA-256 estável do **manifest completo validado com o schema**, independentemente da ordem das chaves JSON.
2. A consulta de atualização guarda em memória: URL de origem, versão local observada e fingerprint do manifest; a UI exibe o host de origem e versão antes do aceite.
3. O botão aplica apenas a versão **exatamente correspondente** à consulta: qualquer alteração de origem, versão instalada, SHA/estilo/recursos do manifest exige nova consulta.
4. Ao falhar/atualizar, descartar aprovação anterior para evitar reaproveitar um aceite antigo. Sem limpeza automática de mapa ativo ou checkpoints.

## Fora do escopo

Não fazer instalação silenciosa ou automática, sincronizar rascunho entre dispositivos, mudar IndexedDB schema, alterar contratos v2, substituir stack, guardar credenciais, migrar Neon, criar sistema de atualização remoto paralelo, redistribuir mapas OSM ou executar deploy/release.

## Arquivos afetados

- `apps/admin/src/pages/settings/SettingsPage.tsx` — recuperação de URL, aviso, aprovação vinculada e invalidação.
- `apps/admin/src/lib/storage/region-source-registry.ts` — reutilização da sanitização de URL.
- `apps/admin/src/lib/storage/region-install-draft.mjs` e `.d.mts` — draft sanitizado em sessionStorage.
- `apps/admin/src/lib/storage/region-manager.ts` — preview com identidade e revalidação antes de instalar.
- `apps/admin/src/lib/storage/region-update-identity.mjs` e `.d.mts` — fingerprint do manifest.
- `scripts/region-continuity.test.mjs` — casos Node direcionados.
- Documentação: `docs/MARKMAP_MASTER.md`, `docs/handoff.md`, `docs/master-checklist.md` e este PRD.

## Segurança e critérios de aceite

- Um rascunho HTTPS sem secrets sobrevive à navegação dentro da aba, mas não dispara rede ou download sozinho.
- URLs com token, username/password, hash, HTTP externo ou outro caminho são recusadas e não persistem em sessionStorage.
- A origem instalada conhecida pode preencher a interface sem se conectar ao servidor.
- Confirmação de atualização exige preview da versão, origem e SHA de todos os dados do manifest; mudança em qualquer campo faz `applyUpdate` recusar.
- A validação de pacote e o rollback de geração já existentes continuam obrigatórios. O SHA de manifest é prova de identidade do preview, **não autenticação criptográfica do publicador**.

## Testes e QA

**Executado localmente (Node 22.16.0):** `node --test` dos 6 testes novos A12/A13 e 8 testes existentes de manifest/feedback A10/A11: **14/14 PASS**. `node --check` dos módulos JS, `tsc --strict --noEmit` isolado de declarations e registry e sintaxe TSX via `typescript.transpileModule`: sem erros. Teste explícito de origem/versão alterada, JSON reordenado, fonte insegura e falha de sessionStorage.

**Não executado:** lint/typecheck/build/Vitest completos do monorepo, browser/React E2E, IndexedDB real, Android/iOS físico, latência de rede e atualização entre abas. Ausência de dispositivos reais **não bloqueia fases seguintes de desenvolvimento**, mas não pode ser registrada como aprovação de release.

## Git, ações proibidas e rollback

Trabalhar apenas em `dev/markmap-pwa-v2` após conferir HEAD e PRs; atualizar a ref com comparação do SHA esperado, sem force-push. Commit `[skip ci]`. Proibido sem autorização: merge `main`, GitHub CI remoto, Vercel deploy público, release/tag, lojas, Neon/migrations, secrets, apagar dados ou branches de terceiros.

Rollback: revert isolado de A12/A13, sem migração e sem apagar storage ou outbox.

## Riscos e relatório final

- `sessionStorage` é por aba e pode ser removido pelo navegador. A retomada real continua baseada nos chunks persistidos do IndexedDB.
- Fingerprint não substitui a verificação SHA-256 de **cada arquivo** no instalador; não impede mudanças do pacote após o último manifest, que continuam sujeitas à validação de bytes.
- A rechecagem de base ocorre antes de iniciar o instalador; concorrência durante a ativação continua exigindo a guarda transacional existente.
- Relatório: HEAD/commit, arquivos alterados, resultados observados, QA não executada, limites conhecidos e atualização de Checklist/Handoff.
