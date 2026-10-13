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
