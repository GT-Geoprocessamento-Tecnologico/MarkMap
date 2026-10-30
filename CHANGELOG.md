# Versões do MarkMap

Fonte da versão do aplicativo: `apps/admin/package.json`. Todos os agentes seguem [a política de versionamento](docs/versioning.md). O [histórico documental anterior](docs/changelog.md) permanece preservado.

## [0.5.18] - 2026-10-29

### GeoPDF por projeto + backup completo das fotos (candidata, QA integrado pendente)

- GeoPDF associado ao projeto salvo no IndexedDB junto ao PDF original, reaberto ao entrar no mapa; seletor, ocultação, transparência e referência geográfica local preservados no backup parcial quando couber.
- Exportação cifrada de **todas as fotos dos pontos** do workspace, com verificação SHA-256, prévia antes da restauração e importação atômica que não sobrescreve registros existentes; formato `.markmapfotos`. O backup de outros dados continua parcial (16 MiB) e mapas offline não estão incluídos.
- Novos testes de regressão de associação GeoPDF, foto corrompida, senha incorreta e consistência de workspace. Testes integrados, Android/iOS e backup em dispositivo real permanecem pendentes.



### Recuperação segura de PWA com perda de cache aprovado

- A ausência do app shell aprovado abre uma página local de recuperação em vez de bloqueio sem saída (HTTP 503 continua até consentimento explícito).
- A recuperação exige clique, desafio temporário de uso único, shell candidato completo e verificação de transação IndexedDB com prevenção de múltiplas abas e sincronização pendente.
- Nenhuma limpeza de dados, outbox, mapas ou troca automática de versão é permitida; teste isolado do SW com recuperação inclui fraude/replay de token e metadados corrompidos.

### Fotos privadas dos pontos — candidata offline-first

- Câmera e galeria no formulário de pontos; imagens convertidas para JPEG sem EXIF, limitadas a 1,5 MB e 5 por ponto, com prévia e exclusão confirmada.
- Os originais permanecem no IndexedDB do workspace e podem integrar o backup criptografado parcial (limite total de 16 MiB); sincronização remota de fotos continua fora do escopo e não é prometida.
- Backup/restauração aceitam somente formatos binários permitidos, assinatura de imagem e SHA-256 íntegros, preservando PDFs/GeoTIFF existentes.
- O limite total temporário de fotos por workspace é de 6 MB para reduzir o risco de exceder o backup parcial. QA integral e teste físico ainda pendentes.

### Continuidade da candidata (sem publicação)

- T06: toque no ponto de campo abre ficha de gerenciamento, com seleção protegida por ID do projeto; marcadores importados mantêm a leitura e pontos salvos continuam visíveis ao ocultar datasets.
- T10: datasets locais podem ser renomeados com validação da extensão GIS, preservando arquivo original, geometria e identidade; exclusão agora exige confirmação explícita e pode ser cancelada.
- Regressões isoladas adicionadas: 5 testes de seleção de pontos e 4 testes de nome de dataset; integração real, Playwright e dispositivo físico continuam pendentes.



### Alterações

- Gestão de pontos no mapa por projeto: lista, pesquisa, renomeação/observações, localização e exclusão confirmada, com gravação offline.
- Seleção regional separada do mapa visual: OpenFreeMap continua o fundo principal, pacotes baixados preservados para pesquisas locais e recursos offline.
- Identificação do projeto ativo no mapa e exportação usando nome legível.
- Service worker mantém a aprovação explícita da versão operacional; documentação nova não muda mais o hash do shell por alterar buildSha/buildTime em version.json.

- Separar o deploy automático do servidor da atualização aprovada no dispositivo: o PWA fixa o app shell autorizado em CacheStorage e continua servindo a versão anterior mesmo após ativação natural de novo service worker.
- Exigir clique em **Atualizar agora**, handshake de compatibilidade, barreira de transações IndexedDB e ausência de outras janelas antes de autorizar a troca do app shell.
- Exibir a versão disponível mesmo com service worker já ativo, persistir a escolha **Depois** e nunca apagar mapas, backups, outbox ou caches de shell ainda aprovados durante a ativação.
- Consultar `version.json` diretamente na rede, excluí-lo do precache e embutir só a versão no worker; o SHA permanece em `version.json` para evitar SW novo em commits apenas documentais.

### Validação

- 13/13 testes isolados do service worker + 3/3 testes do gerador (incluindo deploy apenas documental) PASS; 5/5 testes isolados da política de basemap PASS.
- 6/6 simulações isoladas dos estados da interface React PASS; checagem TypeScript estrita isolada do componente PASS.
- `node --check` e transpile TSX isolado PASS.

### QA para liberação pública

- A migração inicial de um worker legado para esta nova política pode carregar o código de transição antes de seu próprio fluxo de aceite; subsequentemente o app shell permanece fixado por versão.
- CI do monorepo, Vitest com bibliotecas reais, Playwright cross-release, WebKit e teste físico na PWA instalada ainda não executados neste ambiente. A candidata deve permanecer fora da main até homologação integral.

## [0.5.17] - 2026-10-28

### Alterações

- Suporte completo a camadas vetoriais de grande porte via FlatGeobuf (FGB), com índice Packed R-Tree, atributos densos e leitura eficiente por viewport.
- Protocolo customizado (`fgb://`) e adaptador de fonte dinâmica para MapLibre.
- Overlay local de edição para adições, modificações e exclusões de feições, com reconstrução e exportação de FGB conforme ADR-0007.
- Módulo de backup completo controlado pelo usuário para workspaces e camadas vetoriais com encriptação AES-GCM.
- Importação e validação de arquivos `.fgb` na página de importações.

### Validação

- Suítes de testes unitários e de integração de `@markmap/geo`, `@markmap/maps`, `@markmap/contracts` e `admin` executadas com sucesso (597 testes do admin e todos os pacotes PASS).
- Typecheck, lint e release guard verificados.

## [0.5.16] - 2026-10-27

### Alterações

- Ativar validação de versão e commit do release no build de produção Cloudflare Pages (`CF_PAGES`, `CF_PAGES_BRANCH`, `CF_PAGES_COMMIT_SHA`), preservando Vercel e previews.
- Gravar o SHA canônico do Cloudflare no `version.json` do pacote gerado e falhar fechado quando ausente em produção.

### Validação

- Testes isolados de política de versionamento e manifesto executados em Node.js neste ciclo; build completo, IndexedDB real, PostGIS e QA física ainda dependem de execução local antes de publicar.

## [0.5.15] - 2026-10-27

### Alterações

- Base experimental isolada para cifrar e verificar um fluxo em blocos autenticados, sem integração ao exportador ou à restauração existentes. Ela ainda não representa arquivos, cobertura ou backup integral.
- Concorrência dos testes de mapas e do app limitada para reduzir interferência nas verificações de desempenho em máquinas compartilhadas, sem alterar os critérios dos testes.

### Validação

- `pnpm ci:local --base-ref 68fd4485899365d2b2611b144b1fe604749cde54`: typecheck, lint, testes dos pacotes, release guard e fronteiras PASS, com dois workers em mapas e admin. Execuções anteriores falharam em testes temporizados sob carga; os testes afetados também passaram isoladamente.
- 13 testes direcionados de autenticação, limites, interrupção e cancelamento PASS; teste com 20 MiB e rejeição de adulteração em Chromium e WebKit PASS. PostGIS real e dispositivos físicos continuam pendentes.
- Build do app PASS: 318 testes de mapas e 592 do admin; cinco avisos de lint preexistentes, sem erros.

## [0.5.14] - 2026-10-27

### Alterações

- Pausa persistente após restauração e coordenação transacional entre abas compatíveis; retomada exige confirmação explícita. Uma trava interrompida pode ser revisada com Web Locks, sem iniciar sincronização.
- Leitura conservadora dos bancos auxiliares: dados existentes ou órfãos são sinalizados como pendentes sem carregar binários nem alegar backup completo.
- Compatibilidade com backups legados que conservam simultaneamente uma operação e seu ACK, sem reenviá-la.

### Validação

- 152 testes direcionados de backup, sincronização e leitores PASS. Playwright em Chromium/WebKit: 6 testes PASS com IndexedDB isolado e endpoint sintético, incluindo concorrência e fechamento de abas.
- `pnpm ci:local --base-ref 06eea0f4d1b5350723303033ef2313a94a8fce82`: typecheck, lint, testes dos pacotes, release guard e fronteiras PASS. No pacote DB, 26 testes de integração continuam ignorados sem PostGIS local.
- Build do app PASS (318 testes de mapas e 579 do admin); 15 testes Playwright adicionais em Chromium, WebKit e Pixel 7 emulado; revisão visual em temas claro/escuro no desktop e Android emulado.

## [0.5.13] - 2026-10-27

### Alterações

- Recuperação cifrada em perfil novo, antes da inicialização do workspace, preservando a fila offline, conflitos e originais sem sobrescrever dados existentes.
- Validação compartilhada de operações e conflitos na exportação e restauração, além de guardas de identidade, sequência e cursor; leitores opcionais falham explicitamente quando IndexedDB não está disponível.
- A interface informa que o backup continua parcial, limitado ao workspace e a 16 MiB, sem mapas offline ou outros bancos.
- Correção da geometria sintética usada pelos testes de limites com múltiplos furos.

### Validação

- Playwright: 15 testes PASS em Chromium, WebKit e Pixel 7 emulado; exportação e restauração em perfis isolados com outbox, conflitos e PDF, incluindo leitura após recarga, e temas claro/escuro.
- `pnpm ci:local --base-ref e0684a86e528829af1d4d2278ecb609544158625`: typecheck, lint, testes dos pacotes, release guard e fronteiras PASS no Windows.
- Testes de fronteira de produtos, superfícies e contraste: 11 aprovados.
- Build do app e guard dos artefatos PASS; 318 testes de mapas e 535 do admin. No pacote DB, 16 testes passaram e 26 de integração foram ignorados; PostGIS real e dispositivos físicos permanecem pendentes.

## [0.5.12] - 2026-10-27

### Alterações

- Implementação das 5 frentes de evolução funcional para o MarkMap Brasil (GIS de campo offline-first):
  - 1. Medição Agrária Brasileira: conversões geodésicas em @markmap/geo para Hectare (10.000 m²) e 4 variantes de Alqueire (Paulista 2,42 ha, Mineiro/Goiano 4,84 ha, Baiano 9,68 ha e Norte 2,72 ha), com seletor dinâmico de unidade de área no mapa.
  - 2. Suporte Normativo ao CAR (Cadastro Ambiental Rural): detecção automática de 6 feições do SICAR (Área do Imóvel, Reserva Legal, APP, Vegetação Nativa, Hidrografia e Área Consolidada), data-driven styling oficial no MapLibre e componente CarSummaryCard com percentual visual de Reserva Legal.
  - 3. Gravador Contínuo de Trilhas GNSS (Track Logger MM-AVZ-05): motor de telemetria geodésica em tempo real (distância, velocidade média, altimetria acumulada), descarte estrito de coordenadas com acurácia > 15m, auto-salvamento resiliente no IndexedDB a cada 4s, WakeLock de tela e painel flutuante TrackRecordingOverlay.
  - 4. Exportador Universal de Desenhos de Campo: gerador de arquivos .kml (Google Earth) e .gpx (Garmin/aparelhos de campo) com preservação de altitudes, timestamps e geometrias do Terra Draw e trilhas do Track Logger via FieldExportModal.
  - 5. Boundary Guard (Alerta de Limites e Geofencing): monitoramento de proximidade com tolerância de 50m e detecção de cruzamento de divisa, sintetizador de som nativo por Web Audio API (zero arquivos externos) e banner visual de alerta BoundaryAlertBanner.

### Validação

- Typecheck e lint 100% aprovados em todos os 9 pacotes do monorepo.
- Suíte de testes unitários aprovada em @markmap/geo (103 testes), @markmap/maps (306 testes) e admin (350+ testes).
- Testes adversariais de robustez geodésica, persistência de preferências de alqueire e conformidade com os esquemas oficiais TopoGrafix GPX 1.1 e OGC KML 2.2 aprovados.
- Conformidade total com acessibilidade de superfícies e contraste WCAG AA nos temas claro e escuro.
- Release guard aprovado para a versão canônica 0.5.12.

## [0.5.11] - 2026-10-27

### Alterações

- Correções de qualidade e resiliência auditadas via open-code-review:
  - Propagação explícita de erro na salvaguarda de outbox em apps/admin/src/lib/backup/restore.ts, impedindo restauração acidental em caso de falha de consulta ao banco local.
  - Guarda canônica isMounted no hook useDeviceLocation.ts para evitar chamadas a setState em componente desmontado durante eventos assíncronos de orientação.
  - Reset de confirmação no diálogo de restauração cifrada em caso de falha para forçar revisão consciente do usuário.
  - Validação defensiva no parser de argumentos --base-ref do script scripts/local-ci.mjs.
  - Asserção de tipo as const no literal SCOPE_REJECTED em packages/db/src/queries/sync.ts.
  - Resiliência assíncrona com waitFor no teste OfflineElevation.test.tsx sob concorrência de CPU.

### Validação

- 100% de aprovação no pipeline autônomo pnpm ci:local (2m 9s, exit code 0).
- Suíte completa do admin com 64 arquivos e 320 testes aprovados.
- Typecheck e lint em 9 pacotes sem nenhum erro.
- Release guard aprovado sem advertências.

## [0.5.10] - 2026-10-27

### Alterações

- Suíte de Backup Offline (Fase T3b): adiciona módulo `apps/admin/src/lib/backup/multi-db.ts` para leitura e extração opcional e segura de múltiplos bancos IndexedDB locais (`GeoNexoLocalEngineDB`, `geonexo-mesh-store`, `large-blob-store`, `markmap-offline-packages`).
- Suporte a fallback defensivo para ambientes onde `indexedDB` global não está instanciado no escopo global (cross-realm / Node / SSR).

### Validação

- 18 testes unitários aprovados em `src/lib/backup/backup.test.ts` (100% PASS).
- Suíte geral de `admin` com 64 arquivos e 320 testes aprovados.
- Pipeline `pnpm ci:local` 100% aprovado com exit code 0.

## [0.5.9] - 2026-10-27

### Alterações

- Pipeline de CI Local Autônomo e Determinístico (`scripts/local-ci.mjs` e `pnpm ci:local`) com execução controlada no Windows, typecheck, lint, testes unitários de todas as camadas, release guard e testes de tema/PWA.
- Suíte Completa de Backup Offline Cifrado (Issue #43 — T3a, T4 e T5):
  - Exportação cifrada AES-256-GCM com derivação de chave PBKDF2 (310.000 iterações) e manifesto canônico versionado v1 (`.markmapbackup`).
  - Restauração com Dry-Run seguro em memória (`dryRunRestore`), validação de hashes SHA-256 e tripla salvaguarda (bloqueio contra outbox pendente e colisão de workspaces).
  - Componente acessível `BackupRestoreCard` integrado em Configurações com modais de exportação com validação de senha e restauração assistida em dois passos.

### Validação

- 100% de aprovação no CI Local (`pnpm ci:local` com exit code 0).
- 64 arquivos e 319 testes aprovados no workspace `admin` (incluindo 20 novos testes de backup e UI).
- `version-release-guard` validado monotonicamente em relação à versão base.

## [0.5.8] - 2026-10-24

### Alterações

- Extrai string literal duplicada "Todos" em constante `FILTER_ALL_TYPES` na página CoordinateSystemsPage para melhorar a legibilidade e manutenibilidade do código.

### Validação

- Testes unitários do frontend executados via Vitest e verificação de lint/tipagem sem erros.

## [0.5.7] - 2026-10-24

### Alterações

- Recupera a identidade de um único workspace local existente quando o registro de metadados foi perdido, sem reescrever projetos, PDFs originais ou outbox.
- Bloqueia a criação silenciosa de uma nova identidade quando há dados persistidos de múltiplos workspaces, impedindo ocultação de registros.
- Corrige os eventos de alterações locais e resolução de conflitos que devem disparar a sincronização, mantendo os nomes legados.
- Limita a retirada automática de caches antigos durante a atualização PWA aos caches de shell, preservando os caches de mapas, backups e arquivos do usuário.
- Otimiza a renderização dos ícones do aplicativo com memoização de componente, sem alterar dados ou APIs.

### Validação

- Testes de recuperação do banco IndexedDB em Node, regressões de eventos de sincronização, preservação de caches do service worker e suites existentes de mapas/frontend.
- Homologação na PWA instalada com dados reais e comparação entre perfis/dispositivos ainda é necessária; nenhuma limpeza ou restauração automática de conteúdo.

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
