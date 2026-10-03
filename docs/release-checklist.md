# Checklist de release

Este checklist complementa o Checklist Mestre operacional no Notion.

## Código e qualidade

- [ ] HEAD confirmado.
- [ ] Lint verde.
- [ ] Typecheck verde.
- [ ] Unit tests verdes.
- [ ] Build verde.
- [ ] E2E desktop/mobile web verdes.
- [ ] Integração PostGIS verde.

## Offline-first

- [ ] Criar/editar localmente sem rede em aparelho real.
- [ ] Force-stop e reabrir mantendo dados.
- [ ] Outbox persistente.
- [ ] Reconexão sincroniza sem duplicação.
- [ ] Conflitos são explícitos.

## PWA

- [ ] Instalação real Android.
- [ ] Add to Home Screen iOS.
- [ ] Atualização preserva IndexedDB/outbox.

## Android

- [ ] APK/debug build verde.
- [ ] MapLibre físico.
- [ ] GPS físico.
- [ ] Uso totalmente offline.
- [ ] Signing/release definido antes de distribuição.

## iOS

- [ ] Build debug verde.
- [ ] GPS físico.
- [ ] Offline físico.
- [ ] Signing/provisioning definido antes de distribuição.

## Backend e dados

- [ ] Health/API validados.
- [ ] Sync real entre duas instalações.
- [ ] Migration remota revisada e autorizada.
- [ ] Nenhuma alteração destrutiva implícita.

## Segurança e privacidade

- [ ] Rate limiting de provision/recover.
- [ ] Storage com autorização por workspace antes de habilitar presign.
- [ ] Revisão de secrets.
- [ ] Política de privacidade pública.

## Release

- [ ] versão/release notes;
- [ ] autorização explícita para deploy/publicação;
- [ ] plano de rollback/suporte.
