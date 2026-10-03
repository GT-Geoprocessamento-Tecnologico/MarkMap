# Troubleshooting

## App não abre em desenvolvimento

```bash
pnpm install --frozen-lockfile
pnpm dev
```

Confirme Node 22 e porta 5173 disponível.

## Sync aparece disabled

Verifique `VITE_API_MODE`. O padrão atual é `mock`; sync remoto requer `live`.

## Sync falha

- confirme API acessível;
- confirme banco configurado;
- verifique `/health`;
- confira CORS;
- confira capability de workspace;
- não apague IndexedDB para “resolver” antes de preservar evidência/outbox.

## GPS não funciona

- confira permissão do SO;
- Android deve conter FINE e COARSE location;
- iOS deve conter `NSLocationWhenInUseUsageDescription`;
- teste físico é necessário para confirmar comportamento real.

## E2E

```bash
pnpm test:e2e
```

Ou diretamente pelo config:

```bash
pnpm exec playwright test --config=apps/admin/playwright.config.ts
```

## PostGIS

Use o workflow de integração ou banco local descartável com PostGIS. Nunca reutilize produção como banco de teste.

## iOS build

O CI usa projeto versionado + `cap sync ios`; não apague `apps/admin/ios` antes do build.

## Android build

Android é regenerado no CI. Para problemas, reproduza a mesma sequência do workflow `android-apk.yml`.
