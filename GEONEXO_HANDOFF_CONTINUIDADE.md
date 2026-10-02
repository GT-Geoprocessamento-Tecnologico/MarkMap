# GeoNexo — Handoff de Continuidade

**Atualizado:** 2026-10-02  
**Objetivo:** permitir que uma nova conversa continue o projeto sem depender do chat anterior.

**Checklist Mestre no Notion:** https://app.notion.com/p/3ed8e0bd0f4d81b6832bcf848c0ab504?pvs=204

## 1. Regra de início

Toda nova conversa sobre GeoNexo deve:

1. ler este Handoff;
2. ler `GEONEXO_INSTRUCOES_MESTRE_PROJETO.md`;
3. consultar **GeoNexo — Checklist Mestre de Execução** no Notion;
4. verificar o HEAD atual do GitHub;
5. verificar tarefas/agentes em andamento;
6. ler o PRD diretamente relacionado;
7. evitar duplicação;
8. continuar pelo próximo item livre.

## 2. Snapshot atual

**Fase atual:** auditoria de release-readiness e validação Web/PWA + Android + iOS.

**Main observado:** `3d21e1c`.

**Trabalho em andamento:** PR #2 — `fix(audit): alinhar PWA e drift de schema para release`, branch `audit/release-readiness-2026-10-02`.

### Concluído com evidência

- arquitetura local-first com IndexedDB/outbox;
- sync push/pull, cursor, retry, idempotência, tombstones e conflitos;
- materialização de project/map/layer/feature/import no PostGIS;
- PostGIS Integration verde no PR de auditoria;
- Neon production com tabelas de domínio/sync, PostGIS e pgcrypto;
- bucket privado `geonexo-assets`;
- Playwright desktop/mobile automatizado;
- GeoPDF real de Araguaína e CRS projetado validados;
- Capacitor Android/iOS e workflows de empacotamento presentes;
- correção do bootstrap PWA para `import.meta.env.PROD` preparada no PR #2;
- README e artefatos acidentais/stale corrigidos no PR #2.

### QA do PR #2

No head anterior do PR, passaram:
- Lint;
- Typecheck;
- Unit Tests;
- Build;
- Playwright E2E;
- Playwright iOS mobile emulation;
- Offline sync → PostGIS → pull.

No head mais recente, os checks foram reiniciados após as correções finais; consultar o PR antes de afirmar o estado final.

Android APK e iOS App não rodam em `pull_request` atualmente. Precisam ser validados no main resultante ou via `workflow_dispatch`.

## 3. Banco observado

Neon project: `GEONEXO`  
Default branch: `production`  
Database: `neondb`

Observado em 2026-10-02:
- PostgreSQL 18;
- PostGIS 3.6.4;
- pgcrypto 1.4;
- tabelas de domínio e sync presentes;
- bucket privado `geonexo-assets`;
- 0 workspaces/projects/maps/layers/features/imports/sync rows no momento da inspeção;
- nenhuma query acima de cinco minutos;
- nenhum lock mantido durante a auditoria.

### Drift ainda pendente em production

- FK antiga `imports_target_layer_id_fkey` usa `ON DELETE SET NULL` enquanto a versão atual espera CASCADE;
- quatro índices redundantes coexistem com UNIQUE/PK equivalentes.

Migration versionada `0002_sync_schema_cleanup.sql` foi preparada e validada na branch temporária Neon `br-mute-unit-b4nkmmlb`.

**Production não foi alterada.** Aplicar essa limpeza exige autorização explícita.

Existe também a branch temporária antiga `br-icy-pine-b4o2yjh0`. Não excluir branch Neon sem autorização explícita.

## 4. Próximo item livre

1. concluir revalidação dos checks do PR #2;
2. revisar/aprovar integração do PR #2 em main;
3. revalidar Android APK e iOS App no HEAD resultante;
4. testes físicos Android/iOS;
5. smoke real de sync entre duas instalações;
6. política de privacidade, signing/provisioning e deploy público;
7. Release Candidate.

## 5. Pendências técnicas importantes

- rate limiting/abuse protection distribuído para `workspace/provision` e `workspace/recover`;
- upload/download remoto autorizado por workspace; presign continua intencionalmente 503;
- GeoPDF manual calibration E2E/físico;
- GeoPDF grande em dispositivo limitado;
- round-trip de formatos GIS legados prioritários;
- atualização PWA real preservando IndexedDB/outbox.

## 6. Bloqueios / decisões externas

- migration cleanup de production precisa de autorização;
- merge do PR #2 depende de revisão/decisão;
- assinatura/publicação Android;
- signing/provisioning/publicação iOS;
- domínio/deploy Web;
- política pública de privacidade;
- testes físicos finais.

## 7. Regras de agentes paralelos

- checar branch/HEAD antes de editar;
- checar Checklist Mestre;
- não duplicar tarefa já em andamento;
- não sobrescrever trabalho de outro agente;
- revisar diff antes de integrar;
- repetir testes depois de resolver conflito;
- atualizar este Handoff se fase, bloqueio ou próximo passo mudar.

## 8. QA

- registrar comandos/resultados;
- se falhar, corrigir e repetir;
- não considerar concluído com gate obrigatório vermelho;
- não inferir teste físico a partir de emulação;
- distinguir claramente evidência do main de evidência existente apenas no PR.

## 9. Prompt mínimo para novo chat

```text
Leia primeiro GEONEXO_FONTE_CHATGPT.md nas Fontes do Projeto. Depois consulte “GeoNexo — Checklist Mestre de Execução” no Notion, verifique main, PRs/tarefas em andamento e continue pelo próximo item livre. Não duplique trabalho. Responda curto e direto.
```
