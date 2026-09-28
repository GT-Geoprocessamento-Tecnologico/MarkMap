# GeoNexo Foundation – Design Specification (2026-09-28)

## 1. Monorepo Structure
```
geonexo/
├── apps/                     # Application entry points
│   ├── admin/                # Admin shell (React + Vite)
│   ├── field/                # Reserved (no code yet)
│   └── website/              # Reserved (no code yet)
├── packages/                 # Shared libraries
│   ├── ui/                   # Design‑system components (shadcn + Radix UI)
│   ├── maps/                 # MapLibre + Terra Draw adapters
│   ├── geo/                  # Turf/Proj4 utilities, GeoJSON helpers
│   ├── db/                   # Drizzle schema, migrations, API client
│   ├── contracts/            # Zod schemas / TS types
│   ├── config/               # ESLint, Prettier, TS config, env utils
│   └── observability/        # Logger, metrics helpers
├── services/                 # Backend services
│   └── api/                  # Hono HTTP service – health only for now
├── infra/                    # Runtime infra (Docker, scripts – optional)
├── docs/                     # Documentation, ADRs, handoffs
│   ├── adr/
│   ├── api/
│   └── handoff/
└── turbo.json                # Turborepo pipeline
```

### Workspaces
* `pnpm-workspace.yaml` defines `packages/*`, `apps/*`, `services/*`.
* Root `package.json` scripts delegate to Turborepo (dev, build, lint, typecheck, test, format).

### TypeScript
* Strict mode enabled in root `tsconfig.json` and each package's `tsconfig.json`.
* Path aliases (e.g., `"@geo/*": "packages/geo/src/*"`) defined in `packages/config/tsconfig.json`.

### Linting / Formatting
* ESLint config in `packages/config/eslint.config.js`.
* Prettier config in `packages/config/prettier.config.js`.

## 2. Placeholder Admin Shell (`apps/admin`)
* Bootstrapped with **Vite + React + TypeScript**.
* Provides a generic layout: Topbar, Sidebar, Main content area, Footer.
* No business logic – just a router stub and a welcome page.

## 3. Placeholder API Service (`services/api`)
* Implemented with **Hono + TypeScript**.
* Exposes only **GET /api/v1/health** returning `{ "status": "ok" }`.
* CORS limited to `http://localhost:5173` (dev admin).
* Generic error handling middleware installed.

## 4. Documentation & Handoff
* `docs/handoff/final-handoff.md` includes:
  * Directory ownership notes (from PRD).
  * How to run locally (`pnpm dev`, `pnpm api`).
  * Required environment variables (`NEON_DB_URL` placeholder only).
  * Basic CI checks that must pass before merge.

## 5. Build & Test Pipeline (Turborepo)
* Pipeline runs `pnpm lint → pnpm typecheck → pnpm test → pnpm build` for each workspace.
* Each package/app defines its own `turbo` config (small, statically typed).

## 6. Environment Files
* `.env.example` contains placeholder keys, no secrets, complying with PRD rule 41.

## 7. Ownership & Security Conventions
* Files created by the foundation agent are owned as per PRD:
  * Apps → `@frontend-prd-handoff`
  * Services → `@backend-visionario`
  * Packages → respective owners (ui, maps, geo, db, contracts, config, observability).
* API restricted to `localhost` during development; CORS limited accordingly.
* No `DATABASE_URL` exposed to the front‑end.
* All code follows strict TypeScript, no `any` without justification.

## 8. Development Workflow
| Step | Command | Description |
|------|--------|-------------|
| 1 | `pnpm install` | Install workspace dependencies |
| 2 | `pnpm lint` | Run ESLint across repo |
| 3 | `pnpm typecheck` | Strict TypeScript check |
| 4 | `pnpm dev` | Start Vite dev server **and** API via Turborepo |
| 5 | `pnpm test` | Run Vitest unit tests |
| 6 | `pnpm build` | Build all packages and apps |

All scripts must pass for merge readiness.

---

**Next steps**: Please review this spec (the file you just opened) and let me know if any changes are required. Once approved, I will generate the implementation plan and proceed with scaffolding.
