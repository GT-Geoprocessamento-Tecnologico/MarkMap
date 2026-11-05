# A209 — Corrigir testes de navegação offline do Service Worker sem alterar seu contrato

**MarkMap / GitHub issue #45 e #97** · **Data:** 2026-11-03 · **Base:** `main@92dfbffa77d4707820ef9124e97d7b6cf066e260` · **Branch:** `test/pwa-approved-shell-navigation-20261103`

## Objetivo e contexto
Restabelecer a fidelidade da suíte Node `sw-navigation-cache.test.mjs` ao Service Worker offline-first atualmente versionado, que preserva o shell aprovado e exige recuperação explícita quando ele está incompleto. Não reduzir proteção ou alterar comportamento de usuários.

**RED reproduzido:** `node --test apps/admin/scripts/sw-navigation-cache.test.mjs` contra `sw.js` do `main` resultou **1 PASS / 2 FAIL**, erro `TypeError: caches.keys is not a function`. Os testes antigos simulavam apenas `caches.open` e esperavam resposta de rede para navegações, contrariando o SW atual. A mesma falha aparece no job GitHub Actions `PWA service worker regressions` do PR #106, job `126200728890`, run `41717347637`.

## Auditoria — classificação antes da mudança
- **FUNCIONA no teste isolado:** SW existente mantém shell aprovado entre reinícios e versões, protege IndexedDB/outbox, não usa HTML de rede para atualizar silenciosamente, e oferece recuperação guardada; 27 testes oficiais `sw-approval-policy.test.mjs` PASS no ambiente local.
- **QUEBRADO:** harness de `sw-navigation-cache.test.mjs` não emulava `caches.keys` nem o registro durável de aprovação; seus dois primeiros casos exigiam navegação network-first já incompatível.
- **PARCIAL:** gate agregado do CI está vermelho por outras falhas independentes (lint API, auditoria de dependências, teste API no prebuild E2E, política de versão), não resolvidas aqui.
- **NÃO IMPLEMENTADO / fora deste escopo:** testes em PWA física e homologação Android/iOS; não presumir que um teste Node simule browser real.

## Escopo
1. Substituir somente a fixture da suíte de navegação para expor `caches.open`, `caches.keys`, cache por namespace e pares HTML + JS de uma versão aprovada, sem instalar/service worker real.
2. Verificar rotas válidas do SPA, rotas proibidas, ausência de requisições de navegação à rede mesmo quando online, e ausência de escritas durante navegação.
3. Verificar offline com shell aprovado existente, falha segura (HTTP 503 recovery) quando aprovação ou bundle JS falta, e `version.json` somente pela rede.
4. Manter caso de métodos não GET e origens externas fora da interceptação.

## Fora do escopo / ações proibidas
**Nenhuma** alteração em `apps/admin/public/sw.js`, lógica de aprovação, CacheStorage/IndexedDB/outbox, aplicação em produção, dependências, workflow do CI, histórico de outros branches/PRs, API/Neon, permissões, versionamento, deploy ou release. Proibido eliminar asserts para tornar o check verde, forçar merge, desativar gates/segurança, apagar dados ou mudar billing.

## Arquivos afetados
- `apps/admin/scripts/sw-navigation-cache.test.mjs` (somente testes)
- `docs/PRD-CI-PWA-NAVIGATION-HARNESS-A209-20261103.md` (rastreabilidade)

## Segurança e critérios de aceite
- [x] Simular a aprovação **pré-existente** e o marcador de cache completo; não criar aprovação automaticamente em `navigate`.
- [x] Provar `networkReads = 0` para todas as navegações autorizadas (online e offline) e `writes = 0`.
- [x] Falha de aprovação e falta do JS levam a recuperação 503 sem HTML de rede.
- [x] `version.json` mantém acesso de rede `no-store`, sem confundir com navegação da PWA.
- [x] SW runtime não modificado; branch separada de #104, #105, #106.
- [ ] Validar a mesma suíte no GitHub Actions no SHA da PR e após integração coordenada.

## Testes e QA realmente executados
- Ambiente parcial com Node **22.16.0**, worker real `apps/admin/public/sw.js` com git blob `75ec1601afe8cd231ff0e4d99ceb060792471f77`.
- **RED antes:** 3 casos, **1 PASS / 2 FAIL**, ambos `caches.keys is not a function`; blob anterior `5ed31bf2205272c43b51c4d07c9bb68ea9491321`.
- **GREEN isolado:** 5/5 PASS (`node --test .../sw-navigation-cache.test.mjs`).
- **GREEN combinado:** **35/35 PASS**, `node --test .../sw-approval-policy.test.mjs .../sw-navigation-cache.test.mjs .../sw-update-protocol.test.mjs`.
- `node --check` PASS; blob do teste executado e enviado ao GitHub = `990a31745c777c6c5dd9454dddd6a3d63b7c5198`.
- **Não executados:** pnpm/Vitest geral, lint/tsc monorepo, Vite build, Playwright real, browser físico. GitHub Actions da PR será avaliado separadamente; não reivindicar PASS antecipado.

## Git, coordenação, riscos e reversão
Branch isolada derivada da `main` verificada, PR **Draft** para futura QA; não editar PRs #104/#105/#106. Risco: mock Node não substitui CacheStorage e WebView reais e suites prévias podem ter outras falhas; mitigação: manter 27 casos de SW e testes físicos pendentes. Rollback somente do arquivo de teste; nenhum dado do usuário é tocado. Nenhum bump de versão: alterações exclusivamente de teste e documentação, release real exige coordenação com versão reservada.

## Documentação e relatório final esperado
Registrar hora ISO8601 com America/Araguaina, SHA da branch e base, logs RED/GREEN, alterações, bloqueios e próximos gates no Obsidian (Diário/Handoff/Checklist/nota CI), Checklist Mestre Notion, issue #45 e PR Draft. Confirmar leitura posterior.

**Próximo passo:** após validar esta PR, investigar independentemente lint API, auditoria de dependências, falhas de API no prebuild E2E e versão de release. Não considerar a linha de release homologada antes de todos os controles obrigatórios.
