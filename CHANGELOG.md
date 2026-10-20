# Versões do MarkMap

Fonte da versão do aplicativo: `apps/admin/package.json`. Todos os agentes seguem [a política de versionamento](docs/versioning.md). O [histórico documental anterior](docs/changelog.md) permanece preservado.

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
