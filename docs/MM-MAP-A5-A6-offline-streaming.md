# A5/A6 — Integridade incremental e instalador regional offline

**Data:** 2026-10-10  
**Branch de desenvolvimento:** `dev/markmap-pwa-v2`  
**Base auditada:** `1de7c487aa6d1b50e0586ac9adcb63ff44368ba0`  
**Estado:** implementação preparada, verificações locais direcionadas; homologação física/real NÃO é condição para desenvolver fases seguintes.

## Objetivo e decisão de processo

Continuar Maps Engine v2 sem parar o desenvolvimento por ausência de dispositivos físicos, extratos comerciais, servidor Playwright ou simulações reais. Registrar honestamente a cobertura; **não declarar testes não executados como verdes**. Entrega pública, `main`, release e deploy continuam fora do escopo e exigem autorização explícita, por serem ações separadas do desenvolvimento.

## Auditoria (HEAD antes do incremento)

| Área | Estado |
|---|---|
| `downloadVerifiedAsset` HTTP Range / SHA e retomada por checkpoint | FUNCIONA parcialmente: tests Node M10, mas usava `Response.arrayBuffer()` para HTTP 200 e `Blob.arrayBuffer()` para hash |
| `validateOfflinePackage` | PARCIAL: convertia PMTiles completo em `Uint8Array` para checar header e checksum |
| `RegionDownloadCheckpoints.getDownloadedBytes` | PARCIAL: `getAll(sha)` materializava todo histórico de chunks na memória |
| Importação HTTPS de região até 250 MiB | NÃO IMPLEMENTADO: cap artificial 64 MiB agregado e 48 MiB por arquivo |
| Quota/rollback e operação offline | FUNCIONA em código: pré-checagem, staging e ativação transacional; dispositivo real não validado |

## Escopo implementado

**A5 — integridade incremental**

1. SHA-256 incremental puro JS com memória constante e processamento de blocos de 64 bytes; digest interoperável com SHA-256 padrão e assinaturas hex.
2. `sha256Blob` usa `Blob.slice` em partes limitadas (padrão 1 MiB), sem converter PMTiles inteiro em `ArrayBuffer`.
3. Validador lê apenas os 127 bytes do header PMTiles; para JSON consulta o conteúdo após verificação de SHA e com limites já definidos, para sprite/glyph não o materializa.
4. Arquivo `.d.mts` expõe os tipos públicos usados pelo TS existente. Não adiciona pacote ou serviço externo.

**A6 — download e checkpoints**

1. HTTP 206: `ReadableStream` com limite exato de bytes antes de persistir chunk; recusa respostas menores/maiores que `Content-Range`.
2. HTTP 200 de servidor sem suporte Range: somente no offset zero; grava em chunks limitados, verifica SHA incremental e limpa checkpoints parciais em erro, sem `Response.arrayBuffer()` inteiro.
3. `getDownloadedBytes` usa cursor IndexedDB por SHA em vez de `index.getAll()`.
4. Installer HTTPS admite tentativa até orçamento agregado existente (`OFFLINE_PACKAGE_QUOTA = 250 MiB`), mas quota e espaço temporário estimados continuam fail-closed. Mensagem em Configurações reflete limite agregado.
5. Preserva armazenamento operacional local, outbox e mapa ativo; não altera versionamento de IndexedDB nem exige conectividade para usar pacotes instalados.

## Fora do escopo

Sem migração, política de limpeza automática, liberação de memória garantida em WebView real, hash autenticado/assinatura digital, alteração de contrato v2, dados OSM reais incorporados, build nativo, publicação, envio de dados ou alteração Neon/Hono/Vercel. O código ainda constrói um `Blob` final com todos os chunks em RAM; 250 MiB é **limite de validação**, não garantia de capacidade real em todos os dispositivos.

## Arquivos afetados

- `packages/maps/src/offline/incremental-sha256.mjs` e `.d.mts` — novo hash incremental.
- `packages/maps/src/offline/package.ts` — validação de archive usando slices.
- `apps/admin/src/lib/storage/verified-range-download.mjs` — streaming HTTP e SHA progressivo.
- `apps/admin/src/lib/storage/region-download-checkpoints.ts` — cursor IndexedDB.
- `apps/admin/src/lib/storage/resumable-installer.ts` — limite agregado de 250 MiB e preflight preservado.
- `apps/admin/src/pages/settings/SettingsPage.tsx` — aviso correto na UI.
- `scripts/streaming-integrity.test.mjs` — novo teste direcionado.
- `docs/MARKMAP_MASTER.md`, `docs/master-checklist.md`, `docs/handoff.md` — continuidade.

## Segurança e riscos

- SHA-256 verifica integridade esperada do manifest, **não autenticidade**: o publicador deve ser confiável.
- A implementação SHA customizada requer revisão de código antes de release, apesar da comparação com `node:crypto`.
- `Response` com bytes excedentes é rejeitado antes de armazenar; conteúdo parcial de resposta completa é removido se falhar. Desconexões de Range mantêm chunks completos para retomada.
- Sem garantia de memória física: `Blob` final, estruturas do aplicativo e IndexedDB ainda utilizam recursos e podem falhar por quota/OOM; a falha deve preservar a geração ativa.
- Retomada sem `If-Range` de conteúdo mutável termina em checksum mismatch, não ativação errada.
- Evitar deletar qualquer dado de campo, projeto, outbox, cache alheio ou pacote ativo como remediação.

## Critérios de aceite e evidência

- Dado o SHA de referência de Node, quando processar bytes em limites arbitrários (inclusive 55–65, 1 milhão e >500 mil bytes), então digest idêntico.
- Dado `Blob` com `arrayBuffer()` proibido, quando verificar checksum, então processa `slice` e obtém hash idêntico.
- Dado HTTP 200 ignorando Range, quando receber stream com conteúdo exato, então checkpoints/progresso incrementais, `Blob` e SHA válidos; dados excedentes não persistem.
- Dado Range com tamanho inferior/superior ao declarado, quando receber resposta, então falha antes de gravar o checkpoint.
- Dado pacote válido, quando tentar instalação acima de 64 MiB e dentro dos limites 250 MiB, então o **preflight de quota**, e não o bloqueio anterior arbitrário, decide se pode iniciar. Isso ainda requer verificação do fluxo real para afirmar sucesso end-to-end.
- Regressão: os 37 testes Node direcionados anteriores continuam verdes, total com os 6 novos = **43/43 testes Node**, sem testes físicos.

**Execução observada no container:** Node `v22.16.0`, `node --test scripts/*.test.mjs apps/admin/src/lib/storage/*.test.mjs apps/admin/scripts/*.test.mjs`: **43 passaram, 0 falharam**. `node --check` módulos novos sem erros; `typescript.transpileModule` fez **checagem sintática** de 3 arquivos TS alterados. **Não equivalem** a lint/typecheck/build/E2E do monorepo. Sem rede npm/workspace integral, Chromium, Android/iOS físicos ou operação remota: NÃO EXECUTADOS; **não impedem continuar implementando**.

## QA, Git e ações proibidas

Testes locais, verificações estáticas e fixtures são feitos quando disponíveis; QA física/externa entra em backlog de homologação e NÃO bloqueia novas fases de desenvolvimento por decisão expressa. Diferença entre `IMPLEMENTADO`, `VALIDADO EM NODE` e `HOMOLOGADO` deve ser preservada.

Somente commits fast-forward em `dev/markmap-pwa-v2`, depois de confirmar o HEAD, com `[skip ci]`. Sem alteração de branches de outros agentes, `main`, GitHub Actions, deploy público, release/tag, alterações de permissões, exclusão de dados, secrets, força de push ou migração Neon.

## Rollback e relatório final esperado

Reverter exclusivamente os commits A5/A6 na branch dev, mantendo índices existentes e banco local intocados. Relatar: HEAD, arquivos mudados, comandos/resultados efetivamente executados, falhas, compatibilidade offline-first, memória/quota não homologadas e próxima fase livre. Atualizar Notion + master-checklist + handoff sem classificar como release aprovado.
