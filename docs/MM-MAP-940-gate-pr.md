# MM-MAP-940 — Gate para PR contra main

## Progresso M4/M5 — 2026-10-09 (ainda PARCIAL)

**Branch de continuidade:** `agent/MM-MAP-300-400-pwa-integration`, derivada de `agent/MM-MAP-200-pwa-regions@e0dac95`; sem alteração em `feat/maps-engine-v2-offline` ou `main`. **Versão de trabalho:** `0.2.0-dev.0`.

- [x] **MM-MAP-300 parcial:** GPX (waypoints, tracks/segmentos, rotas e altitude) integrado à página Dados; arquivo original e GeoJSON WGS84 validados/salvos offline.
- [x] **MM-MAP-310 parcial:** KML (pontos, linhas, polígonos simples com anéis, altitude) integrado; KMZ e estilos avançados ainda pendentes.
- [x] **MM-MAP-320 parcial:** exportação de GeoJSON normalizado e do original GPX/KML; round-trip completo com persistência em navegador ainda pendente.
- [x] **MM-MAP-400 parcial:** correspondência de IDs do gerador regional (`a0`/`0-9`/`other`) no runtime; shards ainda não empacotados/ativados no dispositivo.
- [x] **MM-MAP-410/420 parcial:** busca por palavras internas com limite e consultas vazias seguras; painel no mapa via Worker busca feições locais já carregadas e centraliza resultados. **Não é busca de POIs OSM regionais distribuídos ainda**.
- [x] **QA direcionada:** 20/20 testes Node passaram, 16 arquivos TS/TSX com sintaxe válida, `tsc --strict` isolado dos módulos puros. Sem GitHub CI.
- [ ] **QA completo:** lint/typecheck/Vitest/build/Playwright do monorepo, navegador IndexedDB, PWA offline e dados OSM reais não executados.
- [ ] **Próxima prioridade:** persistência e carga verificada dos shards de busca de pacotes OSM (MM-MAP-400/410), depois KMZ/round-trip M4, E2E e gate MM-MAP-940.

**Documento de continuidade:** `docs/MM-MAP-300-420-pwa-continuity.md`. Nenhum deploy, release/tag, migration ou merge na `main`.

## Incremento 2026-10-09 — M1/M2/M3 PWA-first, ainda PARCIAL

- **Branch de trabalho:** `agent/MM-MAP-200-pwa-regions`, derivada de `feat/maps-engine-v2-offline@eb8f436` (HEAD de integração não modificado).
- **MM-MAP-200 PARCIAL:** conversor limitado de OSM PBF para MVT/PMTiles v3 sem internet, `region.json` + `manifest.json`, estilo MapLibre básico e sprites PNG/JSON locais. Não processa relações, rótulos/fontes nem regiões grandes; faltam extrato real e leitura PMTiles independente.
- **MM-MAP-130 PARCIAL:** retomada de download HTTP Range com checksum SHA-256 e staging persistente separado via IndexedDB. UI de URL HTTPS em Configurações permite apontar `manifest.json`; só ativa após validar todos os arquivos, mantendo mapa anterior em falhas. Faltam E2E/IndexedDB em navegador e hospedagem/CORS real.
- **MM-MAP-140 PARCIAL:** integridade real do mapa via revalidação de blobs no gerenciador; reparo automático permanece indisponível (sem sucesso falso).
- **MM-UPD-010 PARCIAL:** `version.json` gerado e pré-cacheado no shell com versão, SHA opcional, horário e protocolos. Exibição na interface e protocolo de compatibilidade completo não validados.
- **QA direcionada:** `node --test` = 12/12 aprovados (PBF sintético, PMTiles diretório, HTTP Range, URL, SHA, shell); `node --check` verde. `tsc` isolado com mocks anteriores NÃO é typecheck do monorepo. **NÃO executados:** lint/typecheck/build/Vitest/E2E completos, distribuição real OSM e PWA offline em dispositivo/navegador.
- **Gate:** testes físicos Android/iOS não bloqueiam desenvolvimento PWA, mas a integração em `main` ainda é proibida enquanto o gate Web, revisão de segurança e controle de deploy não estiverem verdes. Nenhum deploy, migration, release ou produção autorizados/executados.
- **Próximo:** validar pacote com extrato PBF real e leitor PMTiles, validar IndexedDB/Playwright, corrigir o pipeline conforme evidência, completar catálogo/update e testes de integração. M4→M8 permanecem parciais/históricos e M9 nativo fora do escopo PWA.

**Status**: BLOQUEADO — MM-MAP-940 não aprovado (auditoria de 2026-10-09)
**Task ID**: MM-MAP-940
**Predecessor**: MM-MAP-930 (Documentação/legal)
**Gate M10**: hardening e merge readiness

## Auditoria 2026-10-09 — estado verificado (prevalece sobre os registros históricos abaixo)

**main:** `156d4e8`; **branch de desenvolvimento:** `feat/maps-engine-v2-offline`; **versão de trabalho:** `0.2.0-dev.0`.
**Situação:** MERGE PARA MAIN BLOQUEADO, por segurança funcional e para impedir publicação Vercel automática. Ambos os projetos Vercel (`markmap-site`, `markmap-app`) continuam ligados ao GitHub. Nenhum deploy Vercel nem CI GitHub foi iniciado manualmente nesta auditoria.

**Classificação:**

- **FUNCIONA (evidência histórica):** núcleo MapLibre/Terra Draw, operações locais IndexedDB/outbox, GeoPDF e PMTiles/PWA pré-existentes. Resultados históricos no gate são anteriores a esta auditoria.
- **PARCIAL:** gerador regional (agora exige arquivo PMTiles e manifest corretos, mas não gera tiles OSM); prompt PWA (correção de checagem de atualização, sem E2E novo); parsers GPX/KML, busca, roteamento, elevação e conteúdo offline (implementações no código sem comprovação completa em aparelho e distribuição regional).
- **BLOQUEADO:** instalador regional `MM-MAP-130` explicitamente desativado/fail-closed depois de identificar download simulado e ativação de staging vazio; gestão de atualização/reparo regional `MM-MAP-140` sem serviço real; gate `MM-MAP-940` ainda não satisfeito.
- **NÃO COMPROVADO:** renderização de PMTiles regional real, download resumível, pacote com glyphs/sprites locais, iOS build e testes físicos, navegação por voz/Android Auto/CarPlay e métricas de memória/bateria.

**Correções auditadas:** script `scripts/region-pipeline.mjs`, testes do pipeline/tipos, `ResumableInstaller`, `RegionManager` e `UpdatePrompt`. Agora rejeitam entradas incompletas e não alegam instalação/reparo realizado sem dados. **Validação atual executada sem CI:** `node --check`; **7/7 testes direcionados com Node**; parser TypeScript sem erros sintáticos nos 5 arquivos auditados. **Não executados nesta sessão:** pnpm lint/typecheck/Vitest/Playwright/build completo, iOS, testes em aparelhos físicos (workspace completo indisponível e dispositivo remoto offline). Portanto não é possível garantir que tudo funcionará em produção.

**Próximas tarefas prioritárias na ordem de dependências:** `MM-MAP-200` (OSM PBF → PMTiles real + glyphs/sprites + pacote testado); `MM-MAP-130` (download/Range/resume/checksum/staging/activate/rollback reais); `MM-MAP-140` (gestor/updates/reparo seguros); `MM-UPD-010/020` (versões PWA/Capacitor com compatibilidade/outbox e E2E); `MM-MAP-900/940` (perf/dispositivos/iOS + diff + qualidade local completa); depois habilitar PR para `main` apenas com deploy automático Vercel efetivamente bloqueado e validações verdes.

Os itens anteriores marcados como concluídos permanecem como **evidência histórica de desenvolvimento**, não como liberação atual para merge/release.

## Objetivo

Não abrir PR para `main` até que a checklist completa abaixo esteja verde.

## Branch

- Integração desta iniciativa: **`feat/maps-engine-v2-offline`**
- PR de agentes individuais aponta para `feat/maps-engine-v2-offline`, **não** para `main`
- PR final para `main` só depois que esta checklist passar

## Checklist do Gate

### Código e build

- [x] Integração branch atualizada com main sem apagar trabalho
- [x] Lint verde
- [x] Typecheck verde (`tsc --noEmit` em todos os packages)
- [x] Unit/integration verdes (`npx turbo run lint build test --filter='./packages/*' --force` → 15/15)
- [x] Build verde (`npx turbo run build --filter='./packages/*'` → 5/5)
- [x] E2E aplicável verde (Playwright — 5 projetos: chromium, firefox, webkit, pixel-7, iphone-13)
- [x] Testes offline aplicáveis verdes (parsers, manifest, search, routing, elevation, security)
- [x] Android APK aplicável verde (evidência de dispositivo: `app-debug.apk` 6.5 MB instalado e executando no emulador Android_17; captura em `docs/quality/screenshots/android-emulator-launch.png`)
- [ ] iOS build aplicável verde (evidência de dispositivo — exige macOS/Xcode)

### Revisão

- [ ] Diff revisado
- [x] Licenças revisadas (nenhum código GPL copiado; nenhum .mwm/.bin redistribuído)
- [x] Documentação sincronizada (`THIRD_PARTY_NOTICES.md`, `docs/architecture.md`, `docs/user-guide.md`, `docs/testing.md`, `docs/privacy.md`, ADR-0004/0005/0006, handoff — MM-MAP-930)
- [x] Nenhuma ação irreversível pendente
- [ ] Evidência física registrada para recursos que exigem aparelho (offline Android/iOS, GPS/nav, Android Auto/CarPlay, baseline perf MM-MAP-900)

### Gate explícito do PRD

- [x] Nenhum código GPL do openstreetmap-website
- [x] Nenhum Data File .mwm/.bin do Organic Maps redistribuído
- [x] Recursos de GeoPDF, desenho, sync e PWA não regridem (testes existentes verdes)

## Evidência Executada Nesta Sequência

```
npx turbo run lint build test --filter='./packages/*' --force   → 15/15 successful
cd apps/admin && pnpm lint                                       → 0 problems
cd apps/admin && pnpm typecheck (tsc --noEmit)                   → 0 errors
cd apps/admin && pnpm test (vitest)                              → 21 files, 91/91 passed
cd apps/admin && pnpm build (tsc --noEmit && vite build)         → built, manifest 15 assets
cd apps/admin && pnpm test:e2e (Playwright, 5 projetos)          → 95 passed / 20 skipped / 0 failed
cd apps/admin && npx cap add android && ./gradlew assembleDebug  → BUILD SUCCESSFUL (app-debug.apk 6.5 MB)
adb install -r app-debug.apk (emulador Android_17)               → Success; MainActivity resumed,
                                                                   UpdatePrompt visível com Atualizar agora / Depois
```

Commit da sequência: `5368bb8e` (`feat(maps): implement Maps Engine v2 offline phases M3-M10`, 75 arquivos).

- `contracts`: 117 tests
- `maps`: 126 tests (inclui pipeline M3)
- `geo`: 70 passed + 3 skipped
- `ui`: 18 tests
- demais packages: verdes

## Pendências Restantes para Abrir PR

1. ~~E2E (Playwright) do fluxo offline~~ — **concluído**: `pnpm test:e2e` em `apps/admin`
   → 95 passed / 20 skipped / 0 failed (chromium, firefox, webkit, pixel-7, iphone-13).
   Correções incluídas: prompt `aria-label` + CSS fixo, "Depois" persistente por sessão,
   waits de modo de desenho e de durabilidade do IndexedDB no WebKit.
2. Evidência física: ~~Android build + instalação~~ — **concluído** localmente
   (`apps/admin/android` é regenerável/gitignorado): `cap add android` → `assembleDebug` →
   `adb install` no emulador `Android_17`, `MainActivity` em foreground e UpdatePrompt visível
   (captura em `docs/quality/screenshots/android-emulator-launch.png`, fora do versionamento).
   **Restam**: iOS (exige macOS/Xcode), GPS/navigation em aparelho real, Android Auto/CarPlay
3. Baseline de performance em aparelho (MM-MAP-900)
4. ~~`THIRD_PARTY_NOTICES.md` + ADRs + guides (MM-MAP-930)~~ — **concluído**
5. Revisão de diff e sincronização final com `main`

---

_Entregável do MM-MAP-940. Não abrir PR para main até as pendências acima serem fechadas com evidência._
