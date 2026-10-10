# MarkMap — A14/A15: concorrência de atualização e catálogo entre abas

**Data:** 2026-10-10  
**Branch:** `dev/markmap-pwa-v2`  
**Base/HEAD auditado:** `b739b11772cecf1af6589fea2f116099dd143804`  
**Estado:** incremento implementado em código, verificação local direcionada; sem homologação WebView, release ou deploy.

## Objetivo e contexto

Evitar que uma atualização regional confirmada em uma aba substitua outra geração instalada durante o download em uma segunda aba. A13 verificava versão, origem e hash do manifest antes de chamar o instalador, mas não guardava uma condição transacional na ativação. A15 atualiza a interface de outras abas após uma mudança local, sem tornar o canal de mensagens uma fonte de verdade. Arquitetura preservada: React/Vite/TypeScript, MapLibre, IndexedDB/outbox, Hono e Neon como sync/backup; instalar/consultar mapa ativo continua offline.

## Auditoria do HEAD

- **FUNCIONA EM CÓDIGO:** Web Locks por região em `ResumableInstaller`, validação dos arquivos e staging/ativação IndexedDB por geração; preview A13 por origem, versão e fingerprint do manifest.
- **PARCIAL/RISCO CONCRETO EM LEITURA:** `applyUpdate` lia a versão instalada antes de `startInstall`. Durante o download, outra aba ou importação local poderia trocar o ativo, e `offlineMapStore.install()` ativaria o pacote antigo sem comparar a geração ativa da consulta.
- **NÃO IMPLEMENTADO antes deste incremento:** notificação reativa entre abas para invalidar o consentimento antigo; a lista só era atualizada por ações locais.
- **NÃO COMPROVADO:** falha real em aparelhos/browser, cenários de suspensão forçada e throughput de broadcasts.

## A14 — escopo técnico

1. `OfflineMapStore.getActiveRevision()` obtém manifest e geração ativa **em uma leitura consistente**; recusa múltiplos ativos ambíguos.
2. Preview de atualização carrega `installedGeneration`, além de URL, versão instalada e fingerprint. A confirmação compara todos; qualquer alteração rejeita a operação.
3. `ResumableInstaller` verifica `expectedActiveGeneration` **dentro do Web Lock** antes de consumir a origem/checkpoints e transmite a condição até `OfflineMapStore.install()`.
4. `OfflineMapStore.stage()` e `activate()` conferem a geração esperada **dentro de suas próprias transações readwrite** (compare-and-swap). A rechecagem em `activate` protege contra a troca ocorrida após stage, inclusive sem Web Locks.
5. Se `activate` falhar, limpeza best-effort limita-se à geração **staged** criada por esta tentativa; jamais exclui uma geração ativa. Erro `stale-active-generation` instrui consultar novamente, sem repetir aceite antigo.

## A15 — interface entre abas

1. Após ativação/remoção local confirmada, envia somente `{type:'region-changed',regionId}` por `BroadcastChannel` com chave fixa (sem dados pessoais, manifest ou bytes).
2. `SettingsPage` recebe o aviso, invalida previews autorizados e recarrega a lista **pelo IndexedDB**. Mensagens malformadas ou IDs inseguros são ignorados e listeners são fechados no desmontar.
3. Sem `BroadcastChannel`, o mapa continua utilizável; a checagem transacional A14 evita sobrescrever geração mesmo se a UI estiver desatualizada.

## Fora do escopo, arquivos e segurança

Não introduzir lock persistente, sincronização online, nova API/DB, migrations, cleanup automático de projetos/chunks/outbox, reset de storage, licenças OSM, publicação, Vercel/Neon ou release. Não alterar contrato v2, limites de quota nem a versão de IndexedDB.

**Arquivos afetados:** `offline-map-store.ts`, `region-manager.ts`, `resumable-installer.ts`, `region-update-identity.mjs/.d.mts`, `region-install-feedback.mjs`, `SettingsPage.tsx`; novos `region-generation-guard.mjs/.d.mts`, `region-catalog-events.mjs/.d.mts`, `scripts/region-concurrency.test.mjs`; docs mestre, checklist, handoff e este PRD.

## Critérios de aceite

- Dada revisão `A`, quando outra aba promove `B` durante o download, então a tentativa baseada em `A` falha antes de substituir `B`, inclusive se manifest e version string são idênticos.
- Dado ativo excluído ou ambíguo, quando o instalador exige revisão anterior, então rejeita sem excluir projeto, outbox ou geração ativa.
- Dado erro entre stage e activate, quando limpar staging, então somente o ID de geração staging próprio pode ser removido.
- Dado aviso entre abas, quando receber mensagem `region-changed` válida, então invalidar aceite e reler a fonte local. Sem canal, manter instalação possível, sem alegar notificação garantida.
- Dado update explícito iniciado sem condição CAS (primeira instalação manual), manter contrato anterior.

## Testes e QA observados

**Executados localmente:** Node `22.16.0`, `node --test scripts/region-concurrency.test.mjs scripts/region-continuity.test.mjs scripts/region-install-feedback.test.mjs`: **17/17 PASS**, zero fail/skip (6 novos A14/A15 + 11 regressões A10–A13). `node --check` dos novos helpers e `tsc --noEmit --strict` isolado das declarações: sem erro. `typescript.transpileModule` passou nos arquivos `SettingsPage.tsx` e `offline-map-store.ts`. Harness local com IndexedDB simulado e código transpilado de `OfflineMapStore.activate()` confirmou rejeição pré-mutation do snapshot stale. Esse harness **não equivale a E2E de IndexedDB real**.

**NÃO EXECUTADOS, sem bloquear próximas fases de desenvolvimento:** full lint/typecheck/build/testes do monorepo, IndexedDB em navegador real, two-tabs WebView/Capacitor, Playwright, Android/iOS e testes físicos ou dados remotos. Não registrar homologação/release aprovado.

## Git, riscos, rollback e relatório final

Trabalhar apenas sobre HEAD confirmado da branch dev, sem sobrescrever outros agentes; commit `[skip ci]` com comparação de HEAD antes de mover ref, sem force push. **Proibidos sem autorização:** merge `main`, GitHub Actions, deploy público Vercel, alterações Neon/produção, migrations, exclusão de dados, tag/release ou publicação em loja.

Riscos residuais: `BroadcastChannel` pode ser indisponível; não garante entrega, por isso a proteção é CAS no IndexedDB. Falha de energia pode deixar staging órfão; próxima tentativa substitui staging antigo da mesma região e nunca remove ativo por engano. Um import manual explícito mantém a semântica anterior de substituição; alterações remotas ainda requerem checksum de cada asset.

**Rollback:** reverter somente commit A14/A15 da branch dev; nenhum schema mudou e não há migração reversa. **Relatório esperado:** SHA, mudanças, testes executados, não executados, riscos, próxima prioridade; atualizar Checklist Mestre/Handoff no Notion.
