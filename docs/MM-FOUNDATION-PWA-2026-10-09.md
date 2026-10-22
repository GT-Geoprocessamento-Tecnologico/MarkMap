# MarkMap — PRD de continuidade PWA-first (2026-10-09)

**Estado:** implementação incremental, sem release. Branch fonte `feat/maps-engine-v2-offline@eb8f436`; branch de trabalho isolada. Task IDs relacionados: `MM-MAP-200`, `MM-MAP-130`, `MM-MAP-140`, `MM-UPD-010`.

## Objetivo

Destravar a primeira cadeia de entrega de mapas regionais offline reais na PWA sem depender de empacotamento Android/iOS. Sem reescrever IndexedDB/outbox, MapLibre/Terra Draw ou backend.

## Contexto auditado

- FUNCIONA (histórico): shell PWA instalável, MapLibre, importação local de PMTiles validada, IndexedDB/outbox.
- PARCIAL: pipeline exige basemap externo; gerenciador de regiões não checa bytes reais; atualização de shell não expõe build manifest.
- QUEBRADO/DESATIVADO por segurança: downloader regional simulava bytes e foi bloqueado para evitar ativação falsa.
- NÃO IMPLEMENTADO: conversão direta de PBF pequena região, checkpoint real por Range e apresentação da versão do build.

## Escopo deste incremento

1. Converter pequenos extratos `.osm.pbf` para tiles MVT em PMTiles v3 sem rede, sem bibliotecas externas no runtime do builder.
2. Empacotar um estilo simples local e sprites vazios válidos; publicar manifest/checksums com capacidades verificáveis.
3. Download HTTP Range com retries após interrupção via chunks IndexedDB, validação de tamanho/SHA-256, fail-closed, ativação somente pelo `OfflineMapStore` existente.
4. Verificar integridade real de região instalada e impedir remoção no gerenciador quando selecionada como ativa.
5. Gerar `version.json` público durante build PWA, com metadados de versão/protocolo/schema e inclusão no app shell.
6. Adicionar fluxo opt-in por URL HTTPS `manifest.json` na página de Configurações; não presumir catálogo pronto.
7. Adicionar testes Node direcionados e documentar limites.

## Fora do escopo

- Planet-scale, import completo de relações OSM/multipolígonos, tipografia/glyphs e endereços cartográficos completos.
- Catálogo remoto automático de regiões sem endpoint aprovado.
- Atualização silenciosa de binários/lojas, Android Auto, CarPlay e navegação em background garantida.
- Deploy, release/tag, migration de banco, mudança de domínio/segredo, integração em `main`.

## Arquivos afetados

` scripts/region-pipeline.mjs`, `scripts/osm-pbf-pmtiles.mjs`, testes Node e existentes do pipeline; `apps/admin/scripts/generate-shell-manifest.mjs` + teste; `apps/admin/src/lib/storage/resumable-installer.ts`, `region-download-checkpoints.ts`, `verified-range-download.mjs`/declarações/testes, `region-manager.ts`; `docs/*` relacionados a auditoria/handoff/checklist.

## Segurança e integridade

- Limites explícitos para PBF, memória, número de nós/features/tiles e zoom; rejeitar blobs comprimidos malformados.
- Fontes HTTP HTTPS (localhost somente em desenvolvimento), sem credenciais/query, paths relativos seguros, Range/Content-Range verificável, SHA-256 final e tamanho exato.
- Chunks em IndexedDB separado; nenhuma ativação antes de validar manifest e bytes. Pacote antigo preservado quando nova instalação falha.
- Limite temporário de rede de 64 MiB por incompatibilidade atual do validador com streaming completo; import local legado mantém seus limites atuais.
- Não copiar código GPL, não redistribuir arquivos de dados Organic Maps, atribuição OSM obrigatória.

## Critérios de aceite

- Dado PBF com geometrias suportadas e `region.json`, gerar `package.pmtiles` contendo MVT reais, `style.json`, sprites e `manifest.json` com SHA-256 e tamanhos coerentes.
- Pacote/estilo offline não requisitar recursos remotos ao desenhar camadas implementadas.
- O download interrompido reaproveita chunks persistidos, rejeita servidor fraudulento, arquivo adulterado e não toca pacote ativo.
- Gerenciamento não afirma reparo se bytes estiverem corrompidos.
- `version.json` é versionado no cache do shell; alterar `index.html` muda versão do cache.

## Testes, QA e documentação

- Rodar `node --check` scripts; `node --test` novos testes de PMTiles, pipeline, Range e manifest.
- Validar sintaxe TypeScript, e testes/compilação completos no monorepo quando checkout/dependências disponíveis.
- Faltam: PBF real de área delimitada com relações, leitor PMTiles independente, validação IndexedDB em Chrome/iOS WebKit, E2E PWA/safe-restart, lint/typecheck/build globais.
- Registrar resultados executados e NÃO executados; não marcar MM-MAP-200/130/940 como concluídos com evidência apenas sintética.

## Regras de Git, ações proibidas e riscos

- Isolar mudanças em branch de agente; PR apenas para `feat/maps-engine-v2-offline`, nunca `main` até QA.
- Não realizar deploy público, publicar em loja, criar tag/release, migration destrutiva, forçar push, remover dados reais ou alterar secrets.
- Riscos: relações OSM não renderizadas, memória/armazenamento de regiões grandes, exceções de CORS/HTTP Range e versão de protocolo PWA incompatível.

## Relatório final esperado

`RESULTADO`, `ALTERAÇÕES`, `ARQUIVOS`, `VALIDAÇÃO EXECUTADA`, `VALIDAÇÃO NÃO EXECUTADA`, `LICENÇAS`, `RISCOS/PENDÊNCIAS` e `PRÓXIMO TASK ID`.
