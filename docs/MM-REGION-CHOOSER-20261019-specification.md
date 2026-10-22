# MM-REGION-CHOOSER-20261019 — estados, cidades e fila offline

**Status: SPECIFICATION GATE — DONE (bounded first slice; publication QA remains).** O app
já permite buscar e baixar regiões publicadas por nome e reutiliza
`RegionDownloadCatalog`, `installCatalogRegion`, `ResumableInstaller` e o
`OfflineMapStore`. No início desta tarefa, o catálogo continha somente Araguaína; não há base
licenciada suficiente para prometer todos os estados/cidades do Brasil.

## Objetivo delimitado

Permitir escolher estado e cidade entre entradas reais publicadas no catálogo,
selecionar uma ou mais cidades e enfileirar downloads offline. Cada pacote
continua passando pelo manifest HTTPS/CORS, validação de id/bounds/bytes,
SHA-256, quota, checkpoints, staging e ativação já existentes. A fila deve ser
serial por padrão para limitar memória, rede e concorrência IndexedDB; a
instalação ativa somente um pacote por operação e preserva os anteriores.

## Grafo proposto e propriedade

1. **Data/proveniência** — publicar somente pacotes regionais reais, licenciados
   e verificáveis. Definir fonte, data, licença/attribution, bounds, bytes,
   manifest HTTPS e SHA para cada entrada. O alvo de planejamento é uma fatia
   inicial de 27 visões estaduais em z9 e 27 capitais em z12, mais Araguaína,
   com zoom e tamanho limitados. A viabilidade foi comprovada no artefato
   `QAroot/catalog-feasibility/catalog-feasibility.json`: TO z9 possui 1.803.055
   bytes, SHA-256
   `2F677AAE53B86E6E6400F66F06B3F3043F1B7BD3C6B004D7CFCB03EACD935176`, e
   Palmas z12 possui 686.728 bytes, SHA-256
   `96B3304DC00ECA9E1F85097A0DB52516CB96BAA0BBABA46909315F11073554EC`.
   A lista final continua limitada a pacotes cuja fonte, licença, bounds e
   materialização foram verificadas; não gerar uma lista sem pacote.
2. **UI catalog builder** — adicionar estado/cidade derivados das entradas do
   catálogo, filtro acessível e seleção múltipla. Reutilizar classes e a
   implementação `RegionDownloadCatalog`; não duplicar Settings/mapa nem criar
   uma API paralela.
3. **Fila installer builder** — transformar a ação de download em fila serial
   de IDs selecionados, chamando `installCatalogRegion`/`ResumableInstaller`
   por item. Expor progresso por item, sucesso/erro individual, cancelamento
   do atual e remoção dos pendentes. Não substituir storage, installer ou
   checkpoint DB.
4. **QA independente** — testar catálogo vazio/inválido, filtro sem resultado,
   seleção múltipla, ordem serial, cancelamento, retry de checkpoint, quota,
   offline, falha de um item sem apagar os anteriores e seleção persistida.
   Validar a mesma implementação no mapa e em Settings.

## Propriedade exclusiva e política da fila

- **Data builder** — pode escrever somente `public/offline/` e novos artefatos
  regionais, `public/maps/catalog.json`, `public/maps/locations.json`,
  `scripts/publish-brazil-regions.mjs`, `docs/region-package-provenance.json`
  e a adição correspondente em `THIRD_PARTY_NOTICES`. Os bytes de Araguaína
  devem ser preservados.
- **UI builder** — após o gate de dados, pode escrever somente
  `components/map/RegionDownloadCatalog.tsx` e
  `lib/storage/region-location-index.ts` com seus testes. O índice deve usar
  fetch same-origin limitado a 64 KiB e no máximo 100 localizações, com
  fallback seguro quando ausente.
- **Queue builder** — pode escrever somente
  `lib/storage/catalog-download-queue.ts` e seu teste. O helper deve ser puro,
  serial e ter interface estável para a UI; não altera banco ou schema.
- **QA/review** — roda depois da integração, em terminal independente, sem
  assumir sucesso por declaração do builder.

A seleção é congelada durante a fila e os controles de download ficam
desabilitados enquanto qualquer item estiver ativo. A soma total e o progresso
por item devem permanecer visíveis. A fila deduplica IDs, não inclui pacotes
intermediários e instala em série. Se todos terminarem, o primeiro pacote novo
é selecionado no mapa; em erro ou cancelamento, o mapa ativo anterior é
preservado e os itens concluídos continuam instalados. Cancelamento não pode
interromper ativação atômica. Desmontagem aborta a fila/solicitação atual,
preservando checkpoints. O comportamento existente de autodownload individual
permanece; uma fila manual tem prioridade e impede concorrência.

## Contratos e limites

- O schema do catálogo v1 deve permanecer estrito, retrocompatível e limitado
  a 100 entradas; não adicionar campos a cada entrada, pois clientes antigos
  rejeitam propriedades desconhecidas. Metadados de seleção devem viver em um
  índice separado e limitado, por exemplo `/maps/locations.json`, com
  `regionId`, UF, nome do estado, cidade e tipo (`capital`, `estado` ou
  `cidade`). O parser deve continuar aceitando catálogo antigo sem esse índice
  e nunca inferir estado/cidade de texto livre. O índice só pode apontar para
  IDs presentes no catálogo validado.
- O índice geográfico separado deve obedecer exatamente a
  `{version: 1, locations: [{regionId, stateCode, stateName, kind, cityName?}]}`;
  `kind` é `state` ou `city`, IDs são únicos, o arquivo fica limitado a 100
  locais e 64 KiB, e referências desconhecidas são rejeitadas. O catálogo v1
  existente permanece sem alterações.
- Busca atual sem acentos permanece; estado/cidade devem ter labels PT-BR e
  IDs estáveis. Não alterar IDs de pacotes, manifest, URLs, bancos, storage
  keys, outbox, GPS, GeoPDF ou importação.
- Uma fila em andamento bloqueia novas filas conflitantes; cancelamento deve
  abortar fetch/checkpoint do item atual e deixar itens pendentes removíveis.
  Nunca cancelar durante ativação atômica; falhas não removem mapa ativo.
- Offline sem checkpoint suficiente deve produzir mensagem acionável e manter
  pacotes já instalados. Quota deve parar antes de iniciar item que não cabe,
  sem apagar mapas antigos automaticamente.
- Componentes opcionais de manifest continuam governados pelo validator; a UI
  não pode declarar rotas, busca, labels ou altitude quando o pacote não os
  possui.

## Gate de dados e aceitação

O gate foi satisfeito para esta fatia limitada pela prova de dois pacotes
regionais reais além de Araguaína, com fonte oficial, bounds, bytes e hashes
registrados no artefato de viabilidade. A publicação final ainda exige URL
HTTPS/CORS, índice referenciando apenas IDs publicados e QA dos pacotes. Isso
não autoriza declarar cobertura de todos os municípios brasileiros.

Após a convergência de dados, a aceitação exige: seleção de estado/cidade real;
download de pelo menos dois pacotes em fila serial; progresso e cancelamento
observáveis; reload preservando instalações; falha/quota/offline sem perda de
pacote ativo; SHA e attribution exibidos; e regressão no fluxo atual de
Araguaína. QA deve incluir typecheck, lint, build, testes focados, browser
real e revisão independente. Nenhuma mudança de site, PWA identity ou
infraestrutura é autorizada por este rascunho.
