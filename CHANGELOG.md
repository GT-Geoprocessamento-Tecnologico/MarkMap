# Versões do MarkMap

Fonte da versão do aplicativo: `apps/admin/package.json`. Todos os agentes seguem [a política de versionamento](docs/versioning.md). O [histórico documental anterior](docs/changelog.md) permanece preservado.

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
