# MM-PROD-20261019 — especificação de validação e publicação MarkMap

**Status:** SPECIFICATION GATE — DONE
**Objetivo:** validar, corrigir e publicar a versão atual do app MarkMap no
branch `work/prod-araguaina-20261019`, preservando a interface e o trabalho
local existente, com evidência de produção no domínio real
`https://appmarkmap.mtsferreira.dev`.

## Autorização e limites

A autorização do usuário cobre push para o remoto configurado e deploy de
produção do app MarkMap, seguido de validação no navegador real e ciclos de
correção/redeploy até os critérios passarem. Não inclui alteração de segredos,
credenciais, banco destrutivo, merge de branches ou qualificação iOS nativa.
Nunca incluir arquivos de ambiente, tokens, cookies, chaves ou material de
sessão no commit. O worktree já possui mudanças válidas e arquivos locais
protegidos; não usar reset, clean ou stage amplo.

Os logs/scripts de QA de produção devem permanecer fora do repositório em `TEMP/markmap-production-qa-20261019`; os artefatos históricos em `docs/quality/` continuam válidos como evidência anterior.

A validação deve preservar GeoPDF/CRS, GPS/overlay, MapLibre/Terra Draw,
outbox/sync, IndexedDB, service worker, front existente, Checkbox/Dialog e o
pacote offline Araguaína. Correções devem ser mínimas, reversíveis e limitadas
a um erro reproduzido ou a um critério de aceite deste documento.

## Estado atual observado

- Base de produção: `origin/main` (`16eecbda3bed79b5f88e82510f9dc859b1abedf3`), em worktree/branch isolado; não publicar o branch antigo diretamente.
- O worktree original `feat/maps-engine-v2-offline` e seus arquivos sujos permanecem protegidos.
- Evidências do branch antigo não qualificam esta base: os testes da versão
  integrada precisam ser executados novamente.
- Projeto Vercel confirmado: `markmap-app`, root `apps/admin`, scope `matdev`.
  Produção anterior identificada na mesma SHA base acima. Cada nova publicação
  exige confirmação do commit, deployment e domínio por evidência atual.
- O domínio operacional verificado é `appmarkmap.mtsferreira.dev`; o site separado aponta para
  `appmarkmap.mtsferreira.dev`, mas isso não prova que o deployment atual ou o
  projeto Vercel estejam corretos.

## Tipos de arquivo anunciados e limites honestos

A tela de importação da base de produção (`origin/main`) anuncia e implementa:

| Tipo | Caminho atual | Aceite de produção |
| --- | --- | --- |
| GeoJSON/JSON | `ImportsPage` → `parseGeoJSON` → `saveDataset` | upload válido, inválido, limite, reload e persistência local |
| GPX | `parseDatasetFile` → `parseGpx` → `saveDataset` | trilha válida, XML inválido/DTD, limite e reload |
| KML | `parseDatasetFile` → `parseKml` → `saveDataset` | pontos/linhas/polígonos, XML inválido/DTD, limite e reload |
| KMZ | `parseDatasetFile` → descompressão/`parseKml` → `saveDataset` | pacote válido, entrada maliciosa/limite e reload |
| PDF, incluindo fluxo GeoPDF quando os metadados passam | `localRepository` + `PdfPreview` | upload, assinatura/corrupção, visualização, posicionamento e reload |
| GLB | `saveMesh` + validação de malha | upload autocontido, rejeição de externo/corrompido/excedente e reload |

Shapefile aparece no contrato de importação compartilhado, mas não é fluxo de
upload implementado pela tela atual; não deve ser apresentado como suportado até
existir parser, validação, persistência e E2E próprios. GeoTIFF,
GeoPackage, ZIP de Shapefile, imagens raster genéricas e arquivos de CAD não
são suportados nesta publicação. O pacote regional PMTiles é instalado pela
ação offline explícita existente, não pelo importador de datasets.

## Grafo de execução e propriedade exclusiva

| ID | Responsável exclusivo | Arquivos/área | Entrega e aceite |
| --- | --- | --- | --- |
| PROD-00 | Root/integrador | `docs/`, estado Git e comandos de release | confirmar branch, dirty state, diff protegido, origem remota e versão do bundle; congelar fingerprint antes de publicar |
| PROD-01 | Root, operador exclusivo do navegador | nenhum arquivo de produto; logs em `TEMP/markmap-production-qa-20261019` | validar domínio real, HTTPS, redirect, shell, rotas, console, rede e viewport desktop/mobile após deploy; revisão técnica permanece independente |
| PROD-02 | Builder de correção | somente arquivos diretamente ligados a falhas reproduzidas | corrigir falhas com testes focados; não reestruturar UI nem tocar áreas protegidas |
| PROD-03 | Especialista de importação | `apps/admin/src/pages/imports/**`, stores/import validators e testes correspondentes | exercitar GeoJSON/GPX/KML/KMZ/PDF/GLB e alinhar mensagens ao suporte real; SHP/GeoTIFF continuam claramente limitados |
| PROD-04 | Especialista PWA/offline | `apps/admin/src/lib/storage/**`, `apps/admin/public/sw.js`, offline E2E | validar instalação, reload, modo offline, pacote Araguaína e rollback sem alterar schema sem gate |
| PROD-05 | Revisor independente | nenhum arquivo de produto | revisar diff final, segurança, segredos, mudanças protegidas e evidências; registrar findings antes do push |
| PROD-06 | Root/integrador autorizado | configuração de release e remoto já configurado | commit escopado, push para a mesma branch, deploy no projeto Vercel confirmado e verificação por SHA real |

Agentes não editam arquivos do mesmo proprietário simultaneamente. Correções
só começam depois de PROD-01 registrar uma falha reproduzível. O gate de
especificação está DONE; cada correção posterior exige seu próprio teste e
revisão antes do próximo deploy.

## Aceitação local antes do push

1. `pnpm`/scripts resolvidos a partir dos manifests instalados; lint,
   typecheck, testes unitários, build e E2E aplicáveis passam sem esconder
   warnings ou converter timeout em PASS.
2. O bundle produzido registra uma versão/hash real do app shell e inclui apenas
   assets permitidos; secret scan e `git diff --check` passam.
3. Todas as rotas anunciadas (`/`, `/workspace`, `/imports`, `/settings` e
   rotas de projeto) abrem diretamente e após reload. O service worker não
   intercepta APIs ou origens indevidas.
4. No navegador Chromium e em matriz disponível de WebKit/Firefox, verificar
   console sem erros novos, requests falhos, CORS inesperado, loops de reload,
   páginas em branco ou overflow quebrado. Warnings conhecidos devem ser
   registrados com impacto.
5. Fluxos de interação reais devem cobrir: navegação lateral/mobile, tema,
   criar/abrir projeto, desenho/seleção no mapa, permissões GPS, GeoPDF,
   importação de GeoJSON/PDF/GLB, falhas de arquivo inválido/excedente,
   instalação offline explícita, reload sem rede e preservação do pacote
   anterior. Cada upload deve ser clicado no input real e observado até a
   mensagem de sucesso ou erro acionável.
6. Confirmar responsividade em larguras desktop e mobile, foco/teclado, labels
   dos inputs, botões desabilitados durante busy, toasts e ausência de
   vazamento de conteúdo local sensível em mensagens ou console.

## Aceitação de produção, push e deploy

- Confirmar o projeto Vercel efetivo, branch/commit implantado, alias e domínio
  por saída real da ferramenta ou painel permitido; testar `https://` e
  redirects sem assumir que `apps/site/vercel.json` é prova de deploy.
- Fazer commit apenas dos arquivos intencionais já revisados, preservar o
  restante do dirty state conforme política do repositório e fazer push para a
  mesma branch autorizada. Registrar SHA remoto retornado.
- Implantar no projeto confirmado e aguardar build concluído. O deploy só passa
  quando o bundle servido expuser a versão/hash esperados e o domínio retornar
  sucesso sem fallback incorreto.
- Abrir o domínio real no navegador e repetir a matriz de rotas, console,
  rede, viewport e todos os seis tipos suportados (GeoJSON, GPX, KML, KMZ, PDF e GLB). Executar também
  instalação PWA, reload, modo offline e pacote regional se o artefato estiver
  publicado.
- Se um clique, upload, rota, console ou request falhar, registrar o erro,
  corrigir na área exclusiva, repetir testes locais, revisar e redeployar.
  Parar quando a mesma evidência passar, sem mascarar a falha com mocks.
- O push e o deploy inicial autorizado ocorrem após os gates locais e a revisão;
a validação interativa de produção é executada imediatamente depois do deploy,
não é um pré-requisito para a primeira publicação autorizada. O plugin de
browser não está disponível nesta sessão; quando a validação interativa for executada, usar Playwright MCP como fallback autorizado e registrar essa razão e os logs/scripts em `TEMP/markmap-production-qa-20261019`.

O release permanece BLOCKED se não houver projeto/domínio verificável,
  bundle correspondente ao SHA remoto, fluxo real de upload ou evidência de
  browser pós-deploy. iOS físico e pacotes com busca, rótulos ou roteamento
  continuam gates separados. O instalador remoto retomável existente é preservado.

## Evidência e stop conditions

O handoff final deve apontar para: SHA local e remoto, fingerprint do bundle,
logs de lint/typecheck/unit/build/E2E, URL/projeto Vercel verificados, horário,
viewport/browser, contagens de casos, console/network findings, arquivos
alterados e resultado de cada formato suportado e dos formatos rejeitados. Não declarar produção pronta por build
local isolado ou por resposta HTTP sem interação real.

Stop conditions: descoberta de segredo, mudança fora do escopo, tentativa de
alterar banco/destruir dados, domínio não autorizado, projeto Vercel ambíguo,
falha sem reprodução, ou qualquer regressão em GeoPDF/GPS/front/outbox/offline.
Nesses casos, preservar evidência e retornar BLOCKED para decisão do integrador.

## Gate final

Esta especificação está **DONE** e pronta para iniciar PROD-00/PROD-01. A
publicação só pode ser declarada **PASS** após os gates locais, revisão,
push/deploy verificáveis e navegador real pós-deploy descritos acima.


## Integração na base atual — gate pronto

- Base exata: `16eecbda3bed79b5f88e82510f9dc859b1abedf3`; branch nova `work/prod-araguaina-20261019`, sem merge nem mudança de main.
- Destino confirmado: projeto Vercel `markmap-app`, scope `matdev`, root `apps/admin`, domínio `appmarkmap.mtsferreira.dev`; o site não será publicado nesta tarefa.
- Levar somente os hardening ainda necessários para `package.ts`/`style.ts`/pipeline, preservando componentes opcionais, hashing incremental, leitura limitada e proteções adicionadas em main.
- Pacote real e proveniência podem ser reutilizados byte a byte; integrar pelo catálogo e `ResumableInstaller` existentes. Não portar a ação paralela de Settings nem substituir o instalador atual.
- Avaliar a compatibilidade binária do IndexedDB com os leitores de geração atual; preservar CAS, locks, quota e leitura de registros legados. Evitar materializar arquivos grandes inteiros ou mudar schema.
- Asserções novas devem cobrir o pacote real pelo catálogo, preservação de mapas anteriores, download e cold reload; testes protegidos de main permanecem.
- Propriedade: mapas/pipeline por especialista de mapas; storage por especialista separado após proposta; pacote/catálogo e integração pelo integrador; revisão final independente de todos.

### Persistência compatível — correção limitada

Preservar o caminho Blob existente para arquivos grandes nos backends que o suportam. Leitores `asset` e `assetAtRevision` aceitam Blob e ArrayBuffer legados. Quando uma gravação falhar especificamente na preparação/serialização de Blob, pode-se repetir a transação abortada com buffers binários para pacotes pequenos (teto agregado de 10 MiB), sem alterar schema, geração ativa ou CAS. O retry é único e não se aplica a quota ou erros arbitrários. Arquivos maiores continuam sem materialização integral e falham de forma explícita nesse backend incompatível, preservando o ativo.

Checkpoints já possuem representação legada ArrayBuffer e blocos limitados a 1 MiB: o mesmo fallback de serialização deve permanecer limitado a um bloco. Hash, identidade, offsets, retomada e limpeza por referência continuam invariantes. Não afirmar que esta correção qualifica pacotes de 250 MiB no WebKit incompatível.

## Gate local antes da primeira publicação

- Admin: 43 arquivos / 167 testes aprovados; maps: 22 arquivos / 159 testes aprovados.
- Contratos regionais: 141 aprovados; PWA boundaries/contraste/superfícies: 11 aprovados.
- Typecheck aprovado; ESLint sem erros, com dois avisos existentes de hooks em arquivos de UI preservados.
- Build final aprovado, pacote PMTiles e estilo presentes; o SHA da publicação deve ser conferido no `version.json` remoto, pois o build local não usa metadados Vercel.
- Matriz local Chrome de 13 cenários: 12 aprovados no run completo e o cenário GPS externo aprovado em rerun focado após corrigir a coordenada da fixture (-69.9 estava dentro de [-70,-69]; -70.1 está fora). Mesmas asserções preservadas.
- O Chromium headless de teste apresentou timeouts; os cenários GPS/GeoPDF correspondentes passaram no Chrome instalado. Não atribuir esses timeouts a um defeito do produto sem reprodução no Chrome.
- Revisão independente de mapas, pipeline, storage e harness concluída; findings corrigidos e reavaliados. Nenhuma mudança no frontend, GPS, GeoPDF, site, manifest ou SW de produção.
- Secret-pattern scan dos candidatos sem achados e `git diff --check` aprovado. Logs fora do repositório em `TEMP/markmap-production-qa-20261019`.
- Push, deploy e teste interativo no domínio real ainda são critérios pendentes deste gate local.
