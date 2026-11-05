# PRD A211 — Corrigir lint da rota marketplace da API

## Objetivo
Eliminar erros de lint reproduzidos no CI da API sem alterar respostas, rotas ou fontes de dados.

## Contexto / fonte
- Em 2026-11-03, PR #107 SHA 81209ca143305a2c8ef0857e35b05193bd0ff377, job 126214082792, `api#lint` apresentou 18 errors e 29 warnings.
- Todos os 18 errors pertencem a `services/api/src/routes/marketplace.ts`; warning `any` preexistente fica fora do escopo.
- Base `main@92dfbffa77d4707820ef9124e97d7b6cf066e260`, arquivo original blob `ae31c6948b8e45c4330c9e67d709bcd2b65f5d46`. PRs #104, #105, #106, #107 não alteram este arquivo.

## Escopo
- Ordenar imports.
- Remover `uuidSchema` e `marketplaceItemSchema` não utilizados.
- Aplicar estilo Prettier.
- Tratar explicitamente região definida e não vazia, mantendo comparação case-insensitive e sem filtro quando vazia.

## Fora do escopo
- Não alterar catálogo, URLs, hashes, rotas, versão, frontend, PWA, SW, IndexedDB, outbox, Neon/PostGIS, workflow ou lockfile.
- Vulnerabilidades de produção, E2E e release guard serão tratados separadamente.

## Arquivos afetados
- `services/api/src/routes/marketplace.ts`
- Este PRD `docs/PRD-CI-API-MARKETPLACE-LINT-A211-20261103.md`

## Regras de negócio e arquitetura
As rotas `GET /marketplace/layers`, `GET /marketplace/layers/:id`, `POST /marketplace/layers/:id/download-ticket`, payloads, catálogo e paginação permanecem idênticos. O filtro de região deve ignorar `undefined` ou string vazia e comparar sem distinguir maiúsculas.

## Segurança
Nenhuma leitura/escrita de banco, secrets, credenciais, dados locais, bypass de checks ou lançamento de URL será acrescentada. Manter isolamento de workspace e operação offline vigentes.

## Critérios de aceite
1. CI `Lint` em runner real = success para o SHA da PR.
2. `Typecheck`, `Unit Tests` e `Build all packages` mantêm sucesso nesse SHA.
3. Diff limitado à rota e este PRD; sem regressão de retorno, filtro e erros 404.
4. A PR permanece Draft e não é classificada como release enquanto existirem gates vermelhos.

## Testes, QA e evidência
- Localmente: verificar diff, imports, sintaxe e, se houver dependências disponíveis, `pnpm --filter api lint`, `pnpm --filter api typecheck`, `pnpm --filter api test`.
- Em GitHub Actions: conferir logs dos checks acima na PR, não presumir sucesso por criação de PR.
- Inspecionar ainda `pnpm audit --prod`, E2E e version policy como falhas independentes.

## Documentação / Git
Branch exclusiva `fix/ci-api-marketplace-lint-20261103`, baseada em `92dfbffa77d4707820ef9124e97d7b6cf066e260`. Um commit mínimo, PR Draft; não editar PRs #104–#107. Registrar resultado e estado real no Obsidian, Notion e issue #45. Preservar SHA de origem e revisar diff antes de integrar.

## Ações proibidas
Sem merge, deploy/release/tag, incremento de versão não reservado, alteração CI para ignorar erro, force push, limpeza de caches/dados, migração ou mudança de billing.

## Riscos / rollback
Warnings `any` continuam como débito técnico; o catálogo mockado e seus dados NÃO foram auditados funcionalmente. Reversão segura: rejeitar a PR Draft ou reverter o commit antes de eventual merge autorizado.

## Convivência com agentes paralelos
Nenhuma sobreposição de arquivos detectada nas PRs #104–#107 na consulta. Reconfirmar HEAD e diffs imediatamente antes de qualquer integração; versão 0.5.22 reservada na #104 permanece intocada.

## Relatório final esperado
RESULTADO; ALTERAÇÕES; VALIDAÇÃO PASS/FAIL/NÃO EXECUTADO por SHA; RISCOS/PENDÊNCIAS; PRÓXIMO PASSO; MEMÓRIA Obsidian/Notion/GitHub verificada.

## Prompt para executor de QA
"No MarkMap, leia Obsidian + Checklist Mestre Notion e confira o HEAD GitHub; valide a correção isolada de lint do marketplace sem alterar o catálogo nem a versão. Execute lint, typecheck e testes da API se houver ambiente, confira CI real da PR, registre cada evidência no cérebro e mantenha PR Draft sem merge/deploy."
