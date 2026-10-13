# Checklist de release

> **Gate de release atual: BLOQUEADO (A56 em `dev/markmap-pwa-v2@8435d0d`).** Os `[x]` abaixo registram verificações históricas e **não homologam o HEAD atual**. Nesta rodada **35/35 testes Node backend A53–A56 PASS (3 rodadas)** e TypeScript strict **isolado com stubs** PASS; o histórico de 257/257 de A54 **não foi reexecutado**. Ainda pendentes: lint/typecheck/build/Vitest/Playwright do monorepo, Postgres/Neon real, Android/iOS físico, sync entre instalações, revisão de privacidade e signing. Nenhum GitHub Actions/CI remoto executado manualmente.


Este checklist complementa o Checklist Mestre operacional no Notion.

## Código e qualidade

- [x] Lint verde.
- [x] Typecheck verde.
- [x] Unit tests verdes.
- [x] Build verde.
- [x] E2E desktop/Android.
- [x] E2E iOS/WebKit.
- [x] E2E duas instalações.
- [x] PostGIS Integration.
- [x] Dependency audit (high).
- [x] Secret scan.
- [x] Lighthouse/acessibilidade/best-practices.
- [x] Android APK debug.
- [x] iOS debug build.

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
