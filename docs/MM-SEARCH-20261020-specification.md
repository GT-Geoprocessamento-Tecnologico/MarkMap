# MM-SEARCH-20261020 — busca única de CEP, endereço e mapa

Status: SPECIFICATION GATE — DONE. Upstreams e hosting first-party estão
fixados; builders podem iniciar pelas tarefas do grafo abaixo.

Versão funcional inicial: **0.4.0** (MINOR). Entrega atual reservada pelo coordenador: **0.4.2** (PATCH), incluindo a correção de conexão da `0.4.1` e o esclarecimento da contagem de locais, sobre
`0efd0a53a004ce7a05153cf0588de2ef26feecc0` / pacote `0.3.2`.

## Objetivo e limites

Ampliar a busca do mapa para uma única experiência de consulta por nome, rua,
endereço ou CEP. Ao enviar o formulário, a busca local deve responder primeiro
com os dados disponíveis no dispositivo; se houver conectividade e rota
first-party autorizada, a mesma consulta pode ser enriquecida online sem um
segundo gesto. A ausência de rede, índice ou provedor deve produzir estado
honesto e manter os resultados locais.

O fluxo não faz autocomplete, não consulta a rede durante digitação, não cria
coordenadas, não promete cobertura nacional offline e não baixa mapa
automaticamente. A seleção de um resultado usa somente `lon`/`lat` validados
que vieram de uma feição ou do provedor autorizado. A busca online envia apenas
o termo submetido, respeita limites do backend e nunca acessa Nominatim ou
outro geocoder público diretamente.

## Evidência do estado atual

- `OfflineSearch.tsx` tem dois caminhos de UI: busca local por botão/Enter e
  botão separado para busca online. O worker usa `@geonexo/maps/search` sobre
  registros de projeto, shards da região ativa e nomes de tiles visíveis.
- `local-map-search.ts` indexa `name`, `title`, `ref`, `label` e os campos
  `addr:street`, `addr:housenumber`, `addr:city`; não indexa CEP.
- `regional-package-search.ts` lê apenas `searchShards` da geração ativa,
  validando caminho, normalização, limites, coordenadas e geração. Não deve ser
  substituído por uma chamada de rede.
- `visible-map-search.ts` usa somente nomes já decodificados dos PMTiles
  visíveis, com limites de 2.000 registros/20.000 feições e posição real da
  feição; esse fallback não é índice de endereços.
- `address-geocoder.ts` já valida uma rota relativa `/api/*`, limita a consulta
  a 3–160 caracteres, valida até cinco respostas e mantém apenas cache em
  memória. Não existe rota `/api/address-search` no checkout nem provedor
  licenciado configurado; essa é a dependência externa que bloqueia o aceite
  online real.
- O modelo Organic Maps existente em `REPOSITOTIROS MODELOS` pode orientar
  normalização/indexação, mas nenhum código ou dado deve ser copiado. O app
  continua usando seus contratos `SearchRecord` e `searchShards`.

## Contrato funcional

### Consulta e normalização

Criar um normalizador compartilhado para indexação e consulta, baseado em
`normalizeName` de `packages/maps/src/search/index.ts`:

1. remover espaços nas extremidades e colapsar espaços internos;
2. comparar sem acentos, sem diferença de caixa e sem pontuação irrelevante;
3. conservar os dígitos do CEP;
4. reconhecer CEP somente quando, após remover separadores (`-`, espaço,
   ponto), restarem exatamente oito dígitos;
5. formatar CEP exibido como `NNNNN-NNN`, sem transformar um número parcial em
   CEP completo.

O índice local deve incluir `addr:postcode`, `postcode`, `postalcode` e `cep`
   quando forem strings de oito dígitos. O modelo compartilhado pode carregar
   `postalCodes?: string[]` como metadado opcional; o registro mantém
   `normalized === normalizeName(name)`, e cada CEP normalizado é um token
   adicional para consulta. O rótulo original e a coordenada da feição são
   preservados. Registros sem coordenada válida são descartados, como já ocorre
   hoje.

### Uma submissão, duas fontes

`OfflineSearch` mantém um único campo e um único botão `Pesquisar`; o botão
separado de busca online é removido. Não há seletor de modo/conexão. Enter e
clique fazem:

1. normalizar e validar a consulta;
2. executar a busca local no worker e mostrar imediatamente seus resultados;
3. em paralelo, somente se `navigator.onLine` e a rota first-party estiverem
   configurados, iniciar o enriquecimento online com `AbortController`;
4. mesclar resultados deduplicados, mantendo primeiro os locais. A interface
   continua contínua e simples; metadados de fonte/atribuição ficam disponíveis
   para acessibilidade e para a atribuição exigida pelo provedor, sem rótulos
   técnicos em cada resultado;
5. manter os locais quando a rede falhar e mostrar status acionável para o
   enriquecimento que falhou.

Uma nova submissão cancela a anterior. Fechar o painel cancela a requisição
online. Digitar nunca chama a rede. O limite combinado visível continua sendo
12 resultados locais e até 5 online, ou um limite único explicitamente
documentado no componente; a implementação deve escolher um limite e cobri-lo
em testes para não ocultar resultados locais por causa do online.

### CEP local

Um CEP exato deve consultar primeiro os registros indexados do projeto e das
shards regionais ativas. A busca nos nomes dos tiles visíveis só pode retornar
um registro se o tile fornecer o próprio CEP; não inferir CEP a partir do nome,
centro do mapa, cidade, bounds ou posição do usuário. Se não houver registro,
mostrar que não há correspondência local e deixar o online enriquecer quando
autorizado.

### CEP online

O frontend chama somente a função Vercel same-origin fixa
`GET /api/address-search?q=<term>&limit=5`, sem expor credenciais. A função
deve:

- validar query, limite, CEP/endereço e tamanho de resposta;
- aplicar rate limit, timeout, cache server-side e logs sem o termo completo;
- consultar BrasilAPI CEP v2 para CEP exato e Photon para texto livre, sem
  autocomplete, crawling ou acesso direto do navegador a serviço público;
- aplicar até 6 s por upstream e até 8 s de orçamento total da função,
  retornando fallback local quando Photon/BrasilAPI estiverem indisponíveis;
  o cliente usa até 9 s e a plataforma pode impor até 10 s; os provedores não
  oferecem SLA;
- retornar apenas `{ id, label, lat, lon, source, attribution?, postalCode? }`;
  `id` tem no máximo 160 caracteres, `label` 220, `source` 80,
  `attribution` 240 e `postalCode` somente oito dígitos;
- validar `lat`/`lon` como números finitos dentro de `[-90,90]`/`[-180,180]`;
- mapear indisponibilidade, limite e resposta inválida para erros estáveis;
- nunca retornar coordenada fabricada.

O uso é limitado a consultas normais iniciadas por submissão do usuário. A
função não implementa autocomplete nem coleta em massa. A ausência de SLA é
tratada por timeout, fallback local e mensagem de indisponibilidade; não há
dependência de segredo para os upstreams públicos autorizados.

### Cache persistente

Extrair o cache da busca online para um módulo bounded que leia/escreva no
`localDb`/store `meta` já existente, sem bump de schema. A chave inclui
`sourceVersion`, endpoint lógico, tipo de consulta (`address`/`cep`) e termo
normalizado; nunca armazenar token, coordenada GPS, credencial ou histórico de
posição. O cache aceita no máximo 200 consultas e 90 dias, com eviction por
mais antigo. Uma entrada fresca pode retornar imediatamente e evita upstream;
não há refresh forçado. Ao abrir sem rede, consultar entradas válidas antes de
declarar ausência de resultados. Não persistir respostas vazias nem erros.
Falha do KV degrada para cache de sessão/memória e não interrompe projetos ou
mapas.

## Arquivos e propriedade

| Tarefa | Dono | Área permitida | Saída |
|---|---|---|---|
| Normalizador/CEP e registros locais | Search local | `local-map-search.ts`, `packages/maps/src/search/index.ts`, leitor regional/pipeline e testes | `postalCodes` opcional, busca sem acento e coordenadas preservadas |
| Orquestração única | Search UI | `OfflineSearch.tsx`, `address-geocoder.ts` e testes | uma submissão, local imediato, online cancelável |
| Cache persistente | Root | novo módulo sobre `localDb.meta` e testes | cache versionado, 200/90 dias, fallback seguro |
| Rota first-party | Backend | rota fixa/adapter no serviço canônico e testes | contrato validado e provider autorizado; sem segredo versionado |
| QA independente | QA | testes focados e Playwright do mapa | offline, local+online, CEP, erro, reload/cache e ausência de cobertura |

Builders não alteram `CommandCenterPage` ou layouts fora do wiring estritamente
necessário para manter `combinedSearchRecords`, `onChoose`, GeoPDF, GPS,
seleção regional, IndexedDB/outbox e instalação. Não alteram catálogo,
manifest/schema de pacotes, service worker, protocolo de sincronização ou
domínio do site.

## Grafo de tarefas e gates

1. **MM-SEARCH-SPEC-DONE** — esta especificação e contratos aprovados. Bloqueia
   builders até o coordenador aceitar o ponto do provedor.
2. **MM-SEARCH-LOCAL** — normalização CEP, índice de feições/shards, worker e
   testes unitários; depende de 1.
3. **MM-SEARCH-UI** — submissão única, merge/dedupe, estados e cancelamento;
   depende de 2; não inclui backend real.
4. **MM-SEARCH-CACHE** — persistência bounded e leitura offline; depende de 2;
   requer decisão de migração/store antes de alterar schema.
5. **MM-SEARCH-BACKEND** — função Vercel `/api/address-search` com adapters
   BrasilAPI CEP v2/Photon, limites, timeout, validação e fallback. Depende de
   1; não requer segredo versionado.
6. **MM-SEARCH-QA** — revisão e testes independentes; exige 2–4 e, para o
   cenário online, 5 com endpoint real autorizado.
7. **MM-SEARCH-RELEASE** — typecheck, lint, build, guard da versão `0.4.2`,
   changelog e QA de browser. Nenhum deploy sem aprovação explícita.

## Aceitação

- Em modo avião, `Rua Augusta`, uma feição local e um CEP indexado retornam
  resultados locais após a mesma submissão; nenhum request externo é feito.
- Um CEP formatado (`12345-678`) e não formatado (`12345678`) produzem a mesma
  chave e não confundem CEP parcial com endereço textual.
- Um registro regional com CEP e coordenada válida aparece offline após reload
  da geração ativa; shard ausente, inválido ou de geração antiga gera aviso e
  não mistura dados.
- Com endpoint first-party autorizado, uma submissão mostra local primeiro e
  enriquece online; respostas inválidas, timeout, offline e cancelamento não
  removem locais nem exibem coordenadas fictícias.
- A função `/api/address-search` aceita somente consulta/limite bounded,
  roteia CEP exato para BrasilAPI e texto livre para Photon, devolve o array
  estrito documentado e rejeita coordenadas, labels, IDs, fontes ou CEPs fora
  dos limites.
- Repetir uma consulta servida pelo cache funciona sem rede, respeita TTL,
  limite e versão da fonte; falha de cache não corrompe dados locais.
- Se os upstreams estiverem indisponíveis, a UI mantém os locais e informa o
  fallback; não alega busca online bem-sucedida.
- Selecionar um resultado centraliza no `lon`/`lat` recebido, preserva projeto,
  GeoPDF, GPS, tema e mapa selecionado; não altera tiles, bounds ou outbox.
- A UI mantém um campo e botão acessíveis, sem autocomplete e sem requisição
  durante digitação; resultados indicam fonte e atribuição quando exigido.

## Riscos, bloqueios e parada

Os upstreams públicos têm disponibilidade variável; timeout e fallback local
são parte do contrato. Parar se surgir exigência de segredo, autenticação não
aprovada, autocomplete, crawling, coordenada estimada ou uso fora do limite de
consultas normais.
Parar se o trabalho exigir credenciais no repositório, geocoder público,
coordenada estimada, novo banco destrutivo, migração não revisada, alteração de
PWA/instalação ou cobertura offline que o pacote não declara.

Não há alteração de código neste documento. A implementação somente pode
começar depois de o coordenador registrar `MM-SEARCH-SPEC-DONE` e atribuir as
áreas sem sobreposição.
