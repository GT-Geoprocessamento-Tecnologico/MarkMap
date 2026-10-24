# MarkMap — Consolidação de branches, auditoria e M8 offline

**Data:** 2026-10-09. **Produto:** PWA-first, versão de desenvolvimento `0.2.0-dev.0`; `main` permanece na linha estável `0.1.0`.

## 1. Objetivo e decisão vigente

Concentrar **todas as alterações existentes** de Maps Engine v2 em `dev/markmap-pwa-v2`, preservar o histórico dos commits, melhorar a validação local e continuar com conteúdo regional offline **sem GitHub Actions/CI, deploy Vercel ou mudanças em `main`**. A arquitetura continua React/Vite/TypeScript, MapLibre/Terra Draw, IndexedDB/outbox, Hono/Neon/PostGIS. Capacitor permanece opcional; a PWA é o produto principal.

## 2. Auditoria Git e estado REAL

**Main preservada:** `156d4e819d6d876c6150969057f2fc3b9afdad45`.

**Novo ramo consolidado criado:** `dev/markmap-pwa-v2` a partir de `agent/MM-MAP-600-640-offline-routing@86681a9cfab3adcc70746cf79a16c671656ac41a`. Os cinco ramos de desenvolvimento antigos têm relação *ancestral direta*, verificada por comparações GitHub (`behind_by=0` em cada transição); não há commits divergentes entre eles. Nenhum PR aberto foi encontrado na checagem.

| Ramo antigo (candidato à remoção) | HEAD anterior | Posição |
|---|---|---|
| `feat/maps-engine-v2-offline` | `eb8f436` | Ancestral |
| `agent/MM-MAP-200-pwa-regions` | `e0dac95` | Ancestral |
| `agent/MM-MAP-300-400-pwa-integration` | `706650b` | Ancestral |
| `agent/MM-MAP-310-420-offline-packages` | `7d97d40` | Ancestral |
| `agent/MM-MAP-600-640-offline-routing` | `86681a9` | Base exata da consolidação |

**Exclusão remota dos ramos antigos: PENDENTE.** Os conectores GitHub disponíveis não expõem `delete_ref` ou `delete_branch`; tentativa de usar o navegador autenticado falhou por indisponibilidade do serviço, e o browser secundário não possui sessão Github autenticada. **Não afirmar que foram apagados.** Antes da remoção, reconfirmar que os cinco SHAs ainda são ancestrais do novo `dev/markmap-pwa-v2` e que não surgiram PRs/novos commits; depois remover apenas estes cinco ramos pela tela [Branches](https://github.com/mmatteuus/MarkMap/branches) ou por GitHub REST API com permissão `Contents:write`. **Não tocar em `main`.** O histórico permanece acessível no ramo novo.

## 3. Auditoria de código (FUNCIONA/PARCIAL/QUEBRADO/NÃO IMPLEMENTADO)

| Área | Estado observado | Trabalho realizado |
|---|---|---|
| MapLibre, camadas, GeoPDF e outbox | FUNCIONA na baseline histórica, validação integral atual pendente | Sem mudanças estruturais |
| Instalação por pasta regional | QUEBRADO para `searchShards`, `routingGraph`, `contourLines` | **Corrigido**: todos os artefatos opcionais entram na instalação, com validação anterior à ativação |
| Pipeline de PMTiles/rotas/curvas | PARCIAL | Preservado e testado com fixtures; continua sem dados reais/E2E |
| Perfil DEM | QUEBRADO ao converter amostra ausente em 0 m | **Corrigido** para erro explícito, sem altura fictícia |
| Conteúdo Wikipedia/Transporte | PARCIAL; havia stores em memória mas sem empacotamento/visualização | **M8 iniciado:** contrato de manifest com ativos licenciados, pipeline regional, verificação de integridade, IndexedDB, instaladores por URL/pasta, UI offline |
| HTML Wikipedia de legado | QUEBRADO na sanitização regex antiga: atributos/event handlers passavam | **Corrigido** com whitelist de tags sem atributos; M8 usa texto React, nunca HTML injetado |
| Índices de conteúdo | PARCIAL; load acumulava referências antigas | **Corrigido**: substituição completa e limites de busca |
| Atualizações PWA | PARCIAL: popup existe, testes completos pendentes | Sem mudança neste incremento |
| Navegação GPS contínua, DEM regional real, fontes transit/Wikipedia reais | NÃO IMPLEMENTADO plenamente | Backlog, não anunciar conclusão |

## 4. M8 — Contrato offline e integração implementada

Arquivos de entrada **opcionais**, previamente preparados e licenciados pelo publicador, colocados na pasta de entrada do pipeline regional:

- `wikipedia.json` com `regionId`, `version`, `generatedAt`, `attribution`, `license`, `articles[]`. Cada artigo exige `id`, `title`, `summary` (texto), `language`, `attribution` e `license`; pode ter `osmId`, `wikidataId`, `url` HTTPS.
- `transit.json` com `regionId`, `version`, `generatedAt`, `attribution`, `license`, `stations[]`, `lines[]`. Cada estação exige coordenadas dentro dos limites regionais, IDs únicos e linhas existentes.

O pipeline copia os dados validados para `content/wikipedia.json` e `content/transit.json`, adiciona ao manifest `wikipediaPack?`, `transitPack?`, capabilities e somatório de bytes. A etapa de instalação confere SHA-256/tamanho e estrutura **antes** de ativar a nova geração no IndexedDB. Os pacotes legados continuam aceitos sem os opcionais. O mapa oferece painel de consulta local com artigos em texto, atribuição/licença e navegação até estação, sem buscar conteúdo remoto.

**Orçamentos:** 2 MiB por arquivo, até 1.000 artigos, 12.000 estações e 1.000 linhas. **Sem Wikipedia/OSM scraping automático**, sem copiar binários Organic Maps ou código GPL. Os metadados de licença/atribuição são obrigatórios; licença e direito de redistribuição dos datasets reais devem ser verificados antes de publicar um pacote. Fontes: [OpenStreetMap ODbL](https://www.openstreetmap.org/copyright), Wikipedia CC BY-SA conforme a origem dos artigos.

## 5. Arquivos afetados

- `packages/contracts/src/offline-map.ts`
- `packages/maps/src/content/{region-content.mjs,region-content.d.mts,wikipedia.ts,transit.ts}`
- `packages/maps/src/elevation/profile.ts`
- `packages/maps/src/offline/package.ts`
- `packages/maps/tests/content/regional-content-hardening.test.ts`, `packages/maps/tests/elevation/no-invented-altitude.test.ts`
- `scripts/{region-pipeline.mjs,region-pipeline.d.mts,offline-content-phase.test.mjs}`
- `apps/admin/src/lib/storage/{offline-map-store.ts,resumable-installer.ts}`
- `apps/admin/src/pages/{settings/SettingsPage.tsx,workspace/CommandCenterPage.tsx}`
- `apps/admin/src/components/map/OfflineKnowledge.tsx`
- Esta documentação e os espelhos de checklist/handoff.

## 6. Testes e gates

**Executados localmente, sem Github CI:**

- `node --test scripts/offline-routing-phase.test.mjs scripts/offline-content-phase.test.mjs` — **17/17 aprovados** com dados sintéticos, incluindo integridade SHA e rejeições de conteúdo inválido.
- Harness Node isolado para sanitizador, substituição de índices e altitude ausente — **5/5 aprovados** (sem dependências do monorepo).
- `tsc --project .qa/tsconfig.json` — **0 erros**, com interfaces de contratos reduzidas; **não** equivale ao typecheck completo da aplicação.
- Parser TypeScript de 14 arquivos `.ts`/`.tsx`/`.d.mts` alterados — **0 diagnósticos de sintaxe**.
- `node --check` dos módulos `.mjs` afetados — sem erros.

**Não executados:** `pnpm lint`, `pnpm typecheck`, Vitest completo, `pnpm build`, E2E Chromium/Firefox/WebKit, importação IndexedDB real em browser, pacotes OSM/Wikipedia/transporte reais, orçamento de RAM/CPU e navegação GPS. O checkout monorepo com dependências não está acessível no executor atual. Nenhuma dessas verificações pode ser declarada verde.

## 7. Critérios de aceite pendentes e próximos passos

- [x] Ramo único de desenvolvimento criado, com histórico linear preservado.
- [ ] Excluir remotamente cinco ramos antigos após conferência final de refs (ação indisponível nesta integração).
- [x] Corrigir importação por pasta de search/graph/contours antes descartados.
- [x] Implementar núcleo M8 regional Wikipedia e transporte com SHA-256/licenças e UI offline.
- [x] Rejeitar altitude DEM ausente e remover HTML ativo de legado.
- [ ] Rodar `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` e E2E Playwright no HEAD consolidado em checkout real **sem CI GitHub**.
- [ ] Validar pacote PMTiles + graph + search + M8 real no navegador: fechar/reabrir, modo avião, atualização/rollback, nenhuma perda de projetos/outbox.
- [ ] Fazer teste de segurança de importação ZIP/HTML, CORS/downloads e limites de quota com pacote grande.
- [ ] M7: GPS contínuo, recálculo e manobras voz sem serviço cloud; DEM regional com licença/precisão; M8: pipeline de dados reais com atribuição.
- [ ] M10 gate `MM-MAP-940`, medição performance, conformidade ODbL/CC BY-SA, revisão de diff.

## 8. Regras Git, segurança, ações proibidas, handoff

Somente trabalhar em `dev/markmap-pwa-v2`; NÃO criar ramos por tarefa. Antes de editar, comparar `git status`, HEAD, checklist do Notion e mudanças de outros agentes. Commits incrementais com `[skip ci]` conforme política existente. Sem force-push, reset, merge na `main`, GitHub Actions, deploy, tags/releases, secrets, API/banco em produção, migrations destrutivas ou publicação externa. Não declarar versão estável enquanto gate MM-MAP-940 não estiver completo.

**Próximo ID livre:** `MM-MAP-900/940` para QA Web local completo, em paralelo à validação M8 com pacotes reais. Antes de liberar `main`, validar explicitamente as integrações Vercel para não disparar deploy automaticamente. Atualizar Notion, `docs/master-checklist.md` e `docs/handoff.md` em qualquer mudança de estado.
