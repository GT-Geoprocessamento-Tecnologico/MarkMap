# Build, deploy e distribuição

## Web

```bash
pnpm build
```

A saída do admin fica em `apps/admin/dist`. O provedor/domínio público ainda não está definido e nenhum deploy foi executado.

## API

`services/api` é Hono/Node. Produção requer `NODE_ENV=production`, HOST/PORT, `CORS_ORIGINS` explícito, DATABASE_URL/NEON_DB_URL e storage somente quando configurado de forma segura.

## Android/iOS

O CI gera artefatos **debug**. Release real ainda requer signing, versionamento e autorização de publicação.

## Banco

Migrations versionadas não significam aplicação em production. Mudança remota destrutiva exige autorização explícita.

## Processo de release

Use [release-runbook.md](release-runbook.md) para preflight, promoção, verificação e rollback. O runbook é preparatório e não autoriza deploy, migration, tag ou publicação.
