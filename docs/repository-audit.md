# Auditoria e limpeza do repositório

Data: 2026-10-03.

## Estado encontrado

Antes desta revisão, o repositório já havia recebido commits de limpeza que removeram pastas/configurações de agentes e materiais históricos. O HEAD auditado mantinha apenas `main`.

A documentação recém-criada em `docs/` continha vários placeholders de ~50 bytes e o README principal possuía afirmações não comprovadas ou desatualizadas.

## Classificação

### FUNCIONA

- estrutura monorepo pnpm/Turbo;
- apps/admin;
- services/api;
- packages compartilhados;
- workflows de CI/build/E2E/PostGIS/mobile;
- documentação legal de terceiros.

### PARCIAL

- documentação anterior: existia estrutura, faltava conteúdo real;
- README anterior: completo em volume, mas misturava estado real e funcionalidades planejadas;
- `neon.ts`: arquivo mínimo de configuração; mantido por cautela enquanto dependências `@neon/config`/`@neon/env` permanecem no lockfile/package.

### QUEBRADO/OBSOLETO

- `.e2e/README.md`: descrevia comandos `pnpm e2e`/`pnpm e2e:ci` que não existem no package raiz;
- `.github/workflows/branch-hygiene.yml`: workflow específico para apagar três branches já inexistentes; sem função recorrente geral.

### NÃO IMPLEMENTADO

Itens de produto não foram “limpos” como lixo quando representam backlog real. Eles estão registrados em `status.md`.

## Remoções desta auditoria

- `.e2e/README.md`;
- `.github/workflows/branch-hygiene.yml`.

## Preservado intencionalmente

- migrations e histórico técnico necessário à evolução do schema;
- testes;
- workflows de build;
- `THIRD_PARTY_NOTICES.md`;
- projeto iOS versionado;
- arquivos de configuração necessários ao build;
- `neon.ts` até remoção coordenada com dependências e lockfile.

## Regra futura de higiene

Um arquivo só deve ser removido quando houver evidência de que:

1. não é referenciado por build/runtime/CI;
2. não é necessário para licença/compliance;
3. não representa migration/histórico operacional necessário;
4. não contém decisão arquitetural vigente;
5. a remoção não exige atualização de lockfile/configuração sem validação.


## Revisão A71 — 2026-10-13

- GitHub HEAD auditado: as 6 branches históricas (`agent/MM-MAP-200-pwa-regions`, `agent/MM-MAP-300-400-pwa-integration`, `agent/MM-MAP-310-420-offline-packages`, `agent/MM-MAP-600-640-offline-routing`, `dev/markmap-pwa-v2`, `feat/maps-engine-v2-offline`) possuem 0 commits exclusivos em relação à main, 0 PR aberto; podem ser excluídas com proteção à `main`. O conector GitHub disponível **não oferece API de apagar branch**; a exclusão ainda não ocorreu.
- `REPOSITORIOS MODELOS/` consta em `.gitignore` e **não aparece na árvore versionada**; nenhuma pasta/modelo externo foi apagado.
- O arquivo `.eslintignore` continha apenas `dist`, já ignorado no `apps/admin/eslint.config.js` (ESLint 9 flat config) e no `.gitignore`. Foi removido como item comprovadamente redundante.
- Preservados integralmente migrations, PDFs de testes, licenças, scripts de pipeline, ADRs e handoffs, ainda que históricos. Não remover sem evidência de não uso.
