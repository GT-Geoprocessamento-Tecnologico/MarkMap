# A206 — Inspeção offline do que fica fora do backup parcial

**Projeto:** MarkMap · **Issue:** #43 · **Fase:** T2, preparação da exportação multibanco · **Base:** `main@92dfbffa77d4707820ef9124e97d7b6cf066e260` (v0.5.21)

## Objetivo e contexto
Permitir que o proprietário verifique, nas Configurações, **quais outros bancos locais contêm dados não incluídos no backup parcial existente**. A inspeção funciona offline, é somente leitura e nunca declara recuperação integral.

**FUNCIONA como contrato de código, integração pendente:** `backup/export.ts` já exporta parte do workspace com AES-GCM, `restore.ts` implementa dry-run/restauração com confirmação, `FullPhotoBackupCard` oferece cópia separada das fotos e `backup/multi-db.ts` já conta linhas de outros bancos. **PARCIAL:** backup T3a até 16 MiB exclui bancos adicionais e mapas. **NÃO IMPLEMENTADO:** exportação e restauração multibanco completa com todos os bytes. **BLOQUEADO:** GitHub Actions #45 e QA integrado.

## Escopo
1. Acrescentar classificador puro `device-preflight.mjs` que recebe resultados dos quatro leitores existentes: motor local, malhas, blobs grandes e mapas offline.
2. Mostrar botão `Verificar outros bancos locais` em `BackupRestoreCard`. Executar `Promise.allSettled` **somente após clique**, sem percorrer ou ler arquivos binários; leitores existentes usam contagens `readonly`.
3. Exibir por banco: `not-included` (registros detectados fora do T3a), `empty` (zero registros nesta verificação), `unknown` (erro, schema inesperado, versão futura ou cobertura incoerente).
4. Manter mensagem explícita de que o backup é **parcial em todos os casos**, inclusive se os quatro bancos parecem vazios. Não confundir contagens de transações separadas com snapshot atômico.
5. Incluir regressões Node no gate oficial e casos de interface Vitest para dado presente, erro e vazio.

## Fora do escopo
Nenhuma exportação ou restauração adicional nesta PR; sem mudar formatos de backup existentes, alterar original GIS, outbox, IndexedDB, OPFS, CacheStorage, API/Neon, SW, permissões, token, banco remoto ou stack. Sem publicação, merge, release/tag, billing, migração, limpeza ou chamadas de rede.

## Arquivos afetados
- `apps/admin/src/lib/backup/device-preflight.mjs` — classificador sem efeitos colaterais.
- `apps/admin/src/lib/backup/device-preflight.d.mts` — tipos para TS.
- `apps/admin/src/lib/backup/device-preflight.test.mjs` — regressões Node.
- `apps/admin/src/components/backup/BackupRestoreCard.tsx` — inspecionar após gesto e mostrar estados.
- `apps/admin/src/components/backup/BackupRestoreCard.test.tsx` — regressões UI.
- `apps/admin/package.json` — registrar teste Node no gate existente; versão mantida.
- Este PRD.

## Segurança e integridade
- Não incluir `records`, IDs, coordenadas, nomes, binários, texto de exceções ou segredos no resultado/UI/logs.
- `pending` acompanhado de motivo e contagem não enumerada significa registros fora do backup T3a. `absent` só vale para zero registros no momento da consulta.
- Erros de leitura e valores inesperados são `unknown` (**fail closed**, jamais “vazio”).
- Nenhuma leitura é executada na montagem do componente. Sem rede e sem transações de escrita. Bancos ausentes não são inicializados pelos leitores existentes.
- Inspeção **não prova** consistência, integridade, restauração, identidade de workspace ou completude do dispositivo.

## Critérios de aceite
- [x] O resultado nunca informa backup integral.
- [x] Detecta seções pendentes e distingue ausência de erro.
- [x] Não reflete dados confidenciais do objeto de resposta.
- [x] A UI exige clique; apresenta limite de avaliação entre bancos.
- [x] Teste Node incluído no comando `pnpm --filter admin test`.
- [ ] Rodar Vitest real, typecheck/lint monorepo, Vite build, Playwright offline, Android e iOS físicos e restore em perfil limpo.

## Testes e QA
- `node --test apps/admin/src/lib/backup/device-preflight.test.mjs`: **8/8 PASS** (Node 22.16.0, fixtures sem dados reais).
- `tsc --noEmit ... device-preflight.d.mts`: PASS isolado.
- `typescript.transpileModule` dos arquivos TSX da interface/teste: PASS **somente sintaxe**.
- **NÃO EXECUTADOS:** Vitest e React reais, lint/typecheck monorepo, build Vite, E2E, testes físicos ou backup/restore real. CI #45 permanece bloqueado antes da atribuição de runner. Nenhuma promessa de recuperação completa.

## Regras de Git, ações proibidas e riscos
Somente branch isolada a partir da main conferida, PR **DRAFT**, sem reutilizar os branches #104/#105, force push, merge, release ou deploy. Não editar `multi-db.ts`, `export.ts`, `restore.ts`, SW, dados nem infra. Risco conhecido: contagens de bancos diferentes não são atômicas e um navegador pode retornar desconhecido; exibir honestamente, sem fazer limpeza/evicção. Reversão: reverter somente UI/classificador/testes, sem migrações.

## Documentação e relatório final
Registrar autor/hora, HEAD da main, branch e commits exatos, arquivos alterados, status de cada teste (PASS/BLOCKED), limitações e próxima etapa na issue #43, PR, Obsidian Diário/Handoff/Checklist/nota BCDR e Checklist Mestre Notion. Confirmar leitura após escrita; não homologar sem gates completos.

## Próximo passo
T3b: exportação criptografada de volume maior com bytes de mapas/assets, meshes e blobs, manifesto de cobertura e checksums; depois dry-run e restore em perfil vazio com rollback, sem alterar as cópias atuais. Nunca chamar o T3a de backup integral.
