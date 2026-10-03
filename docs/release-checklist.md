# Checklist de release

Este checklist complementa o Checklist Mestre operacional no Notion.

## Código e qualidade

- [x] HEAD confirmado — `dd35fcf`.
- [x] Lint verde.
- [x] Typecheck verde.
- [x] Unit tests verdes.
- [x] Build verde.
- [x] E2E desktop/mobile web verdes.
- [x] Integração PostGIS verde.

## Offline-first

- [ ] Criar/editar localmente sem rede em aparelho real.
- [ ] Force-stop e reabrir mantendo dados.
- [x] Outbox persistente coberta por implementação/testes automatizados.
- [x] Retry/idempotência/conflitos cobertos por testes automatizados.
- [x] Conflitos são explícitos.

## PWA

- [ ] Validação automatizada completa de installability.
- [ ] E2E de upgrade preservando IndexedDB/outbox.
- [ ] Instalação real Android.
- [ ] Add to Home Screen iOS.
- [ ] Atualização real em aparelho preservando IndexedDB/outbox.

## Android

- [x] APK/debug build verde no último commit funcional.
- [ ] MapLibre físico.
- [ ] GPS físico.
- [ ] Uso totalmente offline em aparelho.
- [ ] Signing/release definido antes de distribuição.

## iOS

- [x] Build debug verde no último commit funcional.
- [ ] GPS físico.
- [ ] Offline físico.
- [ ] Signing/provisioning definido antes de distribuição.

## Backend e dados

- [x] Health/API cobertos pelos testes automatizados atuais.
- [x] Rate limiting distribuído de provision/recover.
- [x] Storage presign isolado por workspace quando configurado.
- [x] Rotas diretas de domínio bloqueadas em production.
- [ ] E2E de sync/conflict entre dois contextos isolados.
- [ ] Smoke autorizado contra production.
- [ ] Migration remota revisada e explicitamente autorizada antes de execução.
- [x] Nenhuma alteração destrutiva implícita nesta estabilização.

## Segurança e privacidade

- [x] Rate limiting de provision/recover.
- [x] Storage com autorização/namespace por workspace.
- [ ] Dependency/secret/security scans adicionais no CI.
- [ ] Revisão final de secrets/configuração de release.
- [ ] Política pública de privacidade.

## Release

- [ ] domínio/deploy web definido;
- [ ] versão/release notes;
- [ ] autorização explícita para deploy/publicação;
- [ ] plano de rollback/suporte.
