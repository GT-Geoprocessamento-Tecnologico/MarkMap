A248 — PRD integraçao E2E pos PR104-109

Objetivo: preservar seis PRs integradas em 3128e86f e atualizar testes E2E desfasados com a UI atual, sem alterar produto.
Contexto: A247 CI estrito e build 8/8 PASS, Chromium 31 PASS/16 FAIL; A246 com testes corrigidos 47/47 PASS.
Escopo: cinco arquivos E2E de frontend, GeoTIFF, GPS/GeoPDF e KML, configuração QA local na porta loopback 5194. Fora do escopo: regras do produto, frontend, backend, SW, schemas, Neon, Google Auth, deploy ou qualquer branch alheia.
Arquivos afetados: apps/admin/e2e/{frontend-flows,geotiff-import-and-overlay,gps-geopdf-address-a71,gps-geopdf-alignment,kml-georeferenced}.spec.ts e apps/admin/playwright.a248.local.config.ts.
Seguranca: dados sintéticos, IndexedDB isolado por perfil Playwright, sem acesso a dados reais; API_MODE mock, armazenamento local, sem login obrigatório, sem rede remota.
Critérios: git diff --check 0; typecheck/lint; 47 testes Chromium aprovados; não reduzir asserts nem mudar produto, descrever skips/limites do Firefox quando aplicável.
QA/documentação: evidência em ~/.cache/a248-qa com comandos, logs e exit codes; atualizar Obsidian/Notion.
Regras Git: branch qa/pr104-109-e2e-a248-20261105 baseada em 3128e86f, não modificar A247/A234, não push/merge main/release/deploy.
Ações proibidas: force push, reset, limpar IndexedDB/outbox, migrações, secrets, mexer em projetos alheios.
Riscos: copiar somente testes E2E validados A246 não prova inexistência de regressão na soma das PRs; rodar regressão efetiva.
Relatório final esperado: SHA, comandos, PASS/FAIL, mudanças, bloqueios e próximo passo.
