# MarkMap — A16/A17: seleção reativa e atualização do mapa offline

**Data:** 2026-10-10  
**Branch auditada:** `dev/markmap-pwa-v2`  
**HEAD-base:** `7e1339ac08be72c139c3f88701a3d4832a73b9b5`  
**Status:** implementação de desenvolvimento; testes Node direcionados, sem homologação física ou deploy.

## Objetivo e contexto

Fazer o mapa e seus recursos regionais seguirem imediatamente a seleção offline feita em Configurações ou outra aba. A15 já notifica mudanças no catálogo instalado via BroadcastChannel; A16 aproveita a chave histórica do localStorage e A17 conecta estes dois sinais ao ciclo de vida da tela cartográfica. IndexedDB continua sendo a fonte operacional dos pacotes; a arquitetura React/Vite/TypeScript, MapLibre, Hono e Neon como sync/backup é preservada.

## Auditoria do HEAD (antes do incremento)

- **FUNCIONA EM CÓDIGO:** `getSelectedOfflineMapId()`/`setSelectedOfflineMapId()` persistem o ID em localStorage; os pacotes são armazenados em `OfflineMapStore`; A15 já avisa o catálogo entre abas após commit.
- **PARCIAL:** Configurações mantinha um segundo state `selectedOfflineMapId` sincronizado manualmente, sem observar seleção alterada por outra aba.
- **PARCIAL:** `CommandCenterPage` lia o ID escolhido somente ao inicializar MapLibre e carregar busca regional; componentes de rota/altitude/conteúdo consultavam localStorage durante render. O mapa não reagia a trocas de seleção ou reinstalação da mesma região na outra aba.
- **NÃO VALIDADO:** eventos em WebView suspenso e renderização de PMTiles em dispositivo físico.

## A16 — seleção reativa sem segunda fonte de verdade

1. Preservar a chave `geonexo:selected-offline-map-package` e validação do ID no localStorage.
2. Expor `subscribeSelectedOfflineMapId` que observa evento `storage` de outras abas e evento local disparado somente após gravar seleção diferente; remover listeners ao desmontar.
3. Conservar os imports TypeScript existentes através de uma fachada `offline-map-selection.ts`, com helper JS e declaração TS para uso no Node/Vite.
4. `SettingsPage` usa `useSyncExternalStore` em lugar do espelho manual de seleção. Nenhum acesso remoto ou alteração de schema.

## A17 — refresh do mapa/catálogo e recursos vinculados

1. `CommandCenterPage` usa a mesma seleção reativa. Eventos A15 do catálogo da região selecionada aumentam uma revisão de visualização, sem reiniciar o mapa por alterações de regiões não selecionadas.
2. Ao mudar seleção/revisão, desmontar MapLibre anterior e recriar protocolos locais, fontes, contornos e estilo associados à região vigente. Conferir sinal de cancelamento antes de registrar protocolos após awaits, evitando inicialização antiga durante trocas rápidas.
3. Reiniciar busca regional, roteamento, dados de transporte e altitude ligados ao pacote; **não** excluir desenhos, datasets, feições de projeto ou outbox. `OfflineSearch`, `OfflineKnowledge`, `OfflineElevation` e `OfflineRouting` usam o mesmo ID e remount por revisão para descartar workers/GPS/dados do pacote anterior.
4. GeoPDF mantém precedência: quando aberto, atualizações de catálogo não devem substituir o PDF.
5. Ao identificar que a seleção local aponta para pacote removido, limpar somente a chave de seleção **se ainda aponta ao ID ausente**; instruir a escolher outra região e permitir fallback. Não remover arquivos ou pacotes.

## Fora do escopo

Não alterar backend, Neon, API, sincronização, contratos, schema de IndexedDB, quotas, importação, autorização de update A13/A14, gestão de desenho ou geopdf. Não instalar/desinstalar mapas automaticamente. Não fazer deploy, migration, tag/release, force-push, alterações na `main` ou excluir dados.

## Arquivos afetados

- `apps/admin/src/lib/storage/selected-offline-map.mjs` e `.d.mts` — eventos da seleção e persistência compatível.
- `apps/admin/src/lib/storage/offline-map-selection.ts` — fachada compatível.
- `apps/admin/src/pages/settings/SettingsPage.tsx` — seleção única observável.
- `apps/admin/src/pages/workspace/CommandCenterPage.tsx` — atualização de MapLibre e componentes ao mudar seleção/revisão de catálogo.
- `scripts/selected-offline-map.test.mjs` — regressões Node.
- `docs/MARKMAP_MASTER.md`, `docs/master-checklist.md`, `docs/handoff.md` e este documento.

## Segurança, integridade e critérios de aceite

- Dado ID novo salvo na mesma aba, o observador deve receber uma única notificação; salvar o mesmo valor não gera eventos duplicados.
- Dado evento `storage` de outra aba para a chave da seleção, o snapshot passa a refletir a chave atual sem apagar pacotes/IndexedDB.
- Dado seleção inválida ou localStorage desabilitado, recusá-la sem descartar escolha anterior; leitura degradada retorna `null`.
- Dado commit em outra aba na região selecionada, reabrir seus dados MapLibre, busca/rota/conteúdo/elevação a partir do pacote ativo. Alterações em outra região não forçam rebuild.
- Dado modo GeoPDF, manter o PDF como fonte visível e ignorar mudanças do pacote na montagem do mapa.
- Dado troca rápida de seleção, inicialização já cancelada não deve registrar protocolo antigo após awaits.
- Dado região removida, não renderizar manifesto/índice de outra geração e não tocar projetos/outbox.
- Toda leitura operacional continua local; `BroadcastChannel` é sinal de invalidação, não autoridade sobre os dados.

## Testes/QA executados

**Node.js v22.16.0, local:** `node --test scripts/selected-offline-map.test.mjs` = **5/5 PASS**, 0 falhas; cobre seleção mesma aba, eventos cross-tab simulados, ID inválido, storage indisponível e separação de sinais de catálogo. `tsc --noEmit --strict --target es2022 --lib dom,es2022 --module nodenext --moduleResolution nodenext` na fachada e declaração de seleção = **PASS**; `node --check` no helper = **PASS**.

**Regressões Node existentes reexecutadas separadamente:** `scripts/region-concurrency.test.mjs`, `scripts/region-continuity.test.mjs` e `scripts/region-install-feedback.test.mjs` do A14 = **17/17 PASS**. **Não é a suíte integral do monorepo.**

**NÃO EXECUTADO:** build/lint/typecheck do monorepo, renderização da tela com Playwright, testes reais de MapLibre, múltiplas abas/IndexedDB/Capacitor e validação física Android/iOS. Não são bloqueios para continuar desenvolvimento, mas não podem ser declarados aprovados.

## Riscos, Git, rollback e relatório

- Browser suspenso pode perder mensagens `BroadcastChannel`; ao reabrir a tela, a seleção atual é lida novamente. Atualização de geração enquanto aba permanece montada e perde sinal requer reconciliação em foco em fase posterior.
- Trocar pacote durante uma rota remove as instruções atuais de navegação; dados de projeto e desenho permanecem. Não afirmar persistência de navegação entre basemaps.
- O `useSyncExternalStore` depende de APIs de DOM; fallback SSR/ambiente sem localStorage retorna `null`.
- Revisão de pacotes continua dependente da verificação de geração A14, sem assumir entrega confiável de eventos.

**Git:** somente `dev/markmap-pwa-v2` com HEAD confirmado e `[skip ci]`; sem tocar branches alheias. **Proibidos:** GitHub CI remoto, deploy Vercel, merge `main`, migration Neon, release/tag, publicação em loja, secrets, force-push ou remoção irreversível sem autorização explícita. **Rollback:** revert isolado deste commit, sem migração nem perda de dados.

**Relatório final esperado:** SHA/arquivos, cobertura Node e verificações não executadas, riscos, próximo item e Checklist Mestre/Handoff sincronizados.
