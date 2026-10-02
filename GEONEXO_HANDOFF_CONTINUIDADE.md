# GeoNexo — Handoff de Continuidade

**Atualizado:** 2026-10-01  
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

**Fase atual:** estabilização de Release Candidate e validação dos pacotes mobile.

**HEAD observado durante este handoff:** `ea2e1dd`.

### Concluído com evidência anterior
- arquitetura local-first com IndexedDB/outbox;
- sync push/pull, cursor, retry, idempotência e conflitos;
- materialização de domínio no PostGIS;
- Neon production com tabelas de domínio/sync, PostGIS e pgcrypto;
- bucket privado `geonexo-assets`;
- PWA/offline corrigidos em iterações anteriores;
- Playwright mobile adicionado;
- Android Capacitor/APK, GPS e compatibilidade de WebView validados em commits anteriores;
- GeoPDF real de Araguaína e CRS projetado validados;
- estrutura Capacitor iOS + workflow macOS presente no HEAD observado.

### Evidências recentes relevantes
- `fd8875`: offline/PWA/mobile + Playwright mobile.
- `d90e341`: GPS Android + integração PostGIS serializada.
- `0c1839d`: correção de blank screen em WebView antigo.
- `08073ad`: testes de sync/reconnect/retry/conflict.
- `101d678`: GeoPDF real, CRS e UX.
- `ea2e1dd`: estrutura iOS/workflow.

## 3. Banco observado

Neon project: `GEONEXO`  
Default branch: `production`  
Database: `neondb`

Observado em 2026-10-01:
- `postgis` presente;
- `pgcrypto` presente;
- tabelas: `projects`, `maps`, `layers`, `features`, `map_sources`, `imports`, `audit_events`, `workspaces`, `sync_entities`, `sync_operations`, `sync_tombstones`, `upload_sessions`;
- bucket privado: `geonexo-assets`;
- banco sem dados de domínio no momento da inspeção: 0 workspaces/projetos/layers/features/sync_operations.

Não registrar secrets ou connection strings neste arquivo.

## 4. Em andamento / próximo item livre

**Próximo item livre P0:** revalidar todos os gates do HEAD atual:
- CI;
- Build;
- E2E;
- PostGIS Integration;
- Android APK;
- iOS App.

Depois:
1. teste físico Android offline/GPS/GeoPDF;
2. teste entre duas instalações para sync/conflict;
3. validar PWA instalada no navegador;
4. fechar política de privacidade e distribuição;
5. release candidate.

## 5. Bloqueios / pendências externas

- [PENDENTE] assinatura/publicação Android;
- [PENDENTE] signing/provisioning e publicação iOS;
- [PENDENTE] domínio/deploy Web de produção;
- [PENDENTE] política pública de privacidade;
- [PENDENTE] testes físicos finais em dispositivos não disponíveis ao agente.

## 6. Regras de agentes paralelos

- checar branch/HEAD antes de editar;
- checar Checklist Mestre;
- não duplicar tarefa já em andamento;
- não sobrescrever trabalho de outro agente;
- revisar diff antes de integrar;
- repetir testes depois de resolver conflito;
- atualizar este Handoff se fase, bloqueio ou próximo passo mudar.

## 7. QA

Para tarefa relevante:
- executar a skill de QA específica se houver;
- registrar comandos/resultado;
- se falhar, corrigir e repetir;
- não considerar concluído enquanto gate obrigatório estiver vermelho;
- não inferir teste físico a partir de emulação.

## 8. Prompt mínimo para novo chat

```text
Leia primeiro GEONEXO_HANDOFF_CONTINUIDADE.md e GEONEXO_INSTRUCOES_MESTRE_PROJETO.md nas Fontes do Projeto. Depois consulte “GeoNexo — Checklist Mestre de Execução” no Notion, verifique o HEAD atual e tarefas em andamento, e continue pelo próximo item livre. Não duplique trabalho. Responda curto e direto.
```

## 9. Quando atualizar este arquivo

Atualize quando:
- uma fase terminar;
- nova tarefa for atribuída;
- um PRD relevante for criado;
- tarefa crítica concluir;
- surgir bloqueio;
- decisão arquitetural mudar;
- próximo item livre mudar.

Não transformar este arquivo em histórico infinito. Manter apenas o snapshot necessário para continuidade.
