# MarkMap — A22/A23: integridade dos protocolos e diagnóstico seguro do mapa

**Data:** 2026-10-10  
**Branch:** `dev/markmap-pwa-v2`  
**HEAD-base auditado:** `82d4de09b291de9c30fcf1e170d6a4b34d34db54`  
**Estado:** código de desenvolvimento, QA direcionada. **Não homologado em browser/dispositivo.**

## Objetivo e contexto

Evitar que solicitações PMTiles/recursos locais retornem silenciosamente bytes incompletos, retirar listeners de abort após a resposta e distinguir cancelamentos normais de falhas reais na interface. A20/A21 já implementaram retry controlado e fundo simples offline; estes fluxos são reutilizados. O MarkMap permanece offline-first com IndexedDB/localStorage como fonte operacional. Backend Hono, Neon e Capacitor não mudam.

## Auditoria do HEAD

- **FUNCIONA EM CÓDIGO:** `OfflinePackageSource` limita pedidos PMTiles a 4 MiB; protocolo de glyph/sprite/estilo verifica path seguro e limita blob a 4 MiB; MapLibre já trata cancelamento pelo controller e oferece retry/fundo neutro.
- **PARCIAL / RISCO CONCRETO:** `File.slice()` pode devolver menos bytes quando o range excede o arquivo, mas a implementação anterior não conferia `offset + length <= file.size` nem `arrayBuffer.byteLength === length`.
- **PARCIAL:** Promise.race do leitor de recursos instala listeners `abort` que não são removidos explicitamente em sucesso/erro; o resolver de asset não era interrompido prontamente pelo sinal.
- **PARCIAL:** erros locais apresentavam `event.error.message` e exceções de inicialização diretamente na tela, potencialmente expondo paths/URLs internos e confundindo `AbortError` normal com pacote corrompido.
- **NÃO COMPROVADO:** ocorrência em dispositivo real, perda de memória mensurável e efeitos no MapLibre nativo em WebView.

## A22 — escopo

1. Introduzir `offline-protocol-safety.mjs` com `OfflineProtocolIntegrityError` e códigos estáveis, validação de limites sem overflow, bytes exatamente correspondentes ao solicitado e verificação de Blob.
2. Integrar aos leitores em `packages/maps/src/offline/protocol.ts`: faixa PMTiles inteiramente dentro do arquivo; zero bytes só no limite válido; cancelar antes/durante leitura com `AbortError`.
3. Resolver glyph/sprite/estilo sob sinal de cancelamento, verificar Blob real (limite pré-existente 4 MiB), conferir `arrayBuffer.byteLength` e remover listeners de abort em sucesso/erro/cancelamento.
4. Preservar contrato MapLibre/PMTiles, limites, validação de path e mensagens legadas `too large`/`invalid offline package asset URL` exigidas pelos testes já existentes.

## A23 — escopo

1. Adicionar `describeOfflineMapFailure` com diagnósticos localizados, estáveis e **sem reproduzir mensagem bruta de erro**, URL, token ou path.
2. Ignorar `AbortError`/cancelamento de protocolos de mapas desmontados; agrupar erros de range/asset/geração alterada/recursos/renderer/rede em mensagens acionáveis.
3. Integrar no listener MapLibre e no catch de inicialização em `CommandCenterPage.tsx`, mantendo o retry/fundo simples da A20/A21 e os guardas de `cancelled` e `mapErrorRef`.
4. Nenhuma mudança na origem selecionada, instalações, IndexedDB, outbox, dados de campo ou backend.

## Fora do escopo

Sem políticas novas de cache/descarte, re-download automático, modificação de geometria, atualização do schema, infraestrutura, mudança de stack, novos serviços, regressão de importação ou publicação. O helper de abort só cancela a resposta para o chamador; `Blob.arrayBuffer()` já iniciado pode continuar em baixo nível conforme o navegador.

## Arquivos afetados

- `packages/maps/src/offline/protocol.ts` — validação de PMTiles e recursos, abort limpo.
- `packages/maps/src/offline/offline-protocol-safety.mjs` e `.d.mts` — helpers novos.
- `apps/admin/src/lib/map/offline-map-diagnostics.mjs` e `.d.mts` — diagnósticos novos.
- `apps/admin/src/pages/workspace/CommandCenterPage.tsx` — diagnóstico na UI, sem raw error.
- `scripts/offline-protocol-safety.test.mjs`, `scripts/offline-map-diagnostics.test.mjs` — testes Node.
- `packages/maps/tests/offline/offline-protocol-integrity.test.ts` — regressão Vitest (adicionada, **não executada**).
- `docs/MM-MAP-A22-A23-protocol-recovery.md`, `docs/MARKMAP_MASTER.md`, `docs/master-checklist.md`, `docs/handoff.md`.

## Segurança, critérios de aceite e testes

- Dado range válido [offset,length] dentro de arquivo, responder exatamente a quantidade pedida, inclusive zero no EOF.
- Dado range além do EOF, demasiado grande, negativo ou não inteiro, rejeitar **antes** de `File.slice()`.
- Dado Blob ausente, maior que 4 MiB, inválido ou que retorne bytes truncados, falhar com código estável sem ativar outro pacote.
- Dado cancelamento antes/durante read/resolve, retornar `AbortError`, liberar listener e não mostrar banner de corrupção.
- Dado erro da cartografia, mensagem curta com recuperação e **sem** revelar URLs com tokens/paths. Erro repetido continua coalescido. Retry da A20/A21 preservado.
- Não alterar mapas instalados, geração ativa, seleção, IndexedDB/outbox e dados de campo.

**QA EXECUTADA LOCALMENTE:** Node v22.16.0; recorte A10–A23, `node --test scripts/*.test.mjs` com **60/60 PASS, 0 fail/skip**. Desses, 7 são smoke tests isolados executando a versão TS transpilada de `protocol.ts` com `pmtiles`/package simulados (harness **não versionado**), 11 são novos testes Node versionados (6 A22 + 5 A23), e 42 são regressões do recorte anterior. `node --check` helper, `tsc --strict --noEmit` isolado do protocolo com tipos de stubs e das declarações TS, e `typescript.transpileModule` do protocolo/Vitest: PASS. **Esses resultados não equivalem a um build/teste real do monorepo**.

**NÃO EXECUTADO e não bloqueante para continuar fases:** testes Vitest que dependem das instalações pnpm reais, `lint/typecheck/build` de todo o monorepo, React/MapLibre E2E, IndexedDB real, WebGL e Android/iOS físicos. Não classificar como produção pronta ou homologação.

## Git, ações proibidas, riscos e rollback

Somente `dev/markmap-pwa-v2`, após conferir HEAD, PRs e issues. Criar commit fast-forward com `[skip ci]`, sem tocar branches alheias. **Proibidos sem autorização:** CI remoto, merge `main`, deploy Vercel, Neon/migration, release/tag, loja, secrets, força de push e ações destrutivas/exclusão de dados.

**Riscos residuais:** `pmtiles` real e o MapLibre Worker podem diferir dos mocks; a leitura `Blob.arrayBuffer()` cancelada não interrompe necessariamente o I/O interno; renderização WebGL e GIF/fontes reais exigem QA de integração antes de release. **Rollback:** revert isolado de A22/A23; sem migração ou mudança de estado local.

## Relatório e próxima fase

Relatar SHA/paths, cobertura executada, lacunas de integração, risco residual, rollback e estado do Notion. Próxima investigação de desenvolvimento: estabilidade do ciclo de protocolos/estilo após troca rápida de geração ou retry, baseada no HEAD real; sem bloquear por avaliação física.
