# GeoNexo

**GeoNexo** is an open-source **Progressive Web Application (PWA)** designed for **geospatial data collection, visualization, and offline-first workflows**. Built with modern web technologies (React, TypeScript, Vite, Capacitor) and powered by **Neon** (PostgreSQL‑based backend), GeoNexo enables field teams to capture geographic information, synchronize data when connectivity is restored, and interact with rich map layers—all while maintaining a native‑like experience on Android and iOS devices.

---

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Technology Stack](#technology-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Development](#development)
  - [Building for Production](#building-for-production)
  - [Running the Mobile Apps](#running-the-mobile-apps)
- [Architecture Overview](#architecture-overview)
- [Backend Services](#backend-services)
- [Frontend Modules](#frontend-modules)
- [Testing Strategy](#testing-strategy)
- [CI/CD Pipelines](#ci-cd-pipelines)
- [Contributing](#contributing)
- [License](#license)
- [Support](#support)

---

## Overview

GeoNexo addresses the challenge of collecting reliable geospatial data in environments with intermittent or no network connectivity. It combines:

- **MapLibre GL JS** for high‑performance, customizable vector‑tile maps.
- **Capacitor** to bridge the web app to native device features (GPS, camera, filesystem, etc.).
- **Neon** as a scalable, serverless Postgres backend with branching, autoscaling, and instant restore.
- **React Query** and **Zustand** for state management and data synchronization.
- **Terra‑Draw** for vector drawing and editing on the map.
- **PDF.js** and custom GeoPDF handling for importing/exporting georeferenced PDFs.

The application is deliberately **offline‑first**: all user actions are persisted locally (via IndexedDB) and synchronized with the remote Neon database when a connection becomes available.

---

## Key Features

| Feature | Description |
|---------|-------------|
| **Interactive Map** | Zoom, pan, rotate, pitch; support for raster & vector tile sources (MBTiles, PMTiles, custom WMS/WMTS). |
| **GPS Tracking** | Real‑time location tracking with accuracy circles, heading, and speed; permission handling via Capacitor Geolocation plugin. |
| **Offline‑First Persistence** | Local storage (IndexedDB via Idb) queues edits, inserts, deletions; background sync when online. |
| **GeoPDF Import/Export** | Import georeferenced PDFs, extract georeferencing, overlay as raster layer; export current map view as GeoPDF. |
| **Vector Drawing & Editing** | Terra‑Draw integration for point, line, polygon creation; feature attribute editing via forms. |
| **User Authentication** (planned) | Integration with Neon Auth / Managed Better Auth for secure access. |
| **Role‑Based Access Control** | Fine‑grained permissions for projects, layers, and features. |
| **Multi‑Project Support** | Separate workspaces for different survey areas or clients. |
| **Responsive UI** | TailwindCSS‑styled interface that adapts to mobile, tablet, and desktop screens. |
| **Extensible Plugin Architecture** | Easy to add new map providers, data sources, or custom tools. |
| **Built‑in Logging & Diagnostics** | Console‑level logs, error boundaries, and performance monitoring. |
| **CI/CD Ready** | GitHub Actions workflows for Android APK, iOS builds, lint, typecheck, unit & E2E tests. |

---

## Technology Stack

| Layer | Technology |
|-------|------------|
| **Language** | TypeScript (≥5.5) |
| **Framework** | React 18 + React Router v6 |
| **Build Tool** | Vite 6 (with plugins for SSL, React) |
| **State Management** | React Query (server state), Zustand (client state) |
| **Mapping** | MapLibre GL JS v6 |
| **Drawing** | Terra‑Draw + Terra‑Draw‑MapLibre‑GL adapter |
| **PDF Handling** | PDF.js v6 + custom GeoPDF parser |
| **Styling** | TailwindCSS 3 (JIT) |
| **Icons & UI** | Heroicons, custom SVG icons |
| **Native Bridge** | Capacitor 8 (Core, Geolocation, Filesystem, Splash Screen, Status Bar) |
| **Backend** | Neon (PostgreSQL‑compatible, serverless) |
| **ORM / DB Access** | Custom query builder + Neon‑JS driver |
| **Authentication** | Neon Auth (Managed Better Auth) – integrated via `@neon/auth` |
| **Testing** | Vitest (unit/integration), Playwright (E2E) |
| **Linting & Formatting** | ESLint + Prettier |
| **Type Checking** | tsc (noEmit for faster dev) |
| **Monorepo Manager** | pnpm 9 (workspace‑based) |
| **CI** | GitHub Actions (macOS‑15 for iOS, ubuntu‑latest for Android & web) |

---

## Project Structure

```
GeoNexo/
├─ .vscode/                     # VS Code configuration (launch, extensions)
├─ .github/
│   └─ workflows/               # CI/CD definitions (Android, iOS, lint, test)
├─ apps/
│   └─ admin/                   # Main web app (PWA) source
│       ├─ src/                 # React source code
│       │   ├─ components/      # Shared UI components
│       │   ├─ lib/             # Utilities, hooks, stores, services
│       │   ├─ pages/           # Route‑based pages (login, map, settings, …)
│       │   └─ test/            # Unit & integration test files
│       ├─ public/              # Static assets (favicon, manifest)
│       ├─ capacitor.config.json# Capacitor configuration
│       ├─ vite.config.ts       # Vite build config
│       ├─ tsconfig.json        # TypeScript config
│       └─ index.html           # Shell HTML
├─ packages/                    # Shared libraries (monorepo)
│   ├─ ui/                      # Reusable UI kit (buttons, inputs, modals)
│   ├─ maps/                    # MapLibre wrappers, controllers, layers
│   ├─ geo/                     # Geospatial utilities (bbox, CRS, GeoPDF)
│   ├─ contracts/               # Type‑safe API contracts (generated)
│   ├─ db/                      # Neon database client & query helpers
│   ├─ config/                  # Runtime configuration & env loading
│   └─ ...                      # Other shared packages
├─ services/
│   └─ api/                     # Express‑style backend (if self‑hosted) – optional
├─ docs/                        # (Removed in cleanup – keep only if needed)
├─ .env.example                 # Example environment variables
├─ pnpm-workspace.yaml          # PNPM workspace definition
├─ pnpm-lock.yaml               # Lockfile for deterministic installs
├─ turbo.json                   # TurboRepo config for task caching
├─ README.md                    # This file
└─ LICENSE                      # MIT License
```

---

## Getting Started

### Prerequisites

- **Node.js** ≥ 18 (LTS)  
- **pnpm** ≥ 9 (installed via `npm i -g pnpm` or use corepack)  
- **Git**  
- **(Optional) Android Studio** – for emulators or device testing  
- **(Optional) Xcode ≥ 15** – for iOS simulators or device testing (macOS only)  
- **(Optional) JDK ≥ 11** – if building Android locally  
- **(Optional) Docker** – if you wish to run a local Neon‑compatible Postgres for development  

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/mmatteuus/GeoNexo.git
   cd GeoNexo
   ```

2. Install dependencies (monorepo):
   ```bash
   pnpm install
   ```

3. Environment setup:
   - Copy `.env.example` to `.env` and fill in values (especially `NEXT_PUBLIC_NEON_*` if using Neon).
   - For local development without Neon, you can point to a local Postgres instance by setting `DATABASE_URL` in `.env`.

### Development

Start the web app in dev mode (with hot‑reload):
```bash
pnpm dev   # aliases to: turbo run dev --filter=admin
```
The app will be available at `http://localhost:5173` (HTTPS if using the Vite SSL plugin).

### Building for Production

Create an optimized production bundle:
```bash
pnpm build   # turbo run build
```
Output is placed in `apps/admin/dist`.

### Running the Mobile Apps

#### Android (via Capacitor)

1. Ensure Android SDK & JDK are installed and `ANDROID_HOME` is set.
2. Sync the web assets to the Android project:
   ```bash
   pnpm exec cap sync android   # runs inside apps/admin/
   ```
3. Open in Android Studio (optional):
   ```bash
   pnpm exec cap open android
   ```
4. Build the debug APK:
   ```bash
   cd apps/admin/android
   ./gradlew assembleDebug
   ```
   The APK will be at `apps/admin/android/app/build/outputs/apk/debug/app-debug.apk`.
5. Install on a connected device or emulator:
   ```bash
   adb install -r apps/admin/android/app/build/outputs/apk/debug/app-debug.apk
   ```

#### iOS (via Capacitor – macOS only)

> iOS builds require a macOS machine with Xcode installed.

1. Add the iOS platform (once):
   ```bash
   pnpm exec cap add ios
   ```
2. Sync web assets:
   ```bash
   pnpm exec cap sync ios
   ```
3. Open in Xcode:
   ```bash
   pnpm exec cap open ios
   ```
4. In Xcode, select a simulator or connected device, then press **Run** (⌘R) to build and launch the debug app.

> **Note:** The provided GitHub Actions workflow (`.github/workflows/ios-app.yml`) automates the iOS build on a macOS runner and produces a distributable `.ipa`.

---

## Architecture Overview

GeoNexo follows a **modular, layered** architecture:

1. **Presentation Layer** (`apps/admin/src/pages` & `components`) – React components responsible for UI rendering and user interaction.
2. **State Management Layer**
   - **Server State** (React Query) – handles data fetching, caching, background updates, and optimistic writes to the backend.
   - **Client State** (Zustand) – stores UI‑only state such as map settings, side‑panel visibility, notification queues.
3. **Service Layer** (`lib/services`) – thin wrappers around external APIs:
   - **Geolocation Service** – abstracts Capacitor Geolocation & Web Geolocation API, adds permission handling and toast‑based UX.
   - **Map Service** – encapsulates MapLibre GL instance, layer management, and interaction with Terra‑Draw.
   - **Sync Service** – queues mutations locally and pushes to Neon when online; handles conflict resolution (last‑write‑wins with optional manual review).
4. **Data Access Layer** (`packages/db`) – provides a typed client for Neon, using the Neon JavaScript driver (`@neondatabase/serverless`). Includes helpers for PostGIS functions (if needed).
5. **Backend** (optional) – A thin Express‑like API (`services/api`) can be deployed if you prefer to host your own server instead of using Neon directly. It proxies DB calls and adds custom business logic (e.g., webhooks, scheduled jobs).
6. **Native Bridge** (`capacitor.config.json` + plugins) – Declares which native capabilities are required (Geolocation, Filesystem, Splash Screen, Status Bar). Capacitor copies the web assets into the native project at build time.

### Offline‑First Sync Flow

1. User interacts with the map (e.g., draws a polygon).
2. The action is dispatched to Zustand store → React Query mutates the local cache optimistically.
3. The mutation is also persisted to IndexedDB via a middleware (`sync-engine`).
4. When a network change event detects `online`, the sync engine reads the pending queue and sends a batch request to the backend (`/sync` endpoint).
5. The backend applies the changes to Neon and returns a response; any conflicts are flagged for manual review.
6. On success, the local queue is cleared; on failure, the attempt is retried with exponential backoff.

---

## Backend Services (Neon)

If you opt to use **Neon** (the recommended approach), you will have:

- A **serverless Postgres** instance with autoscaling and branching.
- The **Neon JavaScript driver** (`@neondatabase/serverless`) for low‑latency queries.
- Built‑in **point‑in‑time restore**, **branch‑based workflows** for safe schema migrations, and **read replicas** for scaling reads.
- Optional **Neon Auth** (Managed Better Auth) for user management (login, OAuth, MFA, etc.).

Typical tables (generated via Prisma‑like migrations or raw SQL) include:
- `projects` – metadata about each survey area.
- `layers` – vector/raster layers belonging to a project.
- `features` – GIS features (points, lines, polygons) with GeoJSON geometry and attribute JSONB.
- `sync_logs` – audit of synchronization attempts.
- `users` & `sessions` – if using Neon Auth.

---

## Frontend Modules

- **`@geonexo/ui`** – Reusable UI components (Button, Input, Modal, Toast, LoadingSpinner, etc.) styled with Tailwind and fully typed.
- **`@geonexo/maps`** – Map controller (`MapLibreController`) that handles:
  - Loading raster & vector sources (MBTiles, PMTiles, XYZ, WMS/WMTS).
  - Managing layer visibility and ordering.
  - Listening to map events (move, zoom, click) and forwarding to the Terra‑Draw instance.
  - Converting screen coordinates ↔︎ geographic coordinates (lon/lat).
- **`@geonexo/geo`** – Pure‑geospatial utilities:
  - Bounding box helpers, CRS transformations (via `proj4` if needed), distance/area calculations.
  - GeoPDF parsing (extracting affine transformation, rasterizing pages via PDF.js, and projecting onto map).
  - Validation and simplification of geometries.
- **`@geonexo/contracts`** – Type‑safe API definitions (generated from OpenAPI or hand‑written) shared between frontend and backend to guarantee contract compliance.
- **`@geonexo/db`** – Wrapper around the Neon SQL client with helper functions for:
  - `getProjects`, `getLayersByProject`, `upsertFeature`, `deleteFeature`, `applySyncBatch`, etc.

---

## Testing Strategy

GeoNexo employs a **layered testing approach** aligned with the Test Pyramid:

| Test Type | Framework | Location | Approximate Share |
|-----------|-----------|----------|-------------------|
| **Unit**  | Vitest    | `*/src/**/*.test.{ts,tsx}` and `packages/*/src/**/*.test.ts` | ~70% |
| **Integration** | Vitest (with mocked Neon/db) | Same as unit, focusing on cross‑package interactions | ~20% |
| **E2E**   | Playwright | `apps/admin/e2e/**/*.spec.ts` (or `apps/admin/test/*.test.ts`) | ~10% |

### Running Tests

- **All tests:**
  ```bash
  pnpm test   # turbo run test
  ```

- **Unit only (fast feedback):**
  ```bash
  pnpm test --filter=admin   # and/or filter specific packages
  ```

- **E2E only (requires running dev server):**
  ```bash
  pnpm run test:e2e   # turbo run test:e2e
  ```

### Writing Effective Tests

- Follow the **AAA** pattern: Arrange, Act, Assert.
- Mock external services (e.g., Neon, Capacitor plugins) using `vi.mock()`.
- For UI tests, use `@testing-library/react` with user‑event simulation.
- For E2E, rely on Playwright’s auto‑waiting and locators (prefer `getByRole`, `getByLabelText`, etc.).
- Keep tests **deterministic**: avoid `setTimeout`; use `waitFor` or polling utilities.
- Aim for **meaningful assertions**: test behavior, not implementation details (e.g., “the feature appears on the map after submit” rather than “internal state X equals Y”).

---

## CI/CD Pipelines

The repository uses **GitHub Actions** to automate quality checks and artifact generation.

| Workflow | Trigger | Platform | Artifacts |
|----------|---------|----------|-----------|
| **ci.yml** | `push` / `pull_request` on `main` | ubuntu‑latest | Lint, typecheck, unit test results |
| **e2e.yml** | `push` / `pull_request` on `main` | ubuntu‑latest (with Chrome) | Playwright test videos/screenshots |
| **build.yml** | `workflow_dispatch` or `push` on `main` | ubuntu‑latest | Production web bundle (`.zip`) |
| **android-apk.yml** | `workflow_dispatch` or `push` on `main` | ubuntu‑latest (with Android SDK) | `app-debug.apk` |
| **ios-app.yml** | `workflow_dispatch` or `push` on `main` | macos‑15 (Xcode 15) | `GeoNexo-debug.ipa` |
| **branch-hygiene.yml** | `schedule` (daily) | ubuntu‑latest | Deletes stale branches, enforces naming conventions |

All workflows use **caching** (pnpm store, Gradle, CocoaPods) to speed up subsequent runs.  
Artifacts are retained for 30 days (configurable per workflow).

---

## Contributing

We welcome contributions! Please follow these steps:

1. **Fork** the repository.
2. Create a **feature branch** from `main`: `git checkout -b feature/awesome-feature`.
3. Make your changes, ensuring you:
   - Add or update tests for any new functionality.
   - Keep the lint (`pnpm lint`) and typecheck (`pnpm typecheck`) clean.
   - Follow the existing code style (ESLint + Prettier).
4. Push your branch and open a **Pull Request** against `main`.
5. In the PR description, reference any related issues and summarize the changes.
6. A maintainer will review, run the CI checks, and merge if everything passes.

### Code of Conduct

Please interact respectfully and constructively. Harassment, discrimination, or any unwelcome behavior will not be tolerated.

### Reporting Issues

Use the **Issues** tab to report bugs, request features, or ask for help. Include:
- A clear title and description.
- Steps to reproduce (if applicable).
- Screenshots or console logs.
- Your environment (OS, Node version, device model if relevant).

---

## License

GeoNexo is released under the **MIT License**. See the `LICENSE` file for details.

---

## Support

- **Documentation**: This README, plus inline JSDoc/TSDoc comments throughout the codebase.
- **Community**: Join the discussions in the GitHub **Discussions** tab.
- **Professional Support**: For custom integrations, SLA‑backed hosting, or enterprise features, contact the maintainers via the GitHub profile or email (provided in the repository’s `SECURITY.md` if applicable).

---

*Built with ❤️ for field‑workers, researchers, and anyone who needs reliable geospatial data—online or off.*  