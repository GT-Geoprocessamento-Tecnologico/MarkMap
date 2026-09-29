# GeoNexo - Monorepo

## Setup

### Prerequisites

- Node.js 20.x
- npm 10.x
- Docker 24.x (for local development with Docker Compose)

### Installation

```bash
# Install dependencies
pnpm install

# Build the project
pnpm build

# Development server
pnpm dev

# Linting
pnpm lint

# Type checking
pnpm typecheck

# Tests
pnpm test
pnpm test:e2e

# Format
pnpm format
```

### Environment Variables

Copy `.env.example` to `.env` and configure your environment variables:

```bash
cp .env.example .env
```

### Environment Variables Reference

- `DATABASE_URL`: PostgreSQL connection string (default: `postgresql://postgres:geonexo@localhost:5432/geonexo?schema=public`)
- `API_URL`: Application API URL (default: `http://localhost:3000`)
- `NODE_ENV`: Environment mode (development, production, etc.)
- `MAP_PROVIDER`: Map provider (default: `openfreemap`)
- `GEOCODER_PROVIDER`: Geocoding provider (default: `openfree`)
- `TILES_URL`: Tile service URL (default: `https://tiles.openfreemap.org/styles/liberty/{z}/{x}/{y}.png`)

### Docker Compose

For local development with PostgreSQL and PostGIS:

```bash
docker-compose up
```

### Project Structure

```
geonexo/
├── apps/
│   └── admin/          # React admin application (Vite + React)
├── services/
│   └── api/            # Hono backend API
├── packages/
│   ├── ui/             # Design system and UI components
│   ├── maps/           # MapLibre and Terra Draw integration
│   ├── geo/            # GIS utilities and spatial operations
│   ├── db/             # Drizzle ORM and database utilities
│   ├── contracts/      # Zod schemas and shared types
│   ├── config/         # Shared configuration files
│   ├── observability/  # Logging and monitoring utilities
│   └── ...             # Other shared packages
├── infra/
│   ├── docker/         # Docker configurations
│   ├── martin/         # Tile server configuration
│   └── scripts/        # Helper scripts
├── docs/
│   ├── adr/            # Architecture Decision Records
│   ├── api/            # API documentation
│   ├── database/       # Database schema and migrations
│   ├── runbooks/       # Operational runbooks
│   ├── quality/        # Quality assurance guidelines
│   └── security/       # Security practices
├── frontend/
│   ├── audit/          # Audit trail and issue tracking
│   ├── prd/            # Product requirements documents
│   ├── page-specs/     # Page specifications
│   ├── contracts/      # Frontend contract definitions
│   ├── data-contracts.md # Data contracts for API integration
│   ├── ui-states.md    # UI state management
│   ├── integrations.md # Integration patterns
│   ├── tasks/          # Task definitions
│   ├── checklists/     # Checklists for QA and development
│   ├── pre-release.md  # Pre-release checklist
│   ├── qa-matrix.md    # QA matrix
│   ├── testing-strategy.md # Testing strategy
│   ├── observability.md # Observability guidelines
│   ├── templates/      # Templates for tasks and pages
│   ├── task-template.md # Task template
│   ├── index.md        # Frontend index
│   ├── felt.md         # Felt design inspiration
│   ├── geist.md        # Geist design inspiration
│   ├── linear.md       # Linear inspiration
│   ├── handoff/        # Handoff documentation
│   └── final-handoff.md # Final handoff documentation
├── docs/
│   ├── adr/            # Architecture Decision Records
│   ├── api/            # API documentation
│   ├── database/       # Database documentation
│   ├── runbooks/       # Runbooks
│   ├── quality/        # Quality guidelines
│   └── security/       # Security practices
├── e2e/                # End-to-end tests
├── .env.example        # Environment variables example
├── .gitignore          # Git ignore rules
├── .editorconfig       # Editor configuration
├── docker-compose.yml    # Docker services configuration
├── AGENTS.md           # Agent ownership mapping
├── README.md           # Project README
└── pnpm-workspace.yaml # Workspace configuration
```

### Handoff

The foundation has been created. The following agents can now work in parallel:

- **Foundation** (this branch): Base setup and configuration
- **Backend** (`agent/backend`): API implementation
- **Frontend** (`agent/frontend`): Admin application development
- **GIS** (`agent/gis`): Map and spatial functionality
- **Database** (`agent/database`): Database schema and migrations
- **Security** (`agent/security`): Security implementation
- **Quality** (`agent/quality`): Testing and quality assurance

## First Steps

1. Run `pnpm install` to install dependencies
2. Run `pnpm typecheck` to verify TypeScript configuration
3. Run `pnpm build` to build the project
4. Run `pnpm dev` to start the development server

The admin shell should render at `http://localhost:5173` once the development server is running.