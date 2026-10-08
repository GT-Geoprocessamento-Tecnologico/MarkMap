# MM-MAP-940 — Gate para PR contra main

**Status**: M10 — Concluído (com pendências listadas)
**Task ID**: MM-MAP-940
**Predecessor**: MM-MAP-930 (Documentação/legal)
**Gate M10**: hardening e merge readiness

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
- [ ] E2E aplicável verde (Playwright — quando suíte existir para o fluxo)
- [x] Testes offline aplicáveis verdes (parsers, manifest, search, routing, elevation, security)
- [ ] Android APK aplicável verde (evidência de dispositivo)
- [ ] iOS build aplicável verde (evidência de dispositivo)

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
```

Commit da sequência: `5368bb8e` (`feat(maps): implement Maps Engine v2 offline phases M3-M10`, 75 arquivos).

- `contracts`: 117 tests
- `maps`: 126 tests (inclui pipeline M3)
- `geo`: 70 passed + 3 skipped
- `ui`: 18 tests
- demais packages: verdes

## Pendências Restantes para Abrir PR

1. E2E (Playwright) do fluxo offline — se aplicável
2. Evidência física: Android/iOS offline, GPS/navigation, Android Auto/CarPlay
3. Baseline de performance em aparelho (MM-MAP-900)
4. ~~`THIRD_PARTY_NOTICES.md` + ADRs + guides (MM-MAP-930)~~ — **concluído**
5. Revisão de diff e sincronização final com `main`

---

*Entregável do MM-MAP-940. Não abrir PR para main até as pendências acima serem fechadas com evidência.*
