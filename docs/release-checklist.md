# Checklist de release

Este checklist complementa o Checklist Mestre operacional no Notion.

## Código e qualidade

- [x] HEAD confirmado — `8aed47d`.
- [x] Lint verde.
- [x] Typecheck verde.
- [x] Unit tests verdes.
- [x] Build verde.
- [x] E2E desktop/Android web verdes.
- [x] E2E iOS/WebKit verde.
- [x] E2E de duas instalações verde.
- [x] Integração PostGIS verde.
- [x] Android APK debug verde.
- [x] iOS debug build verde.

## Offline-first

- [ ] Criar/editar localmente sem rede em aparelho real.
- [ ] Force-stop e reabrir mantendo dados em aparelho real.
- [x] Outbox persistente coberta por testes.
- [x] Retry/idempotência/conflitos cobertos por testes.
- [x] Conflitos são explícitos e têm resolução testada.

## PWA

- [x] Manifest/installability validados automaticamente.
- [x] Service worker/app shell offline validados automaticamente.
- [x] Upgrade IndexedDB v1→v2 preservando entidade/outbox validado.
- [ ] Instalação real Android pelo navegador.
- [ ] Add to Home Screen iOS.
- [ ] Atualização real em aparelho preservando IndexedDB/outbox.

## Android

- [x] APK/debug build verde.
- [ ] MapLibre físico.
- [ ] GPS físico.
- [ ] Uso totalmente offline em aparelho.
- [ ] Signing/release definido antes de distribuição.

## iOS

- [x] Build debug verde.
- [ ] GPS físico.
- [ ] Offline físico.
- [ ] Signing/provisioning definido antes de distribuição.

## Backend e dados

- [x] Health/API cobertos pelos testes atuais.
- [x] Rate limiting distribuído de provision/recover.
- [x] Storage presign isolado por workspace quando configurado.
- [x] Rotas diretas de domínio bloqueadas em production.
- [x] E2E de sync/conflict entre dois contextos isolados.
- [ ] Smoke autorizado contra production.
- [ ] Migration remota revisada e explicitamente autorizada antes de execução.
- [x] Nenhuma alteração destrutiva implícita nesta estabilização.

## GIS

- [x] GeoPDF com georreferenciamento válido.
- [x] CRS projetado/SIRGAS reprojetado.
- [ ] Auto-calibração robusta de PDF sem georreferenciamento válido.
- [ ] Fluxo manual confirmado em aparelho/fixture adequada.

## Segurança e privacidade

- [x] Rate limiting de provision/recover.
- [x] Storage com autorização/namespace por workspace.
- [ ] Lighthouse/a11y/security/dependency/secret scans adicionais.
- [ ] Revisão final de secrets/configuração de release.
- [ ] Política pública de privacidade.

## Release

- [ ] domínio/deploy web definido;
- [ ] versão/release notes;
- [ ] autorização explícita para deploy/publicação;
- [ ] plano final de rollback/suporte.
