# MarkMap — A28/A29: readiness de estilo e reparo de camadas offline

**Data:** 2026-10-10  
**Branch de trabalho:** `dev/markmap-pwa-v2`  
**HEAD-base auditado:** `f93d9bbe7d1d82f18fa7858a351607654abe34fe`  
**Status:** implementado em desenvolvimento e QA Node direcionada. Sem homologacao em WebView/MapLibre reais.

## Objetivo e contexto

Garantir que o MarkMap nao marque uma visualizacao antiga como pronta depois de uma troca de estilo, restauracao WebGL, mudanca de geracao ou desmontagem; e recuperar camadas de projeto/desenho/GeoPDF/rotas que ficaram incompletas apos uma montagem parcial. A26/A27 ja cancelam protocolos por instância e limitam o remount WebGL. Nao reescrever esses mecanismos nem a fonte operacional offline-first: IndexedDB/outbox continuam locais; Neon/PostGIS seguem para sync/backup via Hono.

## Auditoria do HEAD antes da alteracao

- **FUNCIONA em codigo:** MapLibre, estilo regional/GeoPDF, adicao de fontes proprias em `style.load`, A24 leases de protocolo e A27 restauracao WebGL; projeto, desenhos, rotas e outbox sao guardados em stores existentes.
- **PARCIAL / falha potencial observada no codigo:** um novo `sourcedata` cria `map.once('render', publishApplied)` sem deduplicacao nem cancelamento se outra geracao/style foi instalada antes do proximo frame. Um evento atrasado pode sinalizar `mapReady` indevidamente.
- **PARCIAL:** `ensureSource()` so chamava `addLayer` quando a **fonte inteira** ainda nao existia. Se a fonte foi adicionada mas a configuracao de uma camada falhou, a proxima hidratacao nao reparava camadas faltantes.
- **PARCIAL:** quando a WebGL era restaurada e o budget de remount A27 ja tinha sido usado, nao havia tentativa explicita de reidratar o estilo atual; erros de source/style durante perda de contexto podiam induzir UI falsa.
- **NAO COMPROVADO:** falhas em navegador WebGL/Capacitor real, comportamento fisico em suspensao e efeito quantitativo no consumo de recursos.

## A28 — escopo de implementacao

1. Criar `createOfflineStyleLifecycle()` para organizar `style.load`, `sourcedata`, `render` e eventos de contexto perdido/restaurado em uma unica geracao de visualizacao por montagem React.
2. Consolidar eventos `sourcedata` em **um** callback `render` pendente e publicar `mapReady` apenas depois da fonte `local-dataset` carregada e da renderizacao do estilo atual. Cancelar callbacks pendentes ao trocar de estilo, perder WebGL ou desmontar.
3. Preservar eventos de fontes locais que se resolvem _sincronamente_ durante a hidratacao. Ignorar `sourcedata` de outras fontes ou sem `isSourceLoaded`.
4. Integrar ao `CommandCenterPage`: registrar `sourcedata` antes da hidratacao, zerar o readiness ao mudar estilo, impedir sucesso de mapas cancelados/perdidos e relatar falhas de hidratação pelas mensagens seguras da A23.
5. Em uma segunda restauracao WebGL do mesmo contexto, se A27 ja consumiu o remount automatico, revalidar camadas do estilo corrente caso ele ainda esteja carregado; **nao iniciar loop** de remount, rede ou timer.

## A29 — escopo de implementacao

1. Criar `ensureOfflineSourceLayers()` para verificar **cada camada separadamente** da fonte compartilhada. Nao duplicar fontes nem camadas existentes.
2. Aplicar aos overlays `local-dataset`, `geopdf-overlay`, `draw-preview`, `regional-contours`, `regional-transit` e `offline-route`, preservando GeoJSON, geometria/rota e apresentacao atuais.
3. Reter a fonte com dados de campo se ela existir, mesmo quando uma camada estiver ausente; em proximo `style.load` reparar somente o que faltou. Para GeoPDF, restaurar camada e ordenacao quando sua fonte persistiu.
4. Se MapLibre rejeitar `addSource`/`addLayer`, mostrar erro e permitir retry existente sem apagar qualquer conteudo persistido.

## Fora do escopo

Sem criacao de segunda fonte global de estado, reescrever MapLibre, trocar Terra Draw, mudar IndexedDB/outbox, contratos, servidor Hono ou banco Neon/PostGIS, alterar schema/migrar DB, baixar mapa online, modificar quotas, substituir worker, criar polling, alterar logica de permissoes GPS ou publicar release.

## Arquivos afetados

- `apps/admin/src/pages/workspace/CommandCenterPage.tsx` — integracao de coordenador de estilo, eventos WebGL e overlays idempotentes.
- `apps/admin/src/lib/map/offline-style-lifecycle.mjs` e `.d.mts` — nova politica de eventos/readiness.
- `apps/admin/src/lib/map/offline-style-layers.mjs` e `.d.mts` — recuperacao independente de camadas.
- `scripts/offline-style-lifecycle.test.mjs` e `scripts/offline-style-layers.test.mjs` — testes Node.
- `docs/MM-MAP-A28-A29-style-hydration.md`, `docs/MARKMAP_MASTER.md`, `docs/master-checklist.md`, `docs/handoff.md` — PRD e continuidade.

## Seguranca e criterios de aceite

- **Dado** render pendente da geracao A, **quando** style.load B ocorrer, **entao** o callback de A deixa de poder marcar B como pronto.
- **Dado** varias notificacoes `sourcedata` do mesmo estilo, **quando** esperar o proximo frame, **entao** so existe um listener `render` e uma publicacao de `mapReady`.
- **Dado** GeoJSON local carregado imediatamente durante a hidratacao, **quando** a instalacao das camadas terminar, **entao** nao perder o evento de readiness.
- **Dado** WebGL perdido ou mapa desmontado, **quando** chegar evento tardio, **entao** nenhuma mudanca de UI, camada ou dados operacionais deve ser executada.
- **Dada** fonte de feicoes ja existente com camada faltante, **quando** rodar hidratacao, **entao** criar apenas a camada ausente sem substituir dados/geometry.
- **Dado** troca completa de estilo MapLibre, **quando** a nova `style.load` ocorrer, **entao** reconstituir os overlays regionais/GeoPDF/desenhos/rotas atuais, sem duplicar.
- Nenhum evento de estilo pode limpar projetos, mapas instalados, IndexedDB, outbox ou selecao do mapa ativo; evitar mensagens brutas com URLs/tokens.

## Testes, QA e evidencias executadas

**Ambiente:** Node.js v22.16.0, TypeScript global no subconjunto local `/mnt/data/markmap_a28` reconstruido com os arquivos versionados (o monorepo completo nao esta montado com pnpm).

- `node --test` nos **arquivos Node versionados** do recorte A10–A29: **93/93 PASS**, zero fail/skip. Destes, **17 testes novos A28/A29** (11 do lifecycle, 6 da reidratação) e 76 regressões anteriores.
- `node --test scripts/*.test.mjs` incluindo harness A22 legado de PMTiles transpilado/stub **nao versionado**: **101/101 PASS**, sem falhas.
- `node --check` dos dois helpers `.mjs`: PASS.
- `tsc --strict --noEmit --target es2022 --lib dom,es2022 --module nodenext --moduleResolution nodenext` nas declarations e smoke estrutural das assinaturas: PASS.
- `typescript.transpileModule` do componente `.tsx`: zero diagnosticos sintaticos. **Nao equivale a `tsc --noEmit` do monorepo.**
- Comparacao de blobs via SHA Git local para garantir correspondencia entre codigo testado e commits: realizada.

**NAO EXECUTADO / nao bloqueante para desenvolvimento:** full lint/typecheck/build monorepo, Vitest de mapas, Playwright, MapLibre/PMTiles e IndexedDB em browser real, Android/iOS/WebView fisico, medicao de FPS/memoria, eventos WebGL reais. Nao declarar homologacao ou release pronto.

## Riscos, regras Git, acoes proibidas e rollback

- Reidratação no proprio estilo so ocorre quando `style.load` disparar ou num retorno WebGL com estilo carregado; um renderer permanentemente quebrado continua exigindo retry manual/fundo simples.
- A funcao de camadas nao substitui feature/source existentes. Se o estilo regional tiver conflito de ID com overlays locais, a falha sera exposta e pode exigir revisao do pacote; nao sobrepor a origem silenciosamente.
- Tests de MapLibre via event mocks nao substituem as provas em GPU/worker real antes de release.
- Trabalhar apenas sobre o HEAD confirmado de `dev/markmap-pwa-v2`, sem alterar outros agentes; commit `[skip ci]` com CAS fast-forward, rollback por revert isolado (sem migration).
- **PROIBIDO sem autorizacao explicita:** merge main, CI remoto/GitHub Actions, deploy Vercel, migrations/operacoes Neon, DROP/TRUNCATE/DELETE em producao, force-push, rotacao de secrets, release/tag e publicacao Android/iOS.

## Relatorio final esperado e proximo desenvolvimento

Informar SHA e arquivos mudados, testes executados x pendentes, riscos residuais, rollback, Notion e docs sincronizados. Proxima melhoria deve ser decidida por auditoria do HEAD real e dos problemas comprovados, sem gate por teste fisico para seguir codando.
