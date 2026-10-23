# MarkMap — PRD / Handoff M6–M7: Curvas de nível e rotas offline

**Data:** 2026-10-09  
**Base remota auditada:** `agent/MM-MAP-310-420-offline-packages@7d97d40dd6849da6d1b0ae5d90f96156736e5b54`  
**Branch isolada:** `agent/MM-MAP-600-640-offline-routing`  
**Versão da aplicação em desenvolvimento:** `0.2.0-dev.0` — sem tag/release.  
**Estado geral:** **PARCIAL**, código implementado; **gate MM-MAP-940 não liberado**.

## Objetivo / contexto

Avançar M6 e M7 sem alterar React/Vite/TypeScript, MapLibre/Terra Draw, IndexedDB/outbox, Hono/Neon, contratos ou políticas de sync remotos desnecessariamente. O gerador regional já criava `routing/graph.json` e `elevation/contours.json`, mas os descartava no manifesto: pacote instalado não continha esses dados. O roteador puro já existia, mas não era conectado à experiência PWA nem respeitava restrições de conversão. Evitar declarar navegação completa sem dados reais/E2E.

## Auditoria e classificação antes/depois

| Área                                        | Antes                          | Nesta branch                                                                                    | Status final                                 |
| ------------------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------- | -------------------------------------------- |
| PMTiles / GeoJSON / IndexedDB local         | FUNCIONA historicamente        | Base preservada                                                                                 | **PARCIAL** até smoke/E2E atual              |
| Grafo em manifesto / instalador / IndexedDB | NÃO IMPLEMENTADO               | Ref opcional com hash/tamanho e capability por perfil; download + pasta local + staging íntegro | **PARCIAL**, sem E2E IndexedDB real          |
| Planejamento offline                        | PARCIAL, algoritmo puro        | Worker isolado, pontos GPS/mapa, escolha de perfil, trilha MapLibre e ETA                       | **PARCIAL**, dados regionais reais faltam    |
| `turnRestrictions`                          | NÃO IMPLEMENTADO               | Estado Dijkstra `{nó, via anterior}`, regras `no_*` e `only_*` para carro                       | **PARCIAL**, sem perfis por restrição em OSM |
| Curvas de nível                             | NÃO IMPLEMENTADO na UI         | Dados regionais opcionais validados e renderizados como linhas no MapLibre                      | **PARCIAL**, sem DEM ou levantamento real    |
| Voz / navegação                             | NÃO IMPLEMENTADO ponta a ponta | Prévia falada da primeira instrução por ação do usuário, quando TTS disponível                  | **PARCIAL**, não é guia GPS turn-by-turn     |

## Escopo implementado

- O mesmo arquivo `graph-format.mjs` define restrições de formato usadas no pipeline Node e no navegador: versão, data/base, bounds, perfis, ids únicos, conexões, velocidades/distâncias, acessos e restrições de conversão; limites defensivos de 8 MiB, 30 mil nós, 70 mil arestas e 10 mil restrições.
- `offlineMapPackageManifestSchema` aceita `routingGraph?` (`routing/graph.json`) e `contourLines?` (`elevation/contours.json`) e exige `capabilities` coerentes; manifest anterior sem opcionais continua aceito. `totalBytes`, `stage`, `install` e download resumível incluem ambos os recursos e SHA-256.
- Pipeline rejeita entradas excessivas ANTES de ler os arquivos para RAM, valida coerência de graph com metadata regional e gera capabilities apenas para os perfis realmente presentes no arquivo.
- Dados de curvas de nível precomputadas usam `interval`/`majorInterval` e linhas `[lon,lat]`; validação de bounds, cotas e 50 mil vértices. Renderização vetorial local, sem rede; não converte dados em DEM.
- `offline-route.worker.ts` carrega o grafo somente do IndexedDB da geração ativa e reconfere o SHA-256 e os metadados do manifest antes de calcular. Tela do mapa recebe painel para GPS de origem, escolha de origem/destino por toque, perfil existente e linha/ETA; sem telemetria remota.
- O roteador respeita `oneway` e bloqueios de conversão de carro, e recusa uma rota se origem/destino estão distantes demais dos nós do grafo (2 km). Caminhada/bicicleta não recebem restrições indevidas de motor-vehicle.
- PWA: voz apenas sob clique explícito e caso `speechSynthesis` exista; não anunciar existência de voz offline.

## Fora do escopo

- **Não** existe geração automática do grafo navegável completo diretamente do OSM PBF do usuário. `graph.json` precisa ser preparado externamente com campos completos; validação impede dados artificiais.
- **Não** existem navegação contínua GPS, map-matching, orientação por voz sincronizada com localização, recálculo, rotatórias/restrições condicionais completas, regiões gigantes, DEM/elevação de pontos sem Z, Wikipedia, metrô, Android Auto/CarPlay.
- Nenhuma alteração em migrações/Neon, credenciais, release, tag, `main`, produção, Vercel ou lojas. Nenhum código/licença GPL/Organic Maps incorporado.

## Arquivos afetados

- `packages/contracts/src/offline-map.ts`
- `packages/maps/src/routing/{graph-format.mjs,graph-format.d.mts,router.ts}`
- `packages/maps/src/elevation/{contour-package.mjs,contour-package.d.mts}`
- `packages/maps/src/offline/package.ts`
- `scripts/{region-pipeline.mjs,region-pipeline.d.mts,offline-routing-phase.test.mjs}`
- `apps/admin/src/lib/storage/{offline-map-store.ts,resumable-installer.ts}`
- `apps/admin/src/pages/{settings/SettingsPage.tsx,workspace/CommandCenterPage.tsx}`
- `apps/admin/src/components/map/OfflineRouting.tsx`
- `apps/admin/src/workers/offline-route.worker.ts`
- `packages/maps/tests/{pipeline/region-pipeline.test.ts,routing/region-graph-format.test.ts}`
- Este documento, `docs/MARKMAP_MASTER.md`, `docs/master-checklist.md`, `docs/handoff.md`.

## Segurança / licenças / riscos

- Manifest e arquivos auxiliares precisam SHA-256, tamanho e validação de estrutura antes de ativar ou usar; nomes de caminho estritos e sem URL externa. Arquivos antigos sem grafo continuam carregando mapa normalmente.
- Acesso GPS depende de permissão explícita; não manter rastreamento em segundo plano. O Worker não faz rede, não acessa API pública e não grava coordenadas em Neon.
- **Risco:** restrições do OSM podem depender de veículo, horário ou condição; contrato atual não expressa esses modificadores. O motor só aplica as restrições declaradas a carro. **NÃO** usar resultados como instrução crítica de trânsito antes do processamento correto de OSM/restrições/E2E.
- **Risco de capacidade:** IndexedDB/quota, dispositivos de baixa memória e custo de varredura devem ser medidos com dados reais. Revalidação duplica temporariamente o buffer em memória; limite de 8 MiB.
- **ODbL:** ao distribuir dados/derivações de OpenStreetMap, manter atribuição e observar obrigações de redistribuição: https://www.openstreetmap.org/copyright.

## Critérios de aceite e QA executada

- [x] Testes de pacote JSON regional, bounds, perfis, digests e rejeições: **9/9** Node locais verdes (`node --test scripts/offline-routing-phase.test.mjs`).
- [x] Testes de motor de rotas isolado: **9/9** Node verdes (inclui restrições `no_*`/`only_*`, sentidos e origem distante); harness isolado de TypeScript, não substitui Vitest.
- [x] `node --check` nos 3 módulos `.mjs` afetados; parse sintático TypeScript/TSX dos 12 arquivos alvo aprovado.
- [x] `tsc --strict` isolado do roteador com interfaces mínimas do contrato.
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`: **não executados no monorepo** (checkout completo/dependências indisponíveis neste ambiente).
- [ ] Playwright Chromium/Firefox/WebKit, IndexedDB verdadeiro, pacote OSM real, PMTiles de extrato real, reabertura PWA offline, GPS navegador/iOS físico e benchmark de memória ainda pendentes.
- [ ] Testar importação por pasta de pacote com grafo+contornos, instalação por URL com HTTP Range e corrupção SHA antes de considerar M7 concluída.

## Checklist de continuidade em ordem

1. [ ] **MM-MAP-900/940**: clonar checkout completo e instalar dependências; lint/typecheck/Vitest/build + E2E local SEM Github CI. Corrigir primeiro qualquer regressão.
2. [ ] **MM-MAP-200/600**: produzir grafo regional REAL derivado de OSM com classificação/carregamento de vias, restrições e metadados, além de PMTiles reais; validar grafo com ferramentas independentes.
3. [ ] **MM-MAP-610/620**: IndexedDB/pacote com grafo/contornos reais; navegador offline, reinício, upgrade/rollback sem perder projetos/dados; medir CPU/memória/quota.
4. [ ] **MM-MAP-630/640**: localização contínua, match-to-route, rerouting, manobras reais, TTS local disponível, acessibilidade, consumo bateria; não bloquear desenvolvimento por falta de aparelho físico, mas não declarar navegação validada.
5. [ ] **MM-MAP-500/530**: fonte DEM licenciada, interpolação real, linhas/topografia 3D, perfil em região sem coordenadas Z, com verificações de precisão.
6. [ ] **MM-MAP-700/710**: avaliar e implementar conteúdo Wikipedia/OSM/metrô com licenças e datasets versionados.
7. [ ] **MM-UPD-020 / MM-MAP-940**: revisão do popup de atualização PWA existente, prova de outbox preservada e gate Web final; PR somente após gates, sem publicar Vercel.

## Regras de Git / ações proibidas / relatório ao próximo responsável

Antes de modificar: reler Fonte do Projeto, este PRD, Checklist do Notion, HEAD, PRs e trabalhos paralelos. Criar branch por fase; respeitar arquivos já editados por outros agentes; nunca reescrever recurso FUNCIONA. Sem GitHub Actions/CI, merges para `main` antes da QA e trava de auto deploy, force push, deploy, publicação, tags/releases, DROP/TRUNCATE/DELETE, migrations destrutivas, rotação de secrets ou pagamentos recorrentes sem autorização.

Relatório obrigatório: `RESULTADO`, `ALTERAÇÕES`, `ARQUIVOS`, `TESTES EXECUTADOS`, `TESTES PENDENTES`, `LICENÇAS`, `RISCOS`, `PRÓXIMO TASK ID`; sincronizar `docs/master-checklist.md`, `docs/handoff.md` e checklist Notion.
