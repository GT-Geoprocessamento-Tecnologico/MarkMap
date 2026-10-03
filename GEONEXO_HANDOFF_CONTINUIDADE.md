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

**Fase atual:** MVP instalável em validação de campo.

**Integração:** PR #2 foi auditado, teve todos os checks do PR verdes e foi incorporado em `main`.

### Concluído com evidência

- arquitetura local-first com IndexedDB/outbox;
- sync push/pull, cursor, retry, idempotência, tombstones e conflitos;
- materialização de project/map/layer/feature/import no PostGIS;
- PWA/Vite corrigida para `import.meta.env.PROD`;
- MapLibre + desenho/coleta local;
- GPS web/nativo com permissão Capacitor;
- PostGIS Integration verde;
- Android debug APK gerado com permissões GPS verificadas;
- iOS debug package gerado com GPS/SwiftPM corrigidos;
- Playwright desktop + Android mobile + iOS mobile automatizado;
- GeoPDF real de Araguaína e CRS projetado validados;
- README, governança e higiene do repositório alinhados;
- PRs abertos zerados após a consolidação.

### Correções da auditoria final

- formatação do schema de workspace;
- teste PostGIS de ordenação tornado determinístico;
- remoção de log de coordenada GPS precisa;
- estado de permissão GPS corrigido;
- pipeline iOS ajustado para usar o scheme App;
- SwiftPM iOS corrigido para usar um único DerivedData, sem fragmentar produtos por `SYMROOT`.

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
- banco sem dados de domínio/sync no momento da inspeção;
- nenhuma query longa ou lock mantido durante a auditoria.

### Drift pendente em production

A migration versionada `0002_sync_schema_cleanup.sql` foi preparada/validada para:
- trocar a FK antiga de imports;
- remover quatro índices redundantes.

**Production não foi alterada.** Aplicar a limpeza exige autorização explícita separada.

## 4. Próximo item livre

1. instalar o APK Android em aparelho físico;
2. validar mapa + GPS + criação local;
3. desligar internet, fechar/force-stop e reabrir;
4. registrar bugs reais encontrados em campo e corrigir por atualizações incrementais;
5. depois avançar calibração automática de GeoPDF;
6. validar duas instalações/sync;
7. fechar privacidade/signing/distribuição.

## 5. Pendências técnicas

- teste físico Android;
- teste físico iOS;
- calibração automática de PDF/GeoPDF sem georreferenciamento válido;
- rate limiting/abuse protection distribuído para workspace provision/recover;
- upload/download remoto autorizado por workspace;
- GeoPDF grande em dispositivo limitado;
- round-trip de formatos GIS legados prioritários;
- política pública de privacidade;
- signing/provisioning e deploy público.

## 6. Regras

- `main` é a única linha de desenvolvimento que deve permanecer após a consolidação atual;
- não reabrir branches antigas;
- não executar migration destrutiva, deploy público ou publicação sem autorização;
- não declarar teste físico aprovado com base em CI/emulação;
- atualizar este Handoff e o Checklist Mestre quando o estado mudar.

## 7. QA

Para qualquer alteração relevante:
- lint;
- typecheck;
- unit/integration;
- build;
- E2E relevante;
- pacote mobile quando a mudança afetar mobile.

Nunca registrar PASS sem evidência do commit correspondente.
