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
- `e2e.yml`:
  - Chromium desktop + Pixel 7;
  - iPhone 13/WebKit;
  - Chromium com **duas instalações isoladas** em live mode;
- `integration.yml`: integração offline sync → PostGIS → pull;
- `android-apk.yml`: APK debug;
- `ios-app.yml`: build debug iOS.

CI usa Node 22.

## Estratégia

### Unitários

Vitest cobre contratos, utilitários, repositórios locais, sync, componentes e backend.

A PWA possui testes de contrato para:

- manifest standalone;
- link do manifest no shell;
- ícones PNG 192/512 normais e maskable;
- dimensões reais dos ícones;
- viewport sem bloqueio de zoom;
- política do service worker e handshake de update.

### Integração

O workflow PostGIS sobe `postgis/postgis:16-3.4` e executa testes de `@geonexo/db` contra banco descartável.

### E2E PWA

Playwright Chromium comprova:

- service worker ativo e controlando a página;
- manifest e ícones acessíveis;
- reload do app shell totalmente offline;
- upgrade de IndexedDB v1 para v2;
- preservação de workspace, entidade e outbox durante o upgrade.

### E2E de sync em duas instalações

Dois contextos Chromium isolados executam o app em `VITE_API_MODE=live` contra um servidor de sync determinístico do teste. O fluxo cobre:

- provision/recovery de capability;
- operação criada offline;
- commit seguido de erro HTTP e retry;
- resposta `alreadyApplied` sem duplicação;
- pull para a segunda instalação;
- duas edições concorrentes;
- `VERSION_CONFLICT`;
- resolução explícita pela interface.

O servidor de teste não substitui o PostGIS: persistência/materialização real continua coberta pelo workflow de integração.

### Limites

Automação **não substitui**:

- instalação PWA em aparelho real;
- GPS/force-stop/storage do SO;
- teste físico Android/iOS;
- smoke autorizado contra production.

## Evidência

Uma tarefa só é marcada concluída quando o gate relevante está verde ou a limitação está explicitamente registrada.
