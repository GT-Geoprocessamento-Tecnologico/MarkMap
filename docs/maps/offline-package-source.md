# G0.5 — fonte e pacote de mapa offline

**Task:** `GEO-G0.5-MAP-RESEARCH-01`  
**Data da pesquisa:** 2026-09-30  
**Status do gate:** `PASS` para o W0 executado (artefatos permanecem temporários)

## Decisão provisória

O candidato técnico e jurídico é um recorte regional do **Protomaps Basemap v4**
(PMTiles vetorial derivado de OpenStreetMap), para Brasília e entorno, com a
seguinte caixa inicial de teste em WGS84: `[-48.40, -16.20, -47.20, -15.30]`
(`west, south, east, north`). O recorte deve ser gerado localmente a partir de
um build versionado, usando o comando de extract do PMTiles/Protomaps, e depois
armazenado como um único arquivo PMTiles local.

Esta seleção foi seguida por uma prova W0, documentada nas seções abaixo. O
archive Protomaps foi lido por HTTP range e o recorte PMTiles regional, os
assets locais, o manifesto e os renders DPR 1/2 foram produzidos em diretório
temporário fora do checkout. O W0/G0.5 passa para viabilidade da fonte e do
conjunto de ativos. Isso não aprova a integração no produto: instalador,
armazenamento, protocolo, ativação e testes de quota/truncamento continuam
pendentes.

## Fontes primárias e termos verificados

| Item | Evidência verificada em 2026-09-30 | Consequência para GeoNexo |
| --- | --- | --- |
| Dados OSM | [OSM copyright/licença](https://www.openstreetmap.org/copyright/All): ODbL 1.0, atribuição obrigatória e disponibilidade da licença; dados derivados devem preservar a obrigação de atribuição e share-alike aplicável. | O pacote precisa exibir `© OpenStreetMap contributors` e link para a licença/copyright. Incluir licença/proveniência junto ao pacote. |
| Recortes de entrada alternativos | [Geofabrik download/licença](https://www.geofabrik.de/data/download.html): extratos OSM são gratuitos, derivados sob ODbL 1.0 e podem ser usados desde que OSM seja reconhecido; o servidor oferece regiões e PBF, mas não entrega o PMTiles final do GeoNexo. | Geofabrik é uma fonte operacional possível para preparar o recorte. Registrar URL/versão/data do PBF usado quando a prova for executada. |
| Protomaps Basemap | [Downloads](https://docs.protomaps.com/basemaps/downloads): basemap é um Produced Work ODbL, há builds v4 e hashes BLAKE3, e o `pmtiles extract` gera recortes regionais; o planet inteiro é aproximadamente 120 GB e z0–15. | Usar build v4 pinado e extrair somente a caixa/zooms aprovados. Copiar o arquivo para armazenamento próprio; não depender de hotlink em runtime. |
| Estilos e tiles | [repositório basemaps](https://github.com/protomaps/basemaps): tiles ODbL/OSM, design CC0, código BSD-3-Clause, ícones de estilos específicos derivados de Tangram Icons/MIT; a atribuição de OSM é exigida para mapas derivados. | O pacote deve guardar o JSON de estilo exato e as notas/licenças correspondentes. Não misturar estilos OpenMapTiles sem revisar licença. |
| Glyphs e sprites | [basemaps-assets](https://github.com/protomaps/basemaps-assets): `fonts/` sob SIL Open Font License e `sprites/` derivados de Tangram Icons/MIT; [MapLibre glyphs](https://maplibre.org/maplibre-style-spec/glyphs/) exige URL template por `fontstack/range`; [sprites](https://maplibre.org/maplibre-style-spec/sprite/) exige `.json` e `.png`, incluindo `@2x` quando aplicável. | Copiar para o pacote somente os font stacks/ranges e sprites realmente referenciados pelo estilo, com os avisos de licença. O estilo offline não pode continuar apontando para `https://`. |
| Formato/cliente | [PMTiles v3 spec](https://github.com/protomaps/PMTiles/blob/main/spec/v3/spec.md): arquivo único com header de 127 bytes, diretório raiz nos primeiros 16 KiB, metadados JSON e zoom/bounds no header; [PMTiles JS README](https://github.com/protomaps/PMTiles/blob/main/js/README.md): `Protocol` integra com MapLibre; [changelog](https://github.com/protomaps/PMTiles/blob/main/js/CHANGELOG.md): 4.5.0 é a versão mais recente documentada na fonte consultada, suporta PMTiles v3 e `FileSource` existe desde 3.0.1. | Fixar a versão de `pmtiles` somente após aprovação do contrato e adicionar prova com bytes locais/FileSource. O workspace hoje usa `maplibre-gl` 6.11.2, mas não possui `pmtiles` instalado; isso não é evidência de integração. |
| Limitação do provider atual | [OpenFreeMap ToS](https://openfreemap.org/tos/), atualizado em 2026-09-09, proíbe coleta automatizada sem permissão e reserva disponibilidade sem garantia. | A URL pública OpenFreeMap usada no código atual não é fonte aprovada para capturar tiles em cache. Seu estilo/serviço não fecha G0.5; self-hosting só pode ser considerado após revisar o artefato e a licença de cada componente. |

## Grafo de ativos que precisa estar local

O `OfflineMapPackageManifest` congelado pelo G0.2 é a única forma de declarar
esse conjunto. Este documento não cria um tipo ou wire shape alternativo.

```text
manifest (G0.2; ainda ausente neste checkout)
├── package.pmtiles                 # vector tiles; PMTiles v3
├── style.json                      # MapLibre Style v8, sem URLs remotas
├── glyphs/{fontstack}/{range}.pbf  # somente ranges/font stacks referenciados
├── sprites/light.json
├── sprites/light.png
├── sprites/light@2x.json           # se o estilo/runtime usar alta densidade
├── sprites/light@2x.png
├── LICENSES/                       # ODbL/OSM, BSD-3, CC0, OFL, MIT aplicáveis
└── attribution.html                # OSM + links de licença e Protomaps
```

O `style.json` deve referenciar o arquivo PMTiles por protocolo/adapter local,
os glyphs por template local e os sprites por prefixo local. A inspeção do
estilo deve falhar se ainda houver URL `http://` ou `https://` em `sources`,
`glyphs`, `sprite` ou imports. A atribuição precisa continuar visível quando a
rede estiver desligada.

## Evidência local disponível

| Prova exigida pelo W0/G0.5 | Estado atual | Próxima evidência exata |
| --- | --- | --- |
| Região e producer | `PASS`: Protomaps build `20260930`, bbox Brasília/entorno registrada. | Repetir com novo build somente quando for necessária atualização de dados. |
| Bytes/zoom/bounds | `PASS`: 4,300,633 bytes; PMTiles v3 MVT; z0–12; bounds registradas. | Preservar esses valores no manifesto/artefato distribuído. |
| Integridade | `PASS`: `pmtiles verify` exit 0; SHA-256 registrado. | Recalcular após qualquer cópia/atualização. |
| Grafo de ativos | `PASS`: estilo, 6 glyph ranges, 4 sprites e licenças locais; manifesto G0.2 validado. | Distribuir o conjunto como unidade, sem URLs de recursos externos. |
| Render sem rede | `PASS`: MapLibre DPR 1 e DPR 2; requests externos vazios; console sem erros. | Repetir em QA no build integrado antes de publicação. |
| Limites operacionais | `PASS` para o limite de 250 MiB: total manifestado 5,244,214 bytes. | Exercícios de quota/truncamento/path traversal permanecem gates de implementação do instalador. |

## Conclusão e bloqueio

O ODbL permite a redistribuição do dado OSM com atribuição, e Protomaps
documenta builds/recortes PMTiles adequados ao modelo regional. A prova W0
usou exclusivamente o archive publicado do Protomaps por HTTP range, sem
capturar tiles de um provider XYZ ou depender de OpenFreeMap.

O W0/G0.5 passa com o recorte regional, fonte licenciada, manifesto único,
assets locais, hashes e renderizações DPR 1/DPR 2 sem requests externos. A
aplicação integrada ainda precisa consumir este manifesto e preservar os
limites de quota/ativação definidos no plano; isso não altera a evidência deste
gate de pesquisa.

## Comandos e pesquisa executados

- `git status --short`, inspeção de `packages/maps/package.json`, lockfile e
  referências de PMTiles/OfflineMapPackageManifest.
- `rg` no PRD, especificação e planos para G0.2/G0.5 e o contrato único.
- Pesquisa/leitura das fontes primárias vinculadas acima em 2026-09-30.
- O archive regional e os assets foram baixados somente para o diretório
  temporário documentado; nenhuma escrita externa, alteração de código,
  manifest ou lockfile do workspace foi executada.

## W0 — tentativa de prova executada (2026-09-30)

Após a revisão de G0.2, a tentativa foi feita em um diretório temporário
isolado, fora do checkout: `C:\Users\MATEUS\AppData\Local\Temp\geonexo-g05-b5af6f8a6cab4b4cbde973301ed06453`.
Naquele ponto da tentativa inicial, o diretório continha somente os tarballs
de investigação. As etapas posteriores abaixo reutilizaram o mesmo diretório
temporário para archive, manifesto, assets e renders; todo o conteúdo continua
fora do checkout e pode ser descartado sem alterar o workspace.

Comandos e resultados:

```text
npm pack pmtiles@4.5.0 --pack-destination <tmp>       exit 0
npm pack @protomaps/basemaps@5.7.2 --pack-destination <tmp>  exit 0
java -version                                         1.8.0_491
Get-Command pmtiles                                   MISSING
Get-Command tippecanoe                                MISSING
Get-Command mvn                                       MISSING
rg --files -g '*.pmtiles' -g '*.mbtiles' ...          0 arquivos no checkout
```

`pmtiles@4.5.0` contém leitor, `Protocol` e adapters, mas não um escritor ou
comando de extração; `@protomaps/basemaps@5.7.2` contém apenas estilos/código
de camadas, não tiles. O builder Protomaps documentado requer Java 21+; o único
Java disponível é 8. A URL pública de builds consultada foi apenas verificada
com `HEAD`; não foi baixado nenhum archive nem tile.

**Resultado da tentativa inicial (superseded):** naquele ponto não havia um
produtor PMTiles instalado, Java 21/Planetiler ou archive regional local. A
tentativa foi encerrada sem alterar o workspace. A subseção seguinte registra
o caminho oficial que resolveu essa limitação por extração remota HTTP range.

O bloqueio de ferramenta da tentativa inicial não é mais atual. O estado
corrente deve ser lido na evidência de extração, manifesto e render abaixo.

## W0 — extração regional por HTTP range (evidência adicional)

A alternativa oficial foi executada com sucesso em 2026-09-30, ainda somente
no diretório temporário acima. A documentação do [CLI PMTiles](https://docs.protomaps.com/pmtiles/cli)
confirma que o binário é único, sem dependências externas, aceita archives HTTP
remotos e suporta `extract --bbox`/`--maxzoom`. A release oficial pinada foi
`protomaps/go-pmtiles v1.31.2`, asset
`go-pmtiles_1.31.2_Windows_x86_64.zip` (download temporário; não entrou no
workspace).

Fonte publicada e limites observados:

```text
source = https://build.protomaps.com/20260930.pmtiles
source Content-Length = 138478612042 bytes (138.48 GB)
source Accept-Ranges = bytes
source ETag = "ea4995cd08c2e139934ebd2be5e60577-516"
```

Comando exato:

```text
pmtiles.exe extract https://build.protomaps.com/20260930.pmtiles \
  brasilia-z12.pmtiles \
  --bbox=-48.40,-16.20,-47.20,-15.30 \
  --maxzoom=12 --overfetch=0
exit = 0
```

O CLI reportou 5 diretórios, 229 tiles/entries e aproximadamente 4.1 MB
transferidos em 30 requests de chunks. O arquivo resultante foi validado com
`pmtiles show` e `pmtiles verify`:

```text
archive bytes       = 4,300,633
PMTiles spec        = 3
tile type           = mvt
bounds              = (-48.400000,-16.200000) .. (-47.200000,-15.300000)
minzoom/maxzoom     = 0 / 12
addressed/entries   = 229 / 229
compression         = internal gzip, tile gzip
verify exit         = 0
SHA-256             = 035EB103C8D5F7FC7D153AFDECE190B45FD2343B65D2543726EEAFC40C6F3FA6
```

O metadata local preserva `type=baselayer`, `name=Protomaps Basemap`,
`version=4.15.2`, `planetiler:buildtime=2026-03-28T14:41:39.524Z`,
`planetiler:osm:osmosisreplicationtime=2026-09-30T04:00:00Z` e a atribuição
`<a href="https://www.openstreetmap.org/copyright" target="_blank">&copy; OpenStreetMap</a>`.
O build é explicitamente um Produced Work ODbL conforme a documentação do
Protomaps; a atribuição OSM continua obrigatória.

## W0 — estilo, assets, manifesto e renderização

O estilo foi gerado com `@protomaps/basemaps@5.7.2`, flavor `light` e idioma
`pt`, usando as camadas do mesmo schema v4 do archive. Para manter os caminhos
compatíveis com o `OfflineMapPackageManifest` congelado pelo G0.2, os três
font stacks foram materializados localmente com nomes POSIX sem espaços:
`Noto-Sans-Regular`, `Noto-Sans-Medium` e `Noto-Sans-Italic`. Foram baixados
somente os ranges `0-255` e `256-511`, além de `light.json`/`light.png` e
suas variantes `light@2x.json`/`light@2x.png`, do
[repositório oficial basemaps-assets](https://github.com/protomaps/basemaps-assets).
Os avisos foram guardados em `LICENSES/` no diretório temporário:
OFL, licença do basemap, licença de dados e atribuições.

O manifesto temporário foi validado diretamente contra
`packages/contracts/src/offline-map.ts` (sem declarar um tipo concorrente):

```text
manifest schema parse = success=true
archive + style + glyphs + sprites = 5,244,214 bytes
manifest assets = 11 (1 style + 6 glyph ranges + 4 sprites)
archive = 4,300,633 bytes; SHA-256 = 035EB103C8D5F7FC7D153AFDECE190B45FD2343B65D2543726EEAFC40C6F3FA6
```

O harness MapLibre usou `maplibre-gl@6.11.2` e `pmtiles@4.5.0` copiados
temporariamente, um servidor local com suporte a byte ranges e Playwright
1.63.0. A política do navegador abortou todo request fora de
`127.0.0.1:8765`/`127.0.0.1:8766`. Resultado:

```text
map loaded = true
map error = null
external requests = []
console errors = []
local resource requests = style.json, 4 PMTiles ranges,
  sprites/v4/light.json, sprites/v4/light.png,
  Noto-Sans-{Regular,Medium,Italic}/0-255.pbf
render screenshot = render.png (575,884 bytes)
render SHA-256 = 579188C64F933C3042C0C51D1D4F826CD31C73EB028A0EF1F7251507B6446EA5
```

O render em DPR 1 está comprovado com geometria, labels e sprite local. O
mesmo harness foi repetido com o contrato G0.2 atualizado para aceitar `@` nos
segmentos POSIX:

```text
deviceScaleFactor = 2
map loaded = true
map error = null
external requests = []
console errors = []
requested sprites = light@2x.json, light@2x.png
requested glyphs = Noto-Sans-{Regular,Medium,Italic}/0-255.pbf
render screenshot = render-dpr2.png (1,074,186 bytes)
render SHA-256 = C8DC9068DB3DA5FBB80B491673555775E5C8C058B2D109129004DB47A86E7917
```

O bloqueio anterior de caminhos `@2x` está superseded pelo contrato atual e
pela execução DPR 2 bem-sucedida. O W0 agora tem evidência de archive, estilo,
glyphs, sprites, manifesto e renderização sem rede no diretório temporário.
Os artefatos permanecem fora do checkout e este documento não publica binários
grandes.

## W0 — prova reprodutível no checkout

O checkout mantém somente um fixture pequeno e não distribui o archive PMTiles
regional nem os assets baixados. `packages/maps/tests/fixtures/offline/` registra
o manifesto canônico, um estilo sem URLs remotas e uma variante deliberadamente
inválida. O teste lê o schema já construído de `@geonexo/contracts` e cobre:

Os SHA-256 dos glyphs e sprites no `manifest.json` são placeholders estruturais
e estão identificados como tal pelo próprio caráter de fixture; eles não são
hashes dos assets temporários do W0 e não podem ser usados para ativação ou
distribuição. O único digest de archive registrado no fixture é a evidência do
recorte regional temporário, enquanto o arquivo PMTiles correspondente continua
fora do checkout.

O teste de sucesso usa um buffer sintético de 127 bytes com cabeçalho PMTiles v3
e seções de comprimento zero. Ele prova somente a validação mínima de cabeçalho,
limites declarados, hashes e referências; não prova que esse buffer seja um
archive renderizável. A prova de archive real, `brasilia-z12.pmtiles`, seus
assets e os renders DPR 1/2 permanece separada nesta documentação como evidência
temporária do G0.5.

- bounds, zooms, bytes, SHA-256 e atribuição OSM do recorte regional;
- rejeição de `../` antes da ativação;
- rejeição de fontes, glyphs e sprites HTTP(S);
- detecção de digest diferente e limites de truncamento/250 MiB.

Prova executada em 2026-09-30:

```text
pnpm --filter @geonexo/contracts build                         exit 0
pnpm --filter @geonexo/maps exec vitest run tests/fixtures/offline/offline-package-fixture.test.ts --reporter=verbose
7 tests passed
pnpm --filter @geonexo/maps typecheck                          exit 0
pnpm --filter @geonexo/maps lint                               exit 0
git diff --check -- packages/maps/src/experimental packages/maps/tests/fixtures/offline docs/maps/offline-package-source.md  exit 0
```

Smoke separado contra os artefatos reais ainda disponíveis no diretório
temporário do G0.5 (`manifest.json`, `brasilia-z12.pmtiles`, style, glyphs e
sprites) retornou `FAIL — external-style-resource`. O archive e os assets foram
lidos diretamente, sem cópia para o checkout; o style temporário aponta para
`pmtiles://http://127.0.0.1:8766/brasilia-z12.pmtiles`, enquanto o validador
aceita somente `pmtiles://package.pmtiles`. Essa falha é intencional e impede
ativação até o estilo ser reescrito para o protocolo local do pacote.

Essa prova não substitui o W2: ainda faltam o instalador/armazenamento
transacional, leitor PMTiles integrado, verificação dos bytes reais no momento
da ativação e nova renderização do build integrado com a rede bloqueada.
