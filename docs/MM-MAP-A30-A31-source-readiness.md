# PRD — MarkMap A30/A31: readiness de fonte local e alerta WebGL consistente

**Data:** 2026-10-10  
**Branch:** `dev/markmap-pwa-v2`  
**HEAD-base auditado:** `6b8b61309eb63203f4e7206551e0476038a15bcb`  
**Estado:** implementação de desenvolvimento, testes Node no recorte local, sem homologação navegador/dispositivo.

## Objetivo

Corrigir lacunas observáveis no código de A28/A29: uma fonte GeoJSON local já carregada pode não emitir novo `sourcedata` depois de `style.load`, deixando `mapReady=false`; eventos atrasados de uma fonte anterior podem acionar o readiness de uma nova fonte ainda incompleta. Em A27/A29, o alerta de contexto WebGL perdido permanece na tela mesmo quando a recuperação em lugar funcionou; o mesmo alerta bloqueia relatos subsequentes de falhas reais de recursos. Preservar MarkMap offline-first e os dados locais.

## Contexto e auditoria da base

- **FUNCIONA em código:** A24–A26 isolam leases de protocolo PMTiles e cancelamento por view; A27 dá uma tentativa de remount WebGL por cena; A28 controla geração/eventos de estilo; A29 repara fontes/camadas faltantes sem substituir dados.
- **PARCIAL comprovado pelo controle de fluxo:** A28 só libera readiness através de `sourceData()` provocado por evento recebido durante ou após hidratação, mas `ensureOfflineSourceLayers` pode preservar a fonte e não disparar novo evento; nada chama `map.isSourceLoaded('local-dataset')` após reidratação.
- **PARCIAL comprovado pelo controle de fluxo:** `sourceData` aceita `isSourceLoaded:true` de qualquer evento do mesmo ID após troca de estilo; não revalida carregamento **da fonte atual**. Se o estado muda durante `map.once('render')`, o callback pendente também não verifica o estado atual.
- **PARCIAL comprovado pelo controle de fluxo:** A29, quando esgotado orçamento WebGL, chama `styleLifecycle.styleLoad()` na mesma instância; `onReady` põe `mapReady=true` sem limpar o banner de WebGL. Os handlers de erro aceitam novo problema somente quando `mapErrorRef` está vazio e assim o alerta obsoleto mascara falha após restauração.
- **NÃO IMPLEMENTADO antes:** verificação explícita do estado da fonte atual antes do readiness e transição do alerta temporário WebGL após render bem-sucedido.
- **NÃO COMPROVADO:** ocorrência física em WebGL real, vazamentos de memória no worker, efeitos de dados grandes em Android/iOS.

## Escopo A30

1. Em `createOfflineStyleLifecycle`, usar `map.getSource('local-dataset')` e `map.isSourceLoaded('local-dataset')` quando ambos existem, **nesta ordem**. Fonte ausente não deve chamar `isSourceLoaded` porque MapLibre emite ErrorEvent; exceção de troca de estilo é tratada como fonte não pronta.
2. Após `onHydrate()` verificar se a fonte atual está pronta; se sim, seguir mesmo fluxo de render/readiness usado por `sourcedata`. Nenhum polling/rede/timer.
3. Antes de aceitar `sourcedata` e antes de publicar `onReady` após `render`, revalidar a fonte atual para rejeitar eventos atrasados e recarga iniciada entre o evento e o paint.
4. Manter API anterior para adapters sem `getSource`/`isSourceLoaded` e continuar validando geração, cancelamento, perda WebGL e teardown.

## Escopo A31

1. Centralizar a mensagem estável de perda WebGL em `webgl-context-recovery.mjs` e fornecer funções puras para limpar **somente** essa mensagem e permitir que falhas legítimas a substituam após recuperação.
2. Na `CommandCenterPage`, limpar o alerta temporário no `onReady` após paint, não apenas ao receber `webglcontextrestored`. Outros erros continuam visíveis; a recuperação do MapLibre/GeoPDF/PMTiles não altera dados locais.
3. Se uma falha de tile/asset/estilo aparecer após a restauração, ela deve substituir o alerta de contexto perdido e receber a classificação segura A23, sem exibir URL/token/path bruto.
4. Preservar retry manual, limite de remount automático, fallback neutro offline e mecanismos de leases.

## Fora do escopo

Sem mudar MapLibre/PMTiles versão, reescrever worker, fazer download de arquivos, alterar IndexedDB/outbox, upload/sync/Neon, schema/migration, geometria, fonte OSM/licença, quota de pacotes, autenticação, GPS ou deploy. Não lançar loop de recuperação nem suprimir erros reais.

## Arquivos afetados

- `apps/admin/src/lib/map/offline-style-lifecycle.mjs`, `.d.mts` — verificação da fonte atual e readiness por estado.
- `apps/admin/src/lib/map/webgl-context-recovery.mjs`, `.d.mts` — mensagem e classificação de transição de recuperação.
- `apps/admin/src/pages/workspace/CommandCenterPage.tsx` — integração conservadora em `onReady`, `onError`, `map.on('error')` e perda WebGL.
- `scripts/offline-style-source-readiness.test.mjs` (9 casos), `scripts/webgl-recovery-error-state.test.mjs` (5 casos) — regressões versionadas.
- `docs/MM-MAP-A30-A31-source-readiness.md`, `docs/MARKMAP_MASTER.md`, `docs/master-checklist.md`, `docs/handoff.md` — evidência e continuidade.

## Segurança e aceite

- **Dado** fonte local preservada e `isSourceLoaded=true`, **quando** `styleLoad()` hidratar, **então** readiness chega após paint mesmo sem novo `sourcedata`.
- **Dado** evento antigo `isSourceLoaded:true` enquanto a fonte atual ainda carrega, **quando** chegar o evento, **então** não publicar estado pronto nem chamar a leitura sem fonte válida.
- **Dado** fonte que entra em recarga entre `sourcedata` e `render`, **quando** o frame chegar, **então** não publicar readiness desatualizado; evento verdadeiro posterior retoma.
- **Dado** mapa sem fonte, **quando** consultar readiness, **então** não emitir `ErrorEvent` desnecessário via `isSourceLoaded` e não assumir sucesso.
- **Dado** restauração WebGL no mesmo mapa, **quando** houver paint real de fonte local, **então** limpar exclusivamente a mensagem transitória WebGL; erros de dados, rede e assets permanecem visíveis.
- **Dado** erro de recurso após recuperação WebGL, **quando** o evento chegar, **então** substituir o alerta velho pela mensagem segura, sem dados sensíveis.
- Nenhuma mudança em dados operacionais ou seleção, nem perda de projetos, geometria, outbox ou checkpoints. Sem criação de arquitetura paralela.

## Testes e QA executados

**Ambiente:** Linux, Node v22.16.0, TypeScript disponível globalmente; recorte de arquivos recuperado do HEAD `6b8b613` em `/mnt/data/markmap_a30`. Downloads de arquivos históricos pelo conector GitHub. O ambiente não contém checkout completo com `node_modules`/pnpm.

- `node --test scripts/*.test.mjs`: **147/147 testes PASS, zero failures/skips/cancelamentos**. Inclui 14 casos novos A30/A31 e regressões Node existentes. **Atenção à reprodução:** a primeira montagem do recorte reutilizou por engano uma cópia local antiga de `verified-range-download.mjs`, provocando 5 falhas A8/A9 (142/147). O arquivo foi substituído pelo exato Blob do HEAD (`739fbb8...`), sem editar código desse downloader. A reexecução completa passou **147/147**. Logs no ambiente de trabalho `node-tests-a30-full.log` (falhas de snapshot) e `node-tests-a30-full-final.log` (pass).
- `node --check` de helpers JS e novos testes: PASS.
- `tsc --strict --noEmit --target ES2022 --module NodeNext --moduleResolution NodeNext --lib DOM,ES2022 --skipLibCheck` para duas declarações auxiliares: PASS.
- `typescript.transpileModule` sintático de `CommandCenterPage.tsx`: PASS, **não é typecheck completo do aplicativo**.
- Documentação da API MapLibre consultada para `Map.isSourceLoaded`, `Map.getSource` e `sourcedata`: https://maplibre.org/maplibre-gl-js/docs/API/classes/Map/ e https://maplibre.org/maplibre-gl-js/docs/API/classes/MapSourceDataEvent/.

**NÃO EXECUTADO, dívida de homologação não bloqueante ao desenvolvimento:** `pnpm lint/typecheck/test/build` integral, Vitest real, Playwright, MapLibre/PMTiles/WebGL em navegador, IndexedDB real, múltiplas abas, Android/iOS físico e benchmarks RAM. Esses resultados NÃO qualificam release, publicação ou merge main.

## Git, ações proibidas, riscos e rollback

- Somente `dev/markmap-pwa-v2` após conferir Notion/HEAD/PRs/issues. Criar commit fast-forward `[skip ci]`, sem sobrescrever trabalho paralelo nem force-push. Verificar SHA dos blobs enviados comparando com `git hash-object` local.
- **Proibido sem nova autorização:** CI remoto, deploy Vercel, merge `main`, mudança Neon, migration destrutiva, tag/release, lojas, secrets, exclusões de dados/branches, ações irreversíveis ou custo recorrente.
- **Riscos:** a API `Map.isSourceLoaded` indica requisições pendentes da fonte, não prova pixel final renderizado — por isso o fluxo de paint existente permanece. Métodos podem lançar durante troca de estilo, tratados de forma conservadora. Worker real e restauração GPU continuam sem teste físico.
- **Rollback:** revert isolado do commit A30/A31 na branch dev. Não há migration nem mudança de dados locais; outbox permanece autoritativa no dispositivo.

## Relatório final esperado e próximo passo

Informar commit SHA, arquivos, QA observada, pendências e estado Notion após publicação. Próximo item deve surgir de auditoria do HEAD real: melhorar estabilidade de recursos de estilo/worker somente se houver falha comprovada, sem bloquear o desenvolvimento por teste físico.
