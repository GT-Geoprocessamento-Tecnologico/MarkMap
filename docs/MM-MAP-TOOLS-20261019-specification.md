# MM-MAP-TOOLS-20261019 — inventário e correção delimitada

Status: SPECIFICATION GATE — DONE para correções de UX e estados de capacidade; enriquecimento opcional de índice permanece separado.

## Objetivo

Tornar previsíveis as ferramentas já existentes do mapa e corrigir dois relatos:
busca de endereço silenciosa/indisponível e regiões baixadas que não aparecem ou não carregam.
Preservar IDs, tema, dados locais, GPS, GeoPDF, importações, outbox, storage e o
front atual. A especificação não promete nomes, rotas, busca ou altitude quando o pacote não declara esses componentes. Os tiles locais podem expor nomes já decodificados na área visível, sem prometer busca mundial ou endereços residenciais.

## Inventário atual

A barra "Atalhos do mapa" contém Telemetria; Camadas; Filtros; Ferramentas
(medir distância, minha localização, exportar GeoJSON, copiar coordenadas e
importar dataset); Baixar mapas; Buscar locais neste mapa; Lugares e transporte
offline; Altitude offline; Navegação GPS offline; Minha localização; Medir
distância; Adicionar ponto; Desenhar linha; Desenhar polígono.

A busca local usa worker sobre feições do projeto e registros regionais. Quando há índice regional autoritativo, ele mantém prioridade; o fallback de nomes dos tiles visíveis só é usado quando não há registros regionais, preservando o orçamento combinado do worker. O
loader regional só lê searchShards da revisão ativa e valida geração, tamanho,
quantidade e formato. Os pacotes publicados não oferecem índice completo de endereços, rotas ou DEM. O adapter local consulta apenas nomes já decodificados dos tiles PMTiles visíveis, limitado e deduplicado; isso não promete busca mundial ou endereços residenciais. A busca de endereço
depende de configuredAddressSearchEndpoint; sem provedor autorizado a UI deve
informar que não está configurada, sem simular geocodificação.

O mapa escolhe a revisão pelo ID persistido em selected-offline-map. O
CommandCenter lê revisão ativa e assets por geração; ausência de revisão, estilo
ou PMTiles deve gerar erro visível e oferecer fundo simples offline quando
aplicável. GeoPDF tem precedência. Região baixada só fica ativa após ativação
atômica e seleção explícita.

## Correções bounded

1. Busca: exigir ação explícita de pesquisar ou Enter, mostrar estado buscando,
   sem índice, sem provedor, vazio e erro; cancelar respostas obsoletas; manter
   fallback de feições do projeto e erro acionável quando o worker falhar.
2. Catálogo: mostrar contagens de disponíveis/instalados, ordenar instalados
   depois das regiões ainda não instaladas, preservar filtros e oferecer limpar,
   retry e indicação de carregamento/rolagem. Não alterar o fluxo individual,
   fila, IDs ou storage.
3. Capacidades: painéis offline devem informar pré-requisitos e desabilitar
   entradas inertes quando o manifest não declara busca, lugares, DEM/contornos
   ou grafo de rota. Não inventar nomes, rotas, altitude ou conteúdo.
4. Mapa instalado: validar ID, geração, manifest e assets antes de substituir
   a revisão ativa; erro preserva mapa anterior e apresenta ação concreta.

## Matriz de aceitação

| Fluxo                                  | Resultado esperado                                                                                                                                  |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| Busca com Enter/botão                  | estado de busca, resultados ou vazio explícito; Araguaína deve localizar Avenida Filadélfia a partir dos tiles locais e permitir centralizar        |
| Busca sem searchShards                 | busca de feições do projeto e nomes dos tiles visíveis; aviso de índice regional ausente                                                            |
| Busca sem endpoint                     | aviso de provedor não configurado                                                                                                                   |
| Busca com endpoint autorizado          | resultado, cancelamento e erro acionáveis                                                                                                           |
| Região instalada                       | contagem, ordenação e seleção ativa após reload                                                                                                     |
| Região ausente/incompleta              | erro visível e mapa anterior preservado                                                                                                             |
| Painel sem capacidade                  | pré-requisito visível, controles inertes desabilitados                                                                                              |
| Painel com capacidade                  | conteúdo validado e uso offline sem rede                                                                                                            |
| Desenho, medir, GPS, camadas e filtros | fluxos atuais preservados em tema claro/escuro                                                                                                      |
| Fila e download individual             | regressão do installer/checkpoint/quota e cancelamento                                                                                              |
| Projeto → Abrir mapa                   | mantém `projectId`, exibe as camadas locais desse projeto e grava novos desenhos/importações no mesmo projeto; não cai em `/workspace` sem contexto |

## Propriedade e grafo

- Search specialist: somente OfflineSearch.tsx, address-geocoder.ts, map-search.worker.ts e o adapter local de tiles visíveis (visible-map-search.ts, use-visible-map-search.ts), mais testes focados. Não criar provedor ou segredo.
- Catalog specialist: somente RegionDownloadCatalog.tsx e seus testes; contagens,
  ordenação, retry, filtros e rolagem, sem alterar queue/storage.
- Capability specialist: somente OfflineKnowledge.tsx, OfflineElevation.tsx,
  OfflineRouting.tsx e testes; mensagens/disabled derivados do manifest.
- Recovery specialist: somente offline-map-recovery.mjs, CommandCenter recovery
  path e testes, se diagnóstico demonstrar falha real; não alterar schema.
- Project-context specialist: somente `apps/admin/src/pages/projects/ProjectPage.tsx`
  e seu teste; o link "Abrir mapa" deve usar a rota parametrizada do projeto
  (`/projects/$projectId/map`) e preservar o contexto para camadas e desenhos.
- QA independente: toolbar real no mapa, 20 arquivos/3 mapas instalados,
  reload/reabertura, offline, provider off e tema. Root integra.

## Gates e riscos

O gate está DONE para estas correções limitadas porque os sintomas e capacidades foram observados no app nativo: provider de endereço desligado, busca sem índice regional e painéis de capacidades ausentes. A integração aprovada consulta apenas nomes dos tiles PMTiles locais visíveis, limitada a 2.000 registros e 20.000 feições, e descarta o índice ao mudar revisão, estilo, região ou GeoPDF. Ela deve localizar, por exemplo, Avenida Filadélfia em Araguaína e oferecer posição aproximada de vias, sem prometer endereços residenciais, geocodificação arbitrária ou índice completo de ruas.

Parar se a correção exigir novo backend, mudança de IDs/schema/SW/storage, acesso
a credenciais, ou declarar que PMTiles fornece busca mundial, endereços residenciais, rotas, altitude ou lugares sem os componentes correspondentes. A aceitação final requer typecheck, lint, build, testes
focados, revisão independente e browser/native no mapa real.
