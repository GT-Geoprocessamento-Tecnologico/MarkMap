# Checklist de release

 Testes Node locais no recorte A53–A60 **75/75 PASS, 3 rodadas**, TypeScript strict isolado com stubs e `node --check` PASS. Não equivalem a full monorepo; resultados históricos não homologam HEAD inteiro. Pendentes: lint/typecheck/build/Vitest/Playwright do monorepo, browser IndexedDB/PWA real, Hono/PostgreSQL/Neon/PostGIS integrado, Android/iOS físicos, 2 instalações, privacidade e signing. Nenhum GitHub Actions/CI remoto utilizado. **Release bloqueado; código não bloqueado.**


Este checklist complementa o Checklist Mestre operacional no Notion.

## Código e qualidade — validação do HEAD atual

> **Não homologado:** os workflows da PR #5 em 2026-10-13 não iniciaram jobs por bloqueio de cobrança/limite de gastos informado pelo GitHub Actions. Nenhum lint, typecheck, build, Vitest, Playwright, PostGIS ou teste de segurança passou nesta rodada. Marcas antigas não validam o HEAD atual.

- [ ] Lint do monorepo no HEAD atual.
- [ ] Typecheck do monorepo no HEAD atual.
- [ ] Testes Vitest e regressões Node no HEAD atual.
- [ ] Build do monorepo no HEAD atual.
- [ ] E2E Chromium + Android emulado.
- [ ] E2E WebKit/iOS emulado.
- [ ] E2E sincronização de duas instalações.
- [ ] Integração PostGIS.
- [ ] Auditoria de dependências, secrets e Lighthouse.
- [ ] Android APK debug no HEAD atual.
- [ ] iOS debug build no HEAD atual.

## Offline-first / PWA

- [x] Outbox/retry/idempotência/conflitos automatizados.
- [x] Manifest/service worker/app shell offline.
- [x] Upgrade IndexedDB preservando dados/outbox.
- [ ] Instalação real Android.
- [ ] Add to Home Screen iOS.
- [ ] Force-stop/reabertura offline real.

## GIS

- [x] GeoPDF válido.
- [x] CRS projetado/SIRGAS.
- [x] Auto-calibração por grade com limiar de confiança.
- [x] Fallback manual preservado.
- [ ] PDF grande em aparelho físico.

## Backend/segurança

- [x] Rate limit distribuído.
- [x] Storage por workspace.
- [x] Rotas diretas bloqueadas em production.
- [ ] Smoke production autorizado.
- [ ] Revisão de env/CORS do ambiente final.

## Privacidade/distribuição

- [ ] Política pública aprovada e publicada.
- [ ] domínio/provedor definido.
- [ ] versão/release notes finais.
- [ ] signing Android/iOS.
- [ ] autorização explícita de deploy/publicação.
- [ ] testes físicos finais.
- [x] runbook de release/rollback preparado.
