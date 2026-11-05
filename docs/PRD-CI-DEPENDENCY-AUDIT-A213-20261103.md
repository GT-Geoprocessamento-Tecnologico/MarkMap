# PRD A213 — Corrigir dependências com vulnerabilidades high (CI)

## Objetivo
Remover as vulnerabilidades **high** de Zod 4.6.5 e Seroval 1.6.7 detectadas por `pnpm audit --prod --audit-level=high`, sem contornar o scanner ou alterar contratos do MarkMap.

## Contexto e estado real
- Repo `mmatteuus/MarkMap`, base `main@92dfbffa77d4707820ef9124e97d7b6cf066e260`.
- [Dependency audit PR #108](https://github.com/mmatteuus/MarkMap/actions/runs/41755781873/job/126331433610): 9 avisos de produção (5 high e 4 moderate); 5 high referem-se a `zod@4.6.5` ou `seroval@1.6.7`.
- Origem de Zod 4.x: `@neon/config@1.8.2`/`@neon/env@1.4.7`; origem de Seroval: `@tanstack/router-core@1.171.33` via `@tanstack/react-router@1.170.40`.
- Patches oficiais: `zod@4.6.6` [GHSA-mrhx-c7xc-m3w5](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5); `seroval@1.6.8` [GHSA-97r2-qh9m-474h](https://github.com/advisories/GHSA-97r2-qh9m-474h).
- Zod 3.25.76 e usado como contrato dos workspaces; **não migrar** contratos para Zod 4 neste trabalho.

## Auditoria e classificação
- Scanner CI: QUEBRADO (exit 1 por high).
- Resolução transitiva: PARCIAL, instalações funcionam mas versões vulneráveis são pinadas no lock.
- Lint API: correção PASS em PR #108 independente; SW harness PASS em PR #107 independente. Não juntar neste PR.

## Escopo
1. Em `package.json`, `pnpm.overrides`: `seroval: 1.6.8` e seletivo `zod@4.6.5: 4.6.6`.
2. Em `pnpm-lock.yaml`, atualizar versões, snapshots e integridades `sha512` dos pacotes corrigidos, sem modificar `zod@3.25.76`.
3. Não atualizar `seroval-plugins@1.6.7` sem exigência técnica: seu peer `seroval: ^1.0` permanece compatível com 1.6.8; atualizar apenas o sufixo de resolução do peer.
4. Documentar evidências e executar QA no runner real do SHA da PR.

## Fora do escopo
Sem atualização geral dos 930 pacotes, dependências de desenvolvimento, mudança de TanStack, contratos Zod 3, API, banco, IndexedDB, SW, PWA, Capacitor, versão publicada ou workflows. Os 4 avisos **moderate** ficam para auditoria separada; não afirmar zero vulnerabilidades totais.

## Arquivos afetados
- `package.json`
- `pnpm-lock.yaml`
- `docs/PRD-CI-DEPENDENCY-AUDIT-A213-20261103.md`

## Regras de negócio, segurança e arquitetura
Preservar offline-first, fontes locais IndexedDB/outbox, identidade/workspace, API Hono e contratos Zod 3. Hashes de lock são referências públicas de integridade, sem secrets. Não remover `pnpm audit`, não usar `--no-frozen-lockfile` no CI e não adicionar `auditConfig.ignore`.

## Critérios de aceite
1. `pnpm install --frozen-lockfile` PASS no runner real do HEAD.
2. `pnpm audit --prod --audit-level=high` EXIT 0 e nenhum high; os moderate devem ser relatados.
3. Build, Unit Tests, Typecheck, Lint, SW/Playwright e PostGIS reportados individualmente, distinguindo defeitos preexistentes em PRs independentes.
4. Diff limitado aos 3 arquivos; `zod@3.25.76` preservado, nenhuma alteração de secrets, banco ou código funcional.
5. PR Draft, sem merge/release/deploy enquanto gates de release restantes falharem.

## Testes e QA
- Ambiente completo: `pnpm install --frozen-lockfile`, `pnpm why zod seroval`, `pnpm audit --prod --audit-level=high`, `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` e E2E aplicáveis.
- Revisar logs do GitHub Actions no SHA exato; se o lock não coincidir com pnpm 9.15.9, relock via `pnpm install --lockfile-only` usando registry oficial e restaurar apenas este diff.
- Testes de PWA instalada/offline e Android/iOS físicos permanecem necessários no candidato integrado.

## Git / coordenação
- Branch exclusiva `fix/ci-dependency-audit-20261103` sobre `92dfbffa77d4707820ef9124e97d7b6cf066e260`. Não tocar branches/PRs #104–#108; conferir HEAD, diff e ausência de conflitos antes de integrar.
- Versão 0.5.22 pertence à PR #104; não mudar versão unilateralmente.
- Registrar resultados no Obsidian (Handoff/Checklist/Diário/CI), Notion Checklist Mestre e issue #45 após evidência.

## Ações proibidas
Sem merge, deploy, release/tag, force push, ignorar scanner, desativar CI, modificar billing, migrar banco, apagar caches/IndexedDB/outbox, renomear storage ou expor secrets.

## Riscos e rollback
- Um override pode afetar comportamento do validador/deserializador; testar API, frontend e sync.
- Quatro avisos moderate permanecem, verificados como distintos do gate high. Não rotular "audit limpo".
- Se CI falhar em instalação/hash, manter PR Draft e corrigir lock mediante pnpm oficial, sem desligar integridade.
- Rollback: fechar/reverter PR isolada antes de qualquer merge.

## Relatório esperado
RESULTADO; ALTERAÇÕES; VALIDAÇÃO por job/SHA PASS/FAIL/NÃO EXECUTADO; RISCOS/PENDÊNCIAS; PRÓXIMO PASSO; MEMÓRIA sincronizada.

## Prompt para executor
"Leia Obsidian, Notion e HEAD do MarkMap; confira PRs paralelas. No escopo isolado de dependency audit, valide overrides Zod 4.6.6/Seroval 1.6.8 e lockfile mantendo Zod 3.25.76. Execute pnpm frozen install, audit high e QA com logs no SHA. Não altere gates, versão, produção nem dados locais. Registre evidências completas e mantenha PR Draft."
