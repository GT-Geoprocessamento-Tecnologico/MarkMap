# MM-MAP-940 — Gate para PR contra main

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

## Atualização PWA-first — 2026-10-09
**Decisão vigente:** MarkMap é PWA instalável como experiência primária em Android, iOS e desktop; React/Vite/TypeScript, MapLibre, Terra Draw e IndexedDB/outbox permanecem. Capacitor é empacotamento opcional e Android Auto/CarPlay nativos saem do gate de PWA.
**Gate substituído:** testes em aparelhos físicos **não bloqueiam desenvolvimento nem integração PWA**; continuam recomendados para riscos específicos. O merge ainda depende de lint, typecheck, unit, build, E2E WebKit/Chromium/Firefox e simulações offline, com evidência no HEAD atual.
**Correções registradas:** `3f7852e` corrige cache de shell gerado a partir de conteúdo SHA-256 (antes só nomes) e estado falso de instalação em `beforeinstallprompt.userChoice` (instalado apenas com `appinstalled` ou standalone). Teste Node direcionado passou (1/1); Vitest completo pendente pois workspace Git não está montado localmente.
**Deploy:** nenhum deploy intencional, preview deployments desativados em `markmap-app` e `markmap-site` na Vercel. Push em `main` continua potencialmente ativando deploy de produção e permanece condicionado a bloqueio comprovado antes do merge.
**Próximo funcional:** integrar distribuição de regiões offline reais (OSM→PMTiles + glyphs/sprites), instalador resumível, checksum e rollback. Sem afirmar que mapa offline distribuído esteja concluído.

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
- [ ] Teste iOS físico / build nativo (recomendado, fora do gate PWA-first)

### Revisão
- [ ] Diff revisado
- [x] Licenças revisadas (nenhum código GPL copiado; nenhum .mwm/.bin redistribuído)
- [x] Documentação sincronizada (`THIRD_PARTY_NOTICES.md`, `docs/architecture.md`, `docs/user-guide.md`, `docs/testing.md`, `docs/privacy.md`, ADR-0004/0005/0006, handoff — MM-MAP-930)
- [x] Nenhuma ação irreversível pendente
- [ ] Evidência física para recursos específicos (recomendada, não bloqueia merge PWA; Android Auto/CarPlay nativos fora do escopo)

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

*Entregável do MM-MAP-940. Não abrir PR para main até as pendências acima serem fechadas com evidência.*