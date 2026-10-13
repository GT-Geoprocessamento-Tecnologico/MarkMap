# Checklist de release

> **Gate de release atual: BLOQUEADO (A57 em `dev/markmap-pwa-v2@df45018`).** Histórico de QA não homologa HEAD inteiro. Nesta rodada **45/45 testes Node do recorte A53–A57 PASS (3 rodadas)**, TypeScript strict isolado com stubs PASS e `node --check` PASS; 257/257 históricos A54 não reexecutados. Ainda pendentes: monorepo lint/typecheck/build/Vitest/Playwright, IndexedDB/PWA em navegador real, Hono/Neon/PostGIS integrado, Android/iOS físicos, duas instalações, privacidade e assinatura. Sem CI remoto.


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
