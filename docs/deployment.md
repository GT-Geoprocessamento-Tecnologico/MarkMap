# Build, deploy e distribuição

## Web

```bash
pnpm build
```

A saída principal do admin fica em `apps/admin/dist`.

Nenhum provedor público específico deve ser tratado como adotado apenas por aparecer em documentação histórica. O domínio/deploy web de produção ainda deve ser definido.

## API

`services/api` é um servidor Hono/Node. Configuração de produção requer no mínimo:

- `NODE_ENV=production`;
- `HOST`;
- `PORT`;
- `CORS_ORIGINS` explícito;
- `DATABASE_URL` ou `NEON_DB_URL`;
- configuração de storage somente quando habilitada com autorização adequada.

## Android

O CI gera APK **debug**, não release assinado.

Produção ainda requer:

- keystore;
- política de assinatura;
- versionamento;
- bundle/release;
- publicação autorizada.

## iOS

O CI gera build debug sem code signing.

Produção ainda requer:

- Apple signing/provisioning;
- bundle/version;
- archive assinado;
- distribuição autorizada.

## Banco

Migrations versionadas não significam que foram aplicadas em produção. Mudança remota destrutiva exige autorização explícita.

## Release

Antes de um RC/publicação:

1. gates CI verdes;
2. testes físicos Android/iOS;
3. PWA instalada e upgrade preservando IndexedDB/outbox;
4. sync real entre instalações;
5. segurança/privacy fechadas;
6. release notes/versionamento;
7. autorização para deploy/publicação.
