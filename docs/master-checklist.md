# MarkMap — Checklist Mestre de Execução

> Espelho versionado do **Checklist Mestre do Notion**.
>
> Notion: https://app.notion.com/p/3ed8e0bd0f4d81b6832bcf848c0ab504?pvs=204
>
> **Regra de sincronização:** qualquer mudança relevante de fase, arquitetura, bloqueio, evidência ou próximo passo deve atualizar, na mesma execução, este arquivo, o Checklist Mestre no Notion e `docs/handoff.md`. Não marcar item como concluído sem evidência.

**Snapshot:** 2026-10-06  
**Repositório:** `mmatteuus/MarkMap`  
**HEAD de referência anterior à criação deste espelho:** `469c781`

## Estado operacional

**Objetivo:** manter uma única visão executável da MarkMap. O produto é offline-first; Neon/PostGIS é sincronização/backup, não requisito para o trabalho de campo.

**Auditoria:** frontend auditado e refinado. Site e app operacionais; hardening recente inclui PWA/mobile metadata, correções de acessibilidade, proteção de filtros numéricos do OpenFreeMap, fallback para sprites ausentes e iconografia SVG autocontida. GitHub Actions recentes tiveram execuções encerradas antes dos steps; a baseline verde anterior continua sendo a evidência automatizada consolidada.

**Fase atual:** frontends Web/PWA publicados na Vercel com domínios customizados configurados. Release continua condicionado à API/sync remoto de produção, testes físicos, política pública de privacidade, smoke de produção e signing/publicação mobile autorizados.

## Legenda

- ✅ **CONCLUÍDO** — há evidência técnica.
- 🟡 **EM ANDAMENTO** — implementação existe, mas falta fechar validação atual.
- ⏸ **BLOQUEADO** — depende de fator externo.
- ⬜ **PENDENTE** — ainda precisa ser executado.

# FASE 0 — Governança e continuidade

- [x] **P0** Criar Instruções-Mestre do projeto.
- [x] **P0** Criar Handoff de Continuidade.
- [x] **P0** Criar política de mudanças estruturais.
- [x] **P0** Criar baseline de ADRs.
- [x] **P0** Criar política/inventário de terceiros.
- [x] **P0** Criar Checklist Mestre no Notion.
- [x] **P0** Publicar Instruções-Mestre, Handoff, políticas, ADRs e personalização no repositório. Evidência histórica: commits `0326018` até `3fd2979`.
- [x] **P1** Checklist revalidado em 2026-10-02 contra main, PR #2 e Neon production.
- [x] **P1** Auditoria/limpeza documental concluída em 2026-10-03. Evidência: commits `b0d2a3c` e `8ddf3ef`.
- [x] **P1** Espelho versionado do Checklist Mestre criado no repositório em `docs/master-checklist.md`; sincronização Notion ↔ GitHub ↔ Handoff passa a ser obrigatória para mudanças relevantes.

# FASE 1 — Qualidade do HEAD atual

- [x] **P0** Baseline anterior com `lint + typecheck + test + build` verde e Playwright `68 passed / 12 skipped / 0 failed`. Evidência: commit `101d678`.
- [x] **P0** Testes de reconnect/retry/conflict do sync adicionados. Evidência: commit `08073ad`.
- [x] **P0** Baseline verde anterior em `8ddf3ef` registrada.
- [x] **P0** HEAD final `cc2331d` revalidado: Lint, Typecheck, Unit, Build, E2E desktop/Android, E2E iOS/WebKit, E2E duas instalações e PostGIS Integration verdes; Quality and Security verde com dependency audit, secret scan e Lighthouse/a11y.
- [x] **P0** Pacotes mobile revalidados: Android APK verde em `c1f86eb`; iOS App verde em `b52ca6f`.
- [ ] **P1** Revalidar CI completa em um runner que efetivamente execute os steps do HEAD atual; execuções recentes encerraram antes dos steps.

# FASE 2 — Offline-first

- [x] **P0** Escrita local-first via IndexedDB/outbox.
- [x] **P0** React Query configurado para não bloquear mutações locais por estado de rede. Evidência: `fd8875`.
- [x] **P0** Reload/persistência local cobertos por testes e validação de app empacotado.
- [x] **P0** Service worker com limites explícitos de API/navegação/assets.
- [x] **P0** Bootstrap PWA corrigido de `process.env.NODE_ENV` para `import.meta.env.PROD`.
- [ ] **P0** Teste físico Android: criar/editar dados, force-stop e reabrir totalmente offline.
- [ ] **P1** Teste físico iPhone/iPad equivalente.

# FASE 3 — Sync e Neon/PostGIS

- [x] **P0** `/sync/push` e `/sync/pull`.
- [x] **P0** Capability de workspace, idempotência, predecessor, cursor incremental, tombstones e conflitos.
- [x] **P0** Materialização de project/map/layer/feature/import nas tabelas reais.
- [x] **P0** PostGIS e pgcrypto presentes em production.
- [x] **P0** Production possui tabelas de domínio/sync necessárias.
- [x] **P1** Bucket privado `geonexo-assets` criado.
- [ ] **P1** 🟡 Limpeza de drift preparada e validada em branch temporária Neon: remover FK SET NULL obsoleta e quatro índices redundantes. Production permanece inalterada até autorização explícita.
- [ ] **P0** Publicar/configurar a API Hono de production e ativar no app `VITE_API_MODE=live` + `VITE_API_URL`; revisar CORS/env.
- [ ] **P0** Executar smoke de sincronização real contra production com fixture descartável e limpar a fixture depois, somente com autorização explícita.
- [x] **P1** E2E automatizado com dois contextos/instalações isolados cobre capability/recovery, reconexão offline→online, retry, idempotência, pull e conflito. Evidência final: `e0bab0b` + baseline `cc2331d`.
- [ ] **P1** Confirmar fluxo entre dois dispositivos/instalações reais.

# FASE 4 — PWA

- [x] **P0** Manifest standalone e ícones normal/maskable.
- [x] **P0** Cold offline/app shell corrigidos. Evidência: `fd8875`.
- [x] **P0** UpdatePrompt com ativação controlada.
- [x] **P0** Validação automatizada de PWA: manifest/ícones/installability, service worker, app shell offline e migração IndexedDB preservando workspace, entidade e outbox. Evidência: `ad83ff2` e `8aed47d`.
- [x] **P1** Regressões PWA recentes corrigidas: bloqueio de zoom removido e `@vitejs/plugin-basic-ssl` restaurado no desenvolvimento.
- [ ] **P0** Validar instalação real em Android pelo navegador.
- [ ] **P1** Validar Add to Home Screen no Safari iOS.
- [ ] **P1** Registrar evidência de atualização de versão preservando IndexedDB/outbox em aparelho real.

# FASE 5 — GIS e GeoPDF

- [x] **P0** MapLibre + Terra Draw preservados como núcleo cartográfico.
- [x] **P0** GeoPDF oficial de Araguaína testado com georreferenciamento real. Evidência: `101d678`.
- [x] **P0** Importação de CRS projetado com reprojeção para WGS84 e suporte SIRGAS 2000 / UTM Brasil.
- [x] **P0** Auto-calibração offline de PDF/GeoPDF sem georreferenciamento válido implementada com confidence gate e fallback manual. Evidência: `7603e4b`, `ce2478e`, `02930a1`.
- [ ] **P1** Confirmar fluxo de calibração manual para PDF sem georreferenciamento válido.
- [ ] **P1** Teste de GeoPDF grande em aparelho físico com memória limitada.
- [ ] **P1** Validar exportação/round-trip dos formatos legados prioritários.

# FASE 6 — Android e iOS empacotados

- [x] **P0** Capacitor adotado sem reescrever React/Vite.
- [x] **P0** PWA definida como experiência instalável principal; Capacitor permanece como empacotamento Android/iOS.
- [x] **P0** Workflow Android gera debug APK e valida permissões de GPS.
- [x] **P0** Blank screen em WebView antigo corrigido. Evidência: `0c1839`.
- [x] **P0** GPS Android empacotado e permissões verificadas. Evidência: `d90e341`.
- [x] **P0** Android APK revalidado em `c1f86eb`.
- [x] **P1** Estrutura Capacitor iOS e workflow macOS revalidados.
- [x] **P1** iOS App verde em `b52ca6f`.
- [ ] **P1** Teste físico iOS.

# FASE 7 — Segurança, privacidade e distribuição

- [x] **P0** Banco não é acessado diretamente pelo navegador; fluxo permanece app → API → Neon.
- [x] **P0** Bucket remoto privado.
- [ ] **P0** ⏸ Política pública de privacidade: requisitos técnicos estão em `docs/privacy.md`, mas publicação depende de identidade/contato do controlador, finalidades/bases legais, retenção/exclusão, provedores/regiões, canal do titular e revisão jurídica.
- [x] **P0** Rate limit/abuse protection corrigido em `workspace/provision|recover` com limiter distribuído e controle concorrente.
- [x] **P0** Storage remoto corrigido: capability, prefixo por `workspaceId`, proteção contra path traversal e fail-closed sem S3.
- [x] **P0** Rotas diretas `projects/layers/features` permanecem desabilitadas em production, preservando o caminho por sync.
- [x] **P0** `PATCH /features/:id` com schema, optimistic concurrency e tratamento tipado fora de production.
- [ ] **P1** Definir assinatura/release Android para distribuição.
- [ ] **P1** Definir signing/provisioning iOS para distribuição.
- [ ] **P1** 🟡 Deploy web:
  - [x] site `markmap.mtsferreira.dev` publicado e validado via Vercel + Cloudflare;
  - [x] app `appmarkmap.mtsferreira.dev` associado/verificado na Vercel; Cloudflare DNS-only atualizado para o alvo recomendado pela Vercel `b1fa89794ccd409d.vercel-dns-017.com`; HTTPS validado externamente;
  - [x] confirmado que `appmarkmap.mtferreira.dev` (sem `s`) não é o domínio configurado e não pertence à zona Cloudflare ativa; usar sempre `appmarkmap.mtsferreira.dev`;
  - [x] app fallback `markmap-app.vercel.app` validado;
  - [ ] API/sync remoto de production ainda não publicado/configurado.
- [ ] **P1** Release notes e versão candidata.
- [ ] **P2** Processo operacional pós-distribuição depende do ambiente real; runbook em `docs/release-runbook.md`.

# Backlog transversal

- [x] Cliente HTTP legado auditado; operação principal é IndexedDB + `/sync/*`.
- [x] Textos/documentação obsoletos de backend/sync/GIS revisados em `cc2331d`.
- [x] Lighthouse/a11y, dependency audit e secret scan adicionados e verdes na baseline final.
- [x] `docs/release-checklist.md`, Handoff, status, GIS, segurança, privacidade e deployment sincronizados na consolidação anterior.
- [x] Runbook de release/rollback preparado em `docs/release-runbook.md`.
- [x] Checklist Mestre versionado no repositório em `docs/master-checklist.md`.
- [ ] Atualizar ADR quando decisão arquitetural vigente for substituída.
- [ ] Atualizar `THIRD_PARTY_NOTICES.md` e inventário ao incorporar código/biblioteca.
- [ ] Não adicionar dependência sem necessidade comprovada.
- [ ] Não executar migration destrutiva, publicação, release/tag, rotação de secrets ou force push sem autorização explícita.

# Próximo item livre

**Não há P0 funcional interno conhecido aberto além da preparação do ambiente remoto de produção.**

Próximos passos:

1. publicar/configurar a API Hono de production;
2. configurar `VITE_API_MODE=live`, `VITE_API_URL` e CORS;
3. autorizar e executar smoke de sync contra production;
4. testes físicos Android/iOS e instalação PWA real;
5. fechar política pública de privacidade;
6. definir versão/release notes e signing mobile;
7. autorizar publicação/release quando os gates estiverem verdes.

# Regra para novas conversas/agentes

1. Ler a Fonte Principal do projeto.
2. Ler `docs/master-checklist.md`, `docs/handoff.md` e `docs/README.md` no HEAD atual.
3. Consultar o Checklist Mestre no Notion.
4. Verificar HEAD, PRs e tarefas/agentes em andamento.
5. Não duplicar trabalho.
6. Continuar pelo próximo item livre.
7. Ao mudar estado relevante, atualizar **Notion + `docs/master-checklist.md` + `docs/handoff.md`**.
