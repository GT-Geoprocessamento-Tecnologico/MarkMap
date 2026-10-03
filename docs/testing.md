# Testes e qualidade

## Gates do monorepo

```bash
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm test:e2e
```

## CI

Workflows ativos:

- `ci.yml`: lint, typecheck e unit tests;
- `build.yml`: build de todos os pacotes;
- `e2e.yml`: Playwright Chromium, Pixel 7 e iPhone 13/WebKit;
- `integration.yml`: integração offline sync → PostGIS → pull;
- `android-apk.yml`: APK debug;
- `ios-app.yml`: build debug iOS.

CI usa Node 22.

## Estratégia

### Unitários

Vitest cobre contratos, utilitários, repositórios locais, sync, componentes e lógica de backend.

### Integração

O workflow PostGIS sobe `postgis/postgis:16-3.4` e executa testes de `@geonexo/db` contra banco descartável.

### E2E

Playwright valida desktop e perfis mobile. Isso **não substitui testes físicos** de GPS, force-stop, armazenamento ou comportamento de SO.

## Evidência

Uma tarefa só deve ser marcada como concluída quando o gate relevante estiver verde ou a limitação estiver explicitamente registrada.
