# MM-A71 — região GPS, GeoPDF responsivo, busca e higiene de repositório
Data 2026-10-13 · base main@421408cbedb243603c534d75f61dc2837d39ad86

## Objetivo e contexto
O usuário deseja um mapa correspondente à sua localização, busca de endereços acessível no menu do mapa, GeoPDF ajustado à tela sem perder dados ou qualidade, publicação para testes e limpeza segura das seis branches legadas/referências não usadas. Preserve offline-first, PDF.js/MapLibre/IndexedDB, stack existente e sites separados.

## Estado auditado
- FUNCIONA: permissão GPS do aparelho; dados offline; catálogo JSON com instalador verificado (A70), ainda vazio; busca offline de nomes/POI/feições; PDF.js raster em canvas local com arquivo original preservado; seis branches antigas à frente da base mas sem commits exclusivos além da main.
- PARCIAL: catálogo não prioriza a posição real GPS; usa centro do mapa, que pode ser padrão; interface não indica região sugerida.
- QUEBRADO: `pdf-preview.tsx` usa `relative w-max` com canvas de largura intrínseca, extravasando tela e posicionando markers em pixels fixos que precisam acompanhar a escala CSS.
- NÃO IMPLEMENTADO: consulta geocodificada completa de endereços fora do índice offline, interface para buscar endereço com gesto explícito, fluxos e testes de indicação de região GPS.
- SEM EVIDÊNCIA: qualquer pacote regional com licenças/URL/download real em produção. Não anunciar regiões que não existem.

## Escopo
1. Na UI do catálogo, consultar permissão já concedida (sem reabrir popup); se concedida, obter GPS atual e destacar região cobrindo [lon,lat] do usuário. Botão de localização manual pode solicitar permissão após gesto explícito. Botão de baixar exige aprovação explícita antes de consumir rede/armazenamento; não usar localização para telemetria, analytics ou envio remoto. Não impedir uso sem permissão.
2. Corrigir PDF em Dados: adaptar ao espaço da tela inteira em altura/largura, sem esticar acima da resolução natural; oferecer zoom para inspeção com rolagem e zoom 'ajustar'. Continuar mostrando original armazenado sem compressão, manter canvas de renderização suficiente (limite de pixels atual) e correta calibração de pontos/markers sobre imagem escalada.
3. Ampliar `OfflineSearch` existente em atalhos do MapLibre para pesquisar endereços: primeira fonte local instalada; opcional online por ato de clicar em 'Buscar endereço na internet', geocodificação pública Nominatim com limite de 1 requisição / segundo no cliente, cache de sessões e atribuição, nunca autocomplete/requisição automática. Se escalar, migrar para provedor dedicado ou API Hono (fora de escopo).
4. Auditar tree/branches e remover somente lixo verificável sem dependência real. Excluir seis branches sem PR aberto e com ahead de branch→main = 0 **apenas quando uma ferramenta autorizada suportar delete**; não usar token/credencial exposta, force push ou GitHub reset. Se não houver ferramental para excluir, registrar e indicar passos seguros sem alegar feito.
5. Testar, publicar **somente app** no Vercel ao final com autorização explícita do pedido, checar URL/versão; manter site separado.

## Fora do escopo e ações proibidas
Gerar/download em massa tiles públicos OSM sem licença, construir cobertura nacional sem fonte, mover app para domínio do site, trocar stack, background GPS, criar nova fonte de verdade, apagar pacotes locais/outbox, regravar GeoPDF, migração destrutiva, force push, excluir main ou branches com commits exclusivos, publicar apps em lojas, mexer em secrets.

## Segurança, privacidade e licenças
Web GPS grant real é superior a qualquer preferência IndexedDB. Região do catálogo se compara localmente; consultas remotas de endereço enviam apenas o termo informado após clique. Rotas offline sem internet continuam. Nominatim não suporta autocomplete nem alto volume; obedeça até 1req/s, identifique app via Referer de sua origem, mostre atribuição e evite alta carga. PDF original nunca é modificado.

## Arquivos
`apps/admin/src/components/map/RegionDownloadCatalog.tsx`, `apps/admin/src/lib/location-consent.ts` e/ou módulo GPS local mínimo, `apps/admin/src/lib/pdf/pdf-preview.tsx`, `apps/admin/src/components/map/OfflineSearch.tsx`, `apps/admin/src/lib/search/address-geocoder.ts`, testes e E2E do app, `docs/offline-map-catalog.md`, `docs/repository-audit.md`, Handoff/Checklist.

## Critérios de aceite
- Sem autorização de GPS: sem popup involuntário, sem download; usuário pode escolher região manualmente.
- Com GPS já concedido: destaque na região correta se pacote cadastrado, ou aviso honesto de ausência de cobertura sem inventar mapa.
- Download somente quando usuário tocar no botão; nenhuma instalação em segundo plano forçada.
- GeoPDF em Android/Windows: altura/largura do canvas visual contidas no viewport, proporção preservada, pontos de calibração sincronizados com CSS; zoom de leitura não altera Blob nem pontos no PDF original.
- Busca local sem internet continua. Consulta online só ao enviar formulário manualmente, suporta resultado e erro/rede desligada.
- Sem branch com trabalho exclusivo excluída. Não apagar arquivos protegidos por licença, testes ou histórico.
- Publicação explícita após build+typecheck+E2E do fluxo crítico aprovados, rollback possível.

## Testes e QA
Revisar lint/typecheck/build Vercel, Vitest módulos GPS/busca, Playwright largura 390 e desktop/perm denied, testes offline já existentes. GitHub Actions pode falhar por billing: não forjar PASS. Real PDF e download regional real pendentes até arquivo/fonte disponíveis. Registrar comandos, evidência, SHAs e estado final.

## Git e relatório
Revalidar HEAD antes de gravar na main; não sobrescrever agentes, PRs ou arquivos novos. Atualizar Notion ao completar. Relatório curto: o que mudou, tests, deploy URL/sha, branches removidas vs pendentes, limitações de catálogo.

## Estado parcial registrado

## A71 — GPS regional, GeoPDF responsivo, endereços locais e higiene segura — 2026-10-13

**Estado base:** auditado `main@421408cb`, Checklist Mestre no Notion e 0 PR aberto. O catálogo A70 ainda está vazio porque não há PMTiles publicados com licença/manifest/Range verificados.

**Implementado na main:** ao abrir a lista de mapas, consultar permissão GPS já vigente sem prompt; o botão "Encontrar mapa da minha localização" solicita autorização apenas no gesto e sugere a **menor região publicada** cuja extensão contém o dispositivo. Não transmite coordenadas e não inicia download sem o botão consciente "Baixar mapa"; mapa anterior/outbox preservados. `PdfPreview` ajusta a rasterização do canvas à largura/altura disponível, sem modificar arquivo PDF nem pontos; botão ampliar/ajustar. Pesquisa da barra MapLibre agora indexa `addr:street`, `addr:housenumber` e `addr:city` dos dados locais; continua offline. Para endereços remotos, foi removida a dependência direta de Nominatim público: só estará habilitado quando uma rota **de mesmo domínio** com provedor autorizado for configurada, pois o Nominatim comunitário proíbe autocomplete e impõe 1 req/s para todo o aplicativo, não apenas cada navegador.

**Repo:** 6 branches legadas comparadas com main: `behind_by=0` em todas (main contém seus commits), sem PR aberto, candidatas à exclusão. Conector GitHub exposto **não suporta apagar refs/branches**; nenhuma branch foi excluída. Pasta local `REPOSITORIOS MODELOS/` ignorada no git e sem arquivos versionados, por isso não houve exclusão dela. Removido somente o `.eslintignore` redundante, pois `apps/admin/eslint.config.js` e `.gitignore` já ignoram dist.

**Evidência:** testes isolados executados com `tsc --strict --target es2022 --module commonjs --skipLibCheck pdf-fit.ts local-map-search.ts` + asserts Node, **TypeScript PASS, 4/4 casos PDF e 2/2 casos de endereços PASS**. Testes Vitest e E2E adicionados ao repo mas **não executados integralmente**. A tentativa de Vercel para o SHA de código foi bloqueada por HTTP 402 `api-deployments-free-per-day` (mais de 100 deployments em 24h), sem publicação do novo app. Sem `vercel` CLI disponível e sem checkout de repo privado no container; build monorepo/typecheck global/E2E e homologação Android físico seguem **PENDENTES**. Nunca declarar sucesso/READY da versão A71. Última Vercel observada em READY era SHA anterior à mudança. Não alterar produção, migrations, segredos ou lojas.

**Próximos passos:** após liberação da quota, executar build/typecheck, testes unitários e E2E Windows/Android emulados, publicar apenas `markmap-app` para teste e validar domínio; depois permitir teste real físico. Para baixar uma região, é preciso publicar os mapas reais A72. Para manter só `main`, excluir as 6 branches manualmente no GitHub com proteção/checagem dos SHAs. Não usar Browser MTS. Referências: `docs/MM-A71-gps-pdf-address-cleanup.md`, `docs/offline-map-catalog.md`, `docs/repository-audit.md`.
