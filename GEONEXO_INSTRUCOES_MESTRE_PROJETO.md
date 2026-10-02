# GeoNexo — Instruções-Mestre do Projeto

**Status:** [BASELINE]  
**Atualizado:** 2026-10-01  
**Repositório:** `mmatteuus/GeoNexo`

**Checklist Mestre no Notion:** https://app.notion.com/p/3ed8e0bd0f4d81b6832bcf848c0ab504?pvs=204

## 1. Identidade

**Missão:** oferecer mapeamento de campo confiável, simples e offline-first, com sincronização posterior e recursos GIS adequados ao contexto brasileiro.

**Objetivo atual:** consolidar o GeoNexo como Release Candidate para Web/PWA, Android e iOS empacotados, sem sacrificar o uso offline.

**Usuário principal:** pessoa em campo usando celular/tablet, inclusive sem conectividade contínua.

**Superfícies:**
- Web/PWA: `apps/admin`;
- Android/iOS: mesmo núcleo React/Vite empacotado com Capacitor;
- API: `services/api`;
- banco/sync: Neon PostgreSQL + PostGIS;
- armazenamento remoto: bucket privado para assets sincronizados.

## 2. Arquitetura vigente

### [DECIDIDO] Frontend
- React 18 + Vite + TypeScript.
- TanStack Query/Router.
- MapLibre GL + Terra Draw.
- IndexedDB/local repository para estado operacional offline.
- PDF.js para PDF/GeoPDF.
- Proj4 para transformações de CRS.

### [DECIDIDO] Backend
- Hono.
- Contratos compartilhados via Zod em `packages/contracts`.
- API HTTP com endpoints de domínio e sincronização.

### [DECIDIDO] Banco
- Neon PostgreSQL + PostGIS.
- SRID canônico de persistência espacial: EPSG:4674 / SIRGAS 2000.
- Navegador não recebe URL privilegiada do banco.

### [DECIDIDO] Offline e sync
- Local-first: a escrita válida primeiro é local.
- IndexedDB + outbox representam trabalho ainda não sincronizado.
- Rede disponível dispara push/pull.
- Sync deve ser idempotente, versionado, incremental e isolado por workspace.
- Neon é sincronização/backup, não requisito para continuar trabalhando em campo.

### [DECIDIDO] Mobile
- Núcleo Web compartilhado.
- Capacitor para Android/iOS.
- Plugins nativos apenas quando uma capacidade realmente exigir integração nativa.

### [BASELINE] Android
- Workflow de APK existe.
- GPS/permissões nativas e correção de WebView antigo já possuem implementação e evidência em commits anteriores.
- Revalidar sempre no HEAD atual antes de publicar.

### [BASELINE] iOS
- Estrutura Capacitor e workflow macOS foram adicionados no HEAD observado `ea2e1dd`.
- Build/artefato do HEAD precisa de revalidação antes de release.

### [DECIDIDO] Storage
- Metadados e geometrias: banco.
- Arquivos pesados: armazenamento local adequado no dispositivo; remoto em object storage quando sincronizados.
- Não armazenar GeoPDF/fotos/PMTiles grandes como BLOB principal em tabelas de domínio.

### [PENDENTE]
- domínio/deploy Web de produção;
- signing/release Android;
- signing/provisioning iOS;
- política pública de privacidade;
- testes físicos finais de PWA/iOS e release candidate.

## 3. Princípios técnicos

1. **Offline-first real.** A ação local não depende da API.
2. **Uma fonte de contrato.** Tipos compartilhados ficam em `packages/contracts`.
3. **Sem duplicação arquitetural.** Não criar segunda camada offline, GIS, sync ou PWA.
4. **Idempotência.** Retry não pode duplicar alteração.
5. **Isolamento por workspace.** Toda operação sincronizada respeita escopo.
6. **Conflitos explícitos.** Nunca sobrescrever silenciosamente.
7. **Segurança por padrão.** Sem secrets no cliente/logs/docs.
8. **Compatibilidade.** Mudança de storage, sync ou formato precisa considerar versões já instaladas.
9. **Rollback.** Mudanças estruturais precisam ter caminho de reversão/mitigação.
10. **Evidência.** Não afirmar teste, build ou comportamento não executado.
11. **Performance medida.** Não trocar stack por hipótese.
12. **Documentação acompanha a mudança.**

## 4. Hierarquia de fontes de verdade

1. pedido explícito mais recente do responsável;
2. decisão arquitetural vigente e aprovada;
3. segurança e integridade dos dados;
4. critérios de aceite/PRD atual;
5. código/configuração realmente em uso no HEAD;
6. banco/infraestrutura realmente observados;
7. ADRs e documentação vigente;
8. Checklist Mestre no Notion;
9. Handoff;
10. hipótese.

Se houver conflito, validar a evidência mais recente. Não preservar documentação antiga como verdade apenas por existir.

## 5. Ações que exigem autorização explícita

- deploy público/produção;
- publicação em loja;
- release/tag oficial;
- migration remota destrutiva;
- DROP/TRUNCATE/DELETE em dados reais;
- rotação de secrets/credenciais;
- mudança de permissões de produção;
- criação de custo recorrente relevante;
- force push/reset destrutivo;
- apagar trabalho de outro agente.

Criação de documentação, testes, branches temporárias e correções reversíveis podem ser executadas quando fizerem parte da tarefa autorizada.

## 6. Definition of Ready

Uma feature/bug está pronta para implementação quando:
- problema/objetivo está definido;
- estado atual foi auditado;
- arquivos/áreas afetadas são conhecidos;
- critérios de aceite existem;
- riscos de dados/API/storage estão identificados;
- ações irreversíveis foram separadas;
- não há outro agente fazendo a mesma alteração.

Para banco/API/segurança, incluir teste/migração/rollback esperados.

## 7. Definition of Done

Conforme aplicável:

- [ ] implementação concluída;
- [ ] lint relevante passa;
- [ ] typecheck passa;
- [ ] unit/integration tests passam;
- [ ] build passa;
- [ ] E2E relevante passa;
- [ ] diff revisado;
- [ ] documentação atualizada;
- [ ] contratos/API atualizados;
- [ ] sem secrets/PII indevidos;
- [ ] rollback/compatibilidade considerados;
- [ ] evidência registrada;
- [ ] Checklist Mestre/Handoff atualizados quando o estado do projeto mudou.

## 8. PRD obrigatório para delegação

Antes de entregar implementação relevante a outro agente, produzir um PRD Markdown com:

1. objetivo;
2. contexto;
3. escopo;
4. fora do escopo;
5. arquivos/áreas esperadas;
6. regras de negócio;
7. segurança;
8. critérios de aceite;
9. testes;
10. QA;
11. documentação;
12. Git;
13. ações proibidas;
14. riscos;
15. convivência com outros agentes;
16. relatório final;
17. prompt pronto para o executor.

## 9. Regras de Git

Antes de editar localmente:

```bash
git status
git branch --show-current
```

Quando seguro:

```bash
git pull --ff-only
```

Sem autorização:
- não usar `reset --hard`;
- não usar force push;
- não apagar alteração alheia;
- não fazer rebase destrutivo.

Commits devem agrupar alterações coerentes e evitar desperdício de GitHub Actions.

## 10. Regras para agentes paralelos

- verificar HEAD/branch e tarefas em andamento;
- verificar arquivos compartilhados;
- não duplicar tarefa;
- não sobrescrever alterações sem revisar diff;
- após conflito, repetir testes afetados;
- não declarar concluído sem evidência.

## 11. Formato de resposta do agente

Responder tecnicamente de forma curta:

```text
RESULTADO
ALTERAÇÕES
VALIDAÇÃO
RISCOS/PENDÊNCIAS
PRÓXIMO PASSO
```

## 12. Referências obrigatórias

Para nova conversa:
1. `GEONEXO_HANDOFF_CONTINUIDADE.md`;
2. este arquivo;
3. Checklist Mestre no Notion;
4. PRD vigente;
5. código/HEAD atual.
