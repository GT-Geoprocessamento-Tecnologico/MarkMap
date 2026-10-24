# Versões do MarkMap

Fonte da versão do aplicativo: `apps/admin/package.json`. Todos os agentes seguem [a política de versionamento](docs/versioning.md). O [histórico documental anterior](docs/changelog.md) permanece preservado.

## [0.5.6] - 2026-10-24

### Alterações

- Integra melhorias auditadas dos PRs #13, #16 (com correção de reassociação de fotos), #17, #18-#22, #25-#28, #30-#33 e #35, preservando a arquitetura offline-first.
- Corrige geração de IDs inseguros, endurece validação de token de capacidade e mantém compatibilidade de armazenamento local.
- Refatora importação/conversão GPX, hooks locais de camada/feição e busca visível sem alterar contratos; otimiza filtros das telas de projetos e CRS.
- Amplia regressões de CORS, saúde da API, logs, identificador de solicitação, capabilities, assinaturas S3 e índice de fotos.
- Mantém PRs de alto risco (#15 GeoPDF, #36 sync transacional) fora do release até teste específico.

### Validação

- QA integrado Vercel Hobby (`dpl_9EJimBLHxegu4QwsJs96BrcnfgMF`): **20/20 tarefas Turbo aprovadas**, incluindo lint, typecheck, testes unitários e build dos pacotes API, banco, GIS e frontend.
- Testes observados: **246 mapas, 291 frontend, 92 API e 15 banco** aprovados; 26 testes de integração PostGIS foram ignorados por falta de banco de teste, e QA físico Android/iOS não foi executado nesta entrega.
- Testes adicionais cobrem reassociação de fotos, capability, CORS, request IDs, saúde da API e URLs assinadas S3. Sem migração de schema ou limpeza de dados locais.

## [0.5.5] - 2026-10-23

### Alterações

- Update version to publish changes as requested by user.

### Validação

- TypeScript e ESLint aprovados, testes unitários aprovados.

## [0.5.4] - 2026-10-23

### Alterações

- Corrige o bloqueio de compilação TypeScript em SIGEF, testes de datum e formulários ambientais.
- Corrige classificação de pontos virtuais no SIGEF, preservando os tipos M, P e V.
- Impede importações GeoPackage que retornavam sucesso sem carregar feições; arquivos ainda não suportados agora recebem erro explícito.
- Rejeita CRS Shapefile desconhecido e geometrias não compatíveis, evitando georreferenciamento incorreto e perda silenciosa de dados.
- Remove 15 erros de ESLint dos módulos cartográficos, com tipagem explícita de CAR, SIGEF, datums, formulários e geofencing, sem alterar o armazenamento IndexedDB.

### Validação

- Execução isolada no build da Vercel Hobby: 247 testes Vitest de mapas e 291 testes Vitest do frontend aprovados.
- TypeScript dos pacotes de mapas e do aplicativo aprovado; ESLint em mapas e frontend com zero erros e seis avisos já existentes no frontend.

## [0.5.3] - 2026-10-23

### Alterações

- Integra suporte dinâmico a qualquer código EPSG via Proj4js em @markmap/maps com reprojeção de coordenadas e FeatureCollections GeoJSON.
- Conecta o parser de Shapefiles (.shp, .dbf, .prj em ZIP) e GeoPackage (.gpkg com WKB e cabeçalho binário OGC) ao ecossistema de mapas offline e fontes vetoriais.
- Valida 100% das suítes de testes unitários dos módulos de CRS, formatos vetoriais, GNSS/NMEA, unidades de agrimensura e geofencing (Fases 1 a 4).

### Validação

- 38 arquivos de teste e 224 testes aprovados em @markmap/maps com cobertura total dos novos módulos.
- Build de produção gerado com sucesso para a versão 0.5.3 e verificação estrita de release guard aprovada.

## [0.5.2] - 2026-10-23

### Alterações

- Integra suporte dinâmico a qualquer código EPSG via Proj4js em @markmap/maps com reprojeção de coordenadas e FeatureCollections GeoJSON.
- Conecta o parser de Shapefiles (.shp, .dbf, .prj em ZIP) e GeoPackage (.gpkg com WKB e cabeçalho binário OGC) ao ecossistema de mapas offline e fontes vetoriais.
- Valida 100% das suítes de testes unitários dos módulos de CRS, formatos vetoriais, GNSS/NMEA, unidades de agrimensura e geofencing (Fases 1 a 4).

- Oculta os pontos de apoio e marcos dos vértices por padrão ao carregar datasets com polígonos (KML/KMZ/GeoJSON), evitando que círculos nos vértices prejudiquem a visualização da área demarcada.
- Adiciona controle dedicado de visibilidade de pontos e marcos no painel de camadas do mapa quando o dataset ativo possui feições pontuais, permitindo ligar ou desligar os pontos com um clique.
- Mantém a exibição padrão de pontos para datasets que contenham exclusivamente feições pontuais (waypoints, estações, pontos de interesse).
- Preserva a consulta offline por nomes e atributos na busca de feições e o clique na área demarcada para visualização do popup de propriedades sem interferência dos vértices.

### Validação

- 7 testes unitários em `map-data.test.ts` cobrindo detecção de polígonos, detecção de pontos, regras de visibilidade padrão e filtragem de feições pontuais.
- 60 suítes de testes do frontend admin (291 testes) aprovadas com 100% de sucesso.
- Verificação de tipos TypeScript (`tsc --noEmit`) e testes de contraste WCAG AA aprovados nos temas claro e escuro.

## [0.5.1] - 2026-10-23

### Alterações

- Corrige a resolução do protocolo de mapas offline registrando simultaneamente as chaves 'markmap-offline' e 'geonexo-offline' na instância do PMTiles.
- Evita falhas de Fetch API ('URL scheme "geonexo-offline" is not supported') ao carregar pacotes cartográficos e blocos vetoriais locais.
- Mantém compatibilidade transparente de leases e busca com ambos os esquemas.

### Validação

- 37 suítes de mapas (211 testes) e suíte de leases de protocolos offline (15 testes) aprovadas sem erros.
- Validação do ciclo de vida dos protocolos e testes de contrato de versão aprovados.

## [0.5.0] - 2026-10-22

### Alterações

- Consolida na main as melhorias de mapas offline, GPS, busca, importação, PDF, sincronização e compatibilidade móvel, preservando a interface estabelecida.
- Mantém os bancos locais existentes e remove caches de shell antigos somente após a instalação íntegra da nova versão.
- Inicia instalações novas sem projetos demonstrativos e mostra dados de análise e sistemas de coordenadas derivados dos arquivos locais.
- Retira materiais de referência e arquivos temporários do produto, mantendo testes, recursos necessários e avisos de licença.
- Atualiza dependências afetadas por avisos de segurança e declara explicitamente as dependências usadas em execução.
- Corrige conversões UTM/MGRS, leitura GNSS, validação de exportação GPX/KML, totais dos pacotes offline e limites das conexões de notificações.

### Validação

- Suíte completa de testes unitários aprovada nas 13 tarefas do monorepo, com 804 testes aprovados; verificações de tipos e lint aprovadas em oito tarefas cada, sem erros. Os testes Node aprovaram 363 casos.
- Revisão técnica independente e revisão adicional pelo Open Code Review executadas. Auditoria das dependências de produção sem vulnerabilidades; três avisos restritos às ferramentas de desenvolvimento/build permanecem documentados na revisão de segurança.
- A validação de dispositivos iOS/Android físicos permanece separada dos testes automatizados de navegador.

## [0.4.3] - 2026-10-20

### Alterações

- Usa o runtime legado do PDF.js já instalado com worker correspondente e compatibilidade para a API de promises ausente no Safari do iPhone X; mantém a validação e o posicionamento do GeoPDF.
- Corrige a falha de gravação de PDF do WebKit armazenando os bytes já validados; continua lendo os arquivos antigos sem migração do banco e preserva hash, nome e conteúdo original.
- Reconhece Safari no iPadOS em modo desktop para mostrar as instruções de instalação corretas.
- Acrescenta leitura de tiles de altitude por imagem/canvas quando ImageBitmap não estiver disponível ou falhar, com validação e liberação dos recursos.
- Mantém as URLs de exportação disponíveis durante o processamento do download pelo Safari e trata erros de exportação sem rejeições não capturadas; preserva nomes e conteúdo dos arquivos.
- Trata também falhas ao verificar a atualização do service worker sem interromper a inicialização.
- Documenta o alvo iPhone X com iOS 16.7 e posteriores e distingue testes WebKit de validação física; não altera identidade instalada, schemas ou pisos de compatibilidade de dados.

### Validação

- Auditoria independente de PDF, importação, mapas, instalação e armazenamento realizada sobre a versão `0.4.2`. Uma regressão de exportação reproduziu a falha do link desconectado antes da correção e passou depois dela.
- 284 testes da aplicação aprovados, TypeScript/build/guardas aprovados e lint sem erros, com cinco avisos anteriores. Revisão técnica independente aprovou as correções e a leitura dos registros PDF legados.
- WebKit e Chrome renderizaram o PDF sintético com worker real, inclusive com APIs recentes removidas da página e do worker; o GeoPDF foi aplicado sobre o mapa e reaberto a partir do armazenamento local. Importação GeoJSON/KML/KMZ/GPX, exportação de original/GeoJSON, GLB e altitude com tile sintético foram exercitados em viewport iPhone X. Validação em aparelho iOS físico permanece separada.

## [0.4.2] - 2026-10-20

### Alterações

- Esclarece que a contagem exibida na busca corresponde aos dados do mapa, enquanto as consultas salvas também podem ser pesquisadas sem internet.
- Preserva a busca unificada por CEP/endereço, o cache, os controles e o layout da versão `0.4.1`.

### Validação

- A versão anterior passou em 268 testes da aplicação, 163 testes de mapas, doze testes do serviço e seis cenários reais no domínio oficial. O app Windows consultou CEP e endereço e manteve os arquivos da lista, incluindo o KML de teste.
- A revisão visual no aplicativo instalado identificou a ambiguidade da contagem que motivou esta correção de texto.

## [0.4.1] - 2026-10-20

### Alterações

- Inclui a busca unificada por CEP, endereço e nome, com reuso offline dos mapas/dados locais e das pesquisas salvas, descrita no candidato `0.4.0`.
- Identifica as consultas do MarkMap aos serviços autorizados e solicita respostas em português; registra falhas somente por identificador, tipo, código e duração, sem endereço digitado ou IP.
- Apresenta falhas de conexão e tempo de resposta em português, preservando cancelamentos e resultados locais.

### Validação

- Doze testes do serviço e 21 testes focados do painel/cliente aprovados; TypeScript e lint dos módulos alterados aprovados.
- A prévia `0.4.0` comprovou CEP real, mas encontrou indisponibilidade no serviço de texto livre; foi preservada sem promoção para produção. O candidato seguinte incrementa a versão antes de uma nova verificação em nuvem.

## [0.4.0] - 2026-10-20

Candidato de prévia; não promovido ao domínio oficial.

### Alterações

- Unifica a pesquisa do mapa em um único campo/botão para nomes, endereços e CEPs, com busca local imediata e complemento online automático ao pesquisar.
- Reconhece CEP com ou sem separadores em feições locais e índices regionais; adapta o classificador de códigos postais do Organic Maps, com licença e atribuição preservadas.
- Disponibiliza a rota própria de pesquisa com BrasilAPI CEP v2 e Photon, validação de coordenadas reais, limites de consulta/resposta, cancelamento e prazo de resposta.
- Salva até 200 consultas com resultado por 90 dias no armazenamento local existente para reutilização sem internet, sem alterar schemas, projetos ou outbox. A cobertura offline depende dos dados baixados/importados e das buscas salvas.

### Validação

- 263 testes da aplicação e 163 testes do pacote de mapas aprovados; nove regressões do cache verificam persistência, CEP, busca por nome salvo, validade, limites e recuperação após armazenamento travado. Onze testes do serviço online e onze verificações de fronteira e temas aprovados.
- Revisão independente identificou e orientou a correção da concorrência entre o debounce local e a resposta online, dos limites de payload e das atribuições por fonte.
- Verificação final do painel e cliente: 19 testes aprovados, incluindo resposta atrasada do worker, cancelamento e falha de rede com resultado local. TypeScript, lint sem erros (cinco avisos preexistentes), build e guardas de versão/artefatos aprovados.
- Fluxos reais em Chrome: CEP local e CEP consultado online continuam disponíveis após reload offline; endereço de Araguaína retorna coordenadas reais pela rota própria. WebKit móvel emulado confirmou a busca local sem rede; reload offline tem limitação do motor de automação. Aparelhos físicos iOS/Android não estavam conectados.
- Playwright no artefato final: seis cenários aprovados em Chrome e WebKit, incluindo CEP importado, busca online real e reuso do CEP salvo sem importação prévia.

## [0.3.2] - 2026-10-20

### Alterações

- Retira a frase “Aberto como aplicativo instalado.” de Configurações → Aplicativo no dispositivo, preservando a versão e o botão de atualizar.
- Mantém as orientações e o botão de instalação quando o aplicativo é aberto no navegador.

### Validação

- Quatro testes existentes de configurações e quatro verificações de fronteira entre site e aplicativo aprovados; lint do componente sem erros, com um aviso preexistente de dependência de hook.
- Revisão técnica independente confirmou a alteração pontual, sem mudanças nos handlers de instalação/atualização ou armazenamento.
- TypeScript, build Vite e guardas de versão e artefatos aprovados. QA de navegador confirmou os estados instalado e não instalado em `0.3.2`, sem a frase, sem parágrafos vazios e com ações/orientações preservadas.

## [0.3.1] - 2026-10-20

### Alterações

- Permite selecionar KML, KMZ, GPX e GeoJSON pelo seletor de arquivos sem depender dos filtros de formato do iOS/Android; preserva as validações locais antes de salvar.
- Corrige KML com atributos em Placemark, namespaces, geometrias múltiplas e áreas com anéis internos para exibição georreferenciada sobre o mapa.
- Mantém o identificador e os atributos escalares do KML no GeoJSON normalizado e preserva o arquivo original para exportação.
- Acrescenta regressões de importação, exibição sobre o mapa, enquadramento, propriedades e reabertura offline, sem alterar GeoPDF, GPS ou schemas locais.

### Validação

- 247 testes da aplicação, 85 testes geográficos e 29 verificações Node aprovados; três testes geográficos históricos permanecem ignorados. TypeScript, lint sem erros (cinco avisos preexistentes), build Vite e guarda de versão/artefatos aprovados.
- Playwright: 10 cenários aprovados, dois ignorados por serem exclusivos de reload offline no Chromium; cobertura de Chromium, WebKit, Pixel 7 e iPhone 13 emulados, incluindo camada renderizada, popup, exportação e persistência.
- Arquivo KML de teste real: um polígono com 30 vértices, coordenadas inalteradas e identificação/atributos preservados, conferidos também contra leitura XML independente.
- A validação do seletor físico iOS/Android depende de aparelhos conectados; nesta execução não havia dispositivos disponíveis.
- Reprodução anterior em Chromium e WebKit confirmou a falha do KML com Placemark contendo atributos; o arquivo de usuário permanece fora do código e dos arquivos públicos.

## [0.3.0] - 2026-10-20

### Alterações

- Identifica o conjunto de melhorias de mapas que vinha sendo publicado como `0.2.0-dev.0`: altitude real online e offline, perfil do traçado, busca local por nomes e catálogo com 55 mapas.
- Estabelece regra obrigatória de incremento numérico para qualquer agente, com uma versão reservada por entrega e changelog correspondente.
- Bloqueia builds de produção com versão reutilizada por outro commit e verifica a concordância entre pacote e `version.json` gerado.
- Mantém os protocolos, schemas locais, dados existentes e pisos de compatibilidade dos mapas.

### Validação

- `node --test scripts/version-release-guard.test.mjs`: 11 testes aprovados, incluindo versão repetida, sufixo sem incremento numérico, leitura travada da baseline e divergência de artefatos.
- Candidato `0.3.0`: 243 testes da aplicação e 29 verificações Node aprovados; TypeScript, ESLint (sem erros, com cinco avisos já existentes), build Vite e conferência de `version.json` aprovados.
- A validação anterior do conjunto de mapas em `6adc5021` confirmou busca e altitude online/offline no domínio oficial e preservação de 20 arquivos na instalação Windows. A publicação desta versão exige nova confirmação da versão e do commit no domínio oficial e na interface instalada.
