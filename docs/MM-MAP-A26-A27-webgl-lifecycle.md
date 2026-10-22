# PRD — MarkMap A26/A27: cancelamento de requisições e recuperação WebGL

**Data:** 2026-10-10  
**Branch exclusiva:** `dev/markmap-pwa-v2`  
**HEAD-base auditado:** `f042a8806cae3232e0cdb9c97171974e25abcc0d`  
**Natureza:** implementação incremental, sem deploy, release ou alteração em produção.

## Objetivo e contexto

Corrigir duas lacunas de robustez do visualizador offline-first MarkMap. A24/A25 já criaram leases exclusivos para os protocolos globais PMTiles/MapLibre e rollback de inicialização, mas requests da geração antiga ainda podiam executar I/O até terminarem, mesmo após a desmontagem da view. A20/A21 já fornecem retry manual e fundo neutro, porém a tela ainda não reage explicitamente à perda/restauração do contexto WebGL.

Preservar a stack React + Vite + TypeScript, MapLibre, Terra Draw, IndexedDB/outbox, Hono, Neon/PostGIS para sincronização e Capacitor. Nenhum recurso operacional deve exigir internet.

## Auditoria do HEAD

- **FUNCIONA:** A24 isola identidades de tile/asset por view e recusa o resultado tardio depois de liberar o lease; A22 respeita AbortSignal nos leitores de Blob/PMTiles; A20 possui retry manual e fallback neutro.
- **PARCIAL:** o dispatch compartilhado A24 ainda passava o AbortController externo diretamente ao handler e removia a view do registro sem abortar as leituras já iniciadas; request de I/O travado permanecia vivo desnecessariamente.
- **PARCIAL:** `CommandCenterPage` trata `map.on('error')` mas não tratava os eventos nativos MapLibre `webglcontextlost`/`webglcontextrestored` de forma explícita; podia ficar sem renderização após suspensão.
- **PARCIAL:** um `map.remove()` que lança no cleanup React impedia o restante do teardown e a liberação do lease.
- **NÃO IMPLEMENTADO antes desta fase:** orçamento persistente de uma tentativa automática após restauração do contexto por seleção/revisão, independência de ciclos de remount.

## A26 — escopo implementado

1. Cada lease mantém apenas seus próprios controladores de requests pendentes. O dispatcher cria um `AbortController` vinculado ao controller do MapLibre, repassando-o à implementação PMTiles/assets existente.
2. `release()` é idempotente: remove o lease, aborta imediatamente requests pendentes e limpa o registro. Não aborta o controller do MapLibre ou requests de outros leases.
3. Em cancelamento durante I/O, a Promise do chamador rejeita prontamente com `AbortError` ainda que o código de baixo nível ignore o sinal; o I/O cooperativo também recebe o abort.
4. Remover listeners de abort associados ao sinal de MapLibre em sucesso, erro e cancelamento. Nunca aplicar um resultado retornado após liberar a view.
5. Manter nomes dos esquemas globais, URLs/aliases A24, tipagem externa e limites de arquivo A22 intactos.

## A27 — escopo implementado

1. Observar os eventos oficiais MapLibre `webglcontextlost`/`webglcontextrestored` da instância atual e ignorar eventos de mapas desmontados.
2. Na perda: permitir `preventDefault` no evento WebGL original para autorizar restauração, marcar o mapa como indisponível e oferecer mensagem estável ao usuário; preservar os dados locais.
3. Na restauração: permitir **uma única reconstrução automática por combinação de região/geração/GeoPDF/fundo neutro**, inclusive após remount React. Falhas repetidas exigem retry manual, evitando loop de GPU.
4. A rotina de foreground A20 não dispara retry enquanto o WebGL ainda está marcado como perdido.
5. Cleanup React é best-effort por recurso: mesmo que remoção de marker/MapLibre/GeoPDF falhe por contexto gráfico destruído, referências e lease são liberados.

## Fora do escopo

Sem reescrever renderer MapLibre, reinstalar mapas, baixar dados automaticamente, trocar a stack, alterar banco/sync/API, WebGL canvas alternativo, nova store de estado, timer de polling, IndexedDB schema, migrations ou política de quota. Sem CI remoto, PR para main, deploy, publicação, release/tag ou exclusão de dados.

## Arquivos afetados

- `apps/admin/src/lib/map/offline-protocol-leases.mjs` — requests por lease + cancelamento/limpeza.
- `apps/admin/src/lib/map/webgl-context-recovery.mjs` e `.d.mts` — controlador explícito e orçamento de retry.
- `apps/admin/src/pages/workspace/CommandCenterPage.tsx` — eventos WebGL, retry limitado e cleanup robusto.
- `scripts/offline-protocol-leases.test.mjs`, `scripts/offline-protocol-lease-abort.test.mjs`, `scripts/webgl-context-recovery.test.mjs` — regressões Node.
- `docs/MM-MAP-A26-A27-webgl-lifecycle.md`, `docs/MARKMAP_MASTER.md`, `docs/master-checklist.md`, `docs/handoff.md`.

## Segurança e integridade — critérios de aceite

- Leitura pendente de A deve rejeitar com AbortError imediatamente após A ser desmontada, mesmo que a Promise subjacente esteja travada; sinal interno abortado.
- B permanece ativa, com os mesmos protocolos globais e seus próprios recursos, quando A libera o lease.
- O AbortController externo de MapLibre nunca é abortado pela rotina que libera o lease; seu listener é removido após settle.
- Uma falha de asset/PMTiles antes do abort é propagada sem mascarar a causa; resultados atrasados após liberação não são publicados.
- Um único evento WebGL lost produz uma única mensagem; restauração sem perda anterior não reinicia MapLibre. O retry automático ocorre no máximo uma vez para o mesmo contexto, mesmo após remount.
- Seleção de outra região/geração reinicia o orçamento de recuperação de forma independente; cancelamento/desmontagem impede retry tardio.
- Uma exceção durante `map.remove()` não retém lease, refs ou dados e não causa exclusões de pacotes, desenhos, projetos ou outbox.
- Não incluir secrets, URLs brutas de erro nem dados pessoais em UI/logs.

## Testes e evidências realmente executados

**Ambiente local:** Node 22.16.0 e TypeScript 5.8.3, subconjunto recuperado dos arquivos versionados do MarkMap em `/mnt/data/markmap_a26`.

- `node --test` no **recorte reproduzível de testes Node versionados A10–A27**: **76/76 PASS**, zero falhas, skips ou cancelamentos.
- `node --test scripts/*.test.mjs` incluindo o harness legado A22 com `pmtiles` simulado: **84/84 PASS**. Os 8 casos do harness de protocolo transpilado são somente evidência local; **o harness não é adicionado ao repositório**.
- Novos casos versionados A26: 7 (cinco no arquivo pré-existente de leases, dois no novo teste de leitura com abort); novos A27: 6; regressões anteriores no recorte: 63.
- `node --check` dos helpers JS modificados: PASS.
- `tsc --noEmit --strict` isolado das declarações `.d.mts`: PASS.
- `typescript.transpileModule` da `CommandCenterPage.tsx`: parsing TSX PASS, **não equivale ao typecheck do projeto**.
- Eventos `webglcontextlost` e `webglcontextrestored` foram confirmados na documentação de `MapEventType` do MapLibre: https://maplibre.org/maplibre-gl-js/docs/API/type-aliases/MapEventType/.

**NÃO EXECUTADO (não bloqueante ao desenvolvimento):** lint/typecheck/build/testes integrais do monorepo, Vitest real, MapLibre/PMTiles em WebGL real, Playwright, IndexedDB navegador, teste de suspensão Android/iOS e medições RAM. Não inferir homologação ou capacidade de produção a partir dos mocks.

## Riscos, rollback e regras Git

- Cancelar o chamador não obriga um I/O nativo que ignora AbortSignal a parar fisicamente; evita que a aplicação continue aguardando/aplicando seu resultado, e sinaliza abort ao leitor cooperativo.
- MapLibre pode tentar restaurar o WebGL internamente; neste código o primeiro evento de restauração válido agenda remount para revalidar fontes e estilo. O orçamento limita remount automático, mas não garante que uma GPU realmente volte a funcionar.
- Eventos WebGL físicos, reinstalação de sprites/glyphs e vazamentos reais de worker ainda requerem QA posterior, **sem bloquear novas fases de código**.
- Trabalhar só na branch dev, confirmar HEAD/PRs e usar atualização fast-forward com `[skip ci]`, sem force-push e sem sobrescrever trabalho de outros agentes.
- **Ações proibidas sem autorização explícita:** merge `main`, GitHub Actions/CI remoto, deploy Vercel, mudanças Neon/migration, release/tag, lojas Android/iOS, secrets e exclusões irreversíveis.
- **Rollback:** revert isolado do commit A26/A27. Sem schema alterado, migration ou perda de dados.

## Relatório de conclusão esperado

Registrar SHA do commit e arquivos, testes observados x pendentes, risco de I/O nativo não cooperativo, diff auditado, próximo item livre e atualização `docs/MARKMAP_MASTER.md`, `docs/master-checklist.md`, `docs/handoff.md` e Checklist Mestre do Notion.
