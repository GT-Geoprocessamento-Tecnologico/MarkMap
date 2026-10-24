# MarkMap - A48/A49: identidade e credenciais de sync transacionais

## Objetivo e contexto
Eliminar disputas entre abas PWA ao inicializar a identidade remota e ao salvar a credencial de sincronizacao. Base verificada: `dev/markmap-pwa-v2@cea8e86` e Checklist Mestre do Notion em 2026-10-12. Preservar React/Vite, Hono, contratos existentes e IndexedDB como fonte offline.

## Auditoria antes de modificar
- FUNCIONA: transacoes readwrite em LocalDb, offline/outbox, CAS de cursor A44, recuperacao de conexao A45-A47.
- QUEBRADO (reproduzido): `ensureBootstrap()` lia/escrevia `installationId` e `workspaceBootstrapProof` em transacoes separadas; duas abas provisionavam provas diferentes (uma recebe HTTP 409).
- PARCIAL (risco confirmado no codigo): `saveCapability()` fazia getMeta/setMeta separados; uma resposta atrasada de geracao menor podia substituir bearer mais recente.
- NAO IMPLEMENTADO: teste real com 2 abas no IndexedDB do navegador e sync de 2 aparelhos.

## Escopo e arquivos
- `apps/admin/src/lib/local-repositories/index.ts`: `ensureBootstrapIdentity(factory)` grava os dois valores atomicamente em meta, preservando valores legados ja existentes; `saveWorkspaceCapability(candidate)` compara geracoes no mesmo readwrite, recusa workspace incorreto.
- `apps/admin/src/lib/sync/sync-engine.ts`: chama os metodos transacionais, preserva validacao de schema e workspace.
- `scripts/sync-bootstrap-race.test.mjs`: concorrencia entre duas instancias de sync, recuperacao 401 fora de ordem, rollback, valor parcial, mesma geracao e isolamento de workspace (9 casos).
- `scripts/sync-request-durability.test.mjs`: atualiza apenas o stub de repositorio do teste A41 para o novo contrato.

## Fora do escopo / seguranca
Nao migrar IndexedDB, alterar schema, remover credenciais legadas, mudar API Hono/Neon, transferir chaves para logs ou acionar rede em modo offline. Nao criar retry infinito; servidor ainda controla validade/rotacao do bearer.

## Criterios de aceite
1. Duas abas com storage compartilhado usam um unico par `installationId`/`bootstrapProof` persistido; reabrir nao regenera.
2. Identidade parcialmente persistida preserva o valor valido e cria somente o ausente; transacao falha sem escrita parcial.
3. Recovery HTTP com geracao antiga concluida por ultimo nao reduz credencial armazenada nem gera reenvio com bearer revogado.
4. Capability de outro workspace e rejeitada; geracoes iguais mantem comportamento ja existente.
5. Operacoes locais/outbox e cursor nao sao modificados.

## Testes, QA e evidencias
- Antes: teste real de duas abas simuladas retornou `['synced','error']`, provando a corrida; os novos metodos ainda nao existiam.
- Depois: 9/9 novos testes Node passaram, com adapter de transacoes serializadas e dois modulos sync independentes; suite Node completa 227/227 passou. TypeScript `--strict --noEmit` do sync em stubs isolados PASS; frontend PWA/IDB no mesmo recorte PASS; `node --check` do novo teste PASS.
- NAO EXECUTADO: lint/typecheck/build/Vitest/Playwright integrados, IndexedDB real em duas abas, WebView Android/iOS, integracao remota PostGIS/Neon e RC.

## Regras Git / acoes proibidas
Somente `dev/markmap-pwa-v2` com HEAD e PR/issue reconfirmados; commit `[skip ci]`. Proibido GitHub Actions/CI, merge em main, deploy, migration destrutiva, force push, secrets, release/tag, publicacao em loja e exclusao de dados reais.

## Riscos e reversao
Um storage permanentemente indisponivel continua retornando erro; proxima tentativa pode recuperar sem gerar identidades diferentes. Adapter Node serializa transacoes mas nao substitui validacao real de IndexedDB. Rollback por revert pontual sem migracao; nao descartar dados do dispositivo.

## Relatorio esperado
SHA e arquivos alterados, baseline comprovado, comandos/resultados realmente executados, limitacoes de homologacao, Checklist Mestre e Handoff atualizados no GitHub e Notion.
