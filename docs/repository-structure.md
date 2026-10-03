# Estrutura do repositório

GeoNexo é um monorepo pnpm/Turbo.

```text
.
├── apps/
│   └── admin/          # PWA React/Vite e projetos Capacitor
├── services/
│   └── api/            # API Hono
├── packages/
│   ├── config/         # configuração compartilhada
│   ├── contracts/      # contratos Zod compartilhados
│   ├── db/             # Drizzle, migrations, queries e PostGIS
│   ├── geo/            # CRS, medições e GeoPDF
│   ├── maps/           # abstrações cartográficas
│   └── ui/             # componentes UI
├── docs/               # documentação oficial
├── scripts/            # scripts auxiliares
├── .github/workflows/  # CI/CD
├── package.json
├── pnpm-workspace.yaml
├── pnpm-lock.yaml
└── turbo.json
```

## Diretórios gerados/ignorados

Não devem entrar no Git:

- `node_modules`
- `dist`, `build`
- `.turbo`
- relatórios Playwright
- arquivos `.env*` sensíveis
- Android gerado em `apps/admin/android/`
- assets/builds iOS gerados
- diretórios locais de referência/modelos

O projeto iOS base versionado é preservado em `apps/admin/ios`, enquanto Android é regenerado pelo workflow.
