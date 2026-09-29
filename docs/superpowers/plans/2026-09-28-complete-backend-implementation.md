# Complete Backend Implementation Plan

> **For agentic workers:** REQUIRED SUB‑SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task‑by‑task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the GeoNexo backend to a production‑ready state by enforcing foreign‑key validation, strict geometry validation, log redaction, generic validation middleware, generating shared Zod contracts, and running the full verification suite.

**Architecture:** The plan is split into independent tasks that each touch a small number of files. Implementations are aligned with the existing Hono + Drizzle+Neon stack.

**Tech Stack:**
- TypeScript
- Hono
- Drizzle‑ORM with Neon (Postgres)
- Zod
- PNPM workspaces
- Node ≥ 18

**Spec:** `docs/superpowers/specs/2026-09-28-backend-implementation.md` (see the spec for the requirements). The plan follows the spec verbatim.

---

## Global Constraints
- No production code should be exposed to real secrets.
- All changes must compile with `pnpm typecheck`.
- Unit tests should cover the new validations.
- Documentation must be updated to reflect runtime flags.

---

## Review Focus
- FK validation failures are returned with `PROJECT_NOT_FOUND`.
- Geometry validation errors return `INVALID_GEOMETRY`.
- Error logs expose only masked or truncated details in prod.
- Validation middleware types match the schema types.
- Generated Zod types sync frontend and backend.
- Full CI passes without lint or type errors.

---

## Task Breakdown

### Task 1: Enforce foreign‑key validation when creating a Layer
**Files to touch:**
- `services/api/src/routes/layers.ts`
- `packages/db/src/queries/layers.ts` (if needed)

**What to do:**
- Verify that the `projectId` passed to `createLayer` exists in the `projects` table.
- If it does not exist, throw an `ErrorSchema` with code `PROJECT_NOT_FOUND`.
- Add a unit test in `packages/contracts/__tests__/layers.test.ts` (create if missing) that covers the failure path.
- Commit with `feat: enforce FK validation for layers`.

### Task 2: Mirror project‑id existence check in the POST /projects route
**Files to touch:**
- `services/api/src/routes/projects.ts`
- Possibly `packages/db/src/queries/projects.ts`

**What to do:**
- In the `app.post('/api/v1/projects'...)` route, before creating a new project, check that the `projectId` field (if present) exists in the `projects` table.
- If missing, throw `ErrorSchema` with code `PROJECT_NOT_FOUND`.
- Add a unit test in `packages/contracts/__tests__/projects.test.ts` for this case.
- Commit with `feat: validate projectId on project creation`.

### Task 3: Enforce strict geometry validation on POST /features
**Files to touch:**
- `services/api/src/routes/features.ts`
- `packages/contracts/geometry-helpers.ts`
- Add or confirm unit test in `packages/contracts/__tests__/geometry.test.ts`.

**What to do:**
- Use `GeometrySchema` for validation in the `app.post('/api/v1/features')` route.
- Ensure any invalid geometry payload results in an `INVALID_GEOMETRY` error.
- Commit with `feat: strict geometry validation for features`.

### Task 4: Redact sensitive data in error‑handler logs
**Files to touch:**
- `services/api/src/middleware/error-handler.ts`

**What to do:**
- In production mode, truncate or mask the `detail` field (e.g., `detail.slice(0, 1000)` or regex mask for common secret patterns).
- Keep the full detail in development mode.
- Add a unit test ensuring that in a mocked prod environment, the logged detail is truncated.
- Commit with `fix: redact error logs in production`.

### Task 5: Make validation middleware fully generic
**Files to touch:**
- `services/api/src/middleware/validation.ts`

**What to do:**
- Replace any `any` casts with generic type inference from the Zod schema.
- Ensure `c.req.valid()` returns the correct type without `any`.
- Add a test confirming the middleware infers the type correctly.
- Commit with `refactor: generic validation middleware`.

### Task 6: Generate shared Zod contract types
**Files to touch:**
- `scripts/generate-types.ts` (execute)
- `packages/contracts/src/generated/` (output)

**What to do:**
- Run the script to generate TypeScript types from Zod schemas.
- Commit the generated files.
- Add a CI check that the generated types compile.
- Commit with `chore: generate shared Zod contracts`.

### Task 7: Run the full verification suite
**Commands to run:**
- `pnpm install`
- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`

**What to do:**
- Track and fix any lint or type errors.
- Ensure all tests pass, especially the new FK and geometry tests.
- Commit any fixes.
- Commit with `chore: run verification suite`.

### Task 8: Spin up a local Neon database
**Setup commands:**
- `neon init` (if not already done)
- `neon link` (create and link a branch)
- Run migrations from `packages/db` or with `pnpm db:migrate`.
- Add a placeholder `.env` with `DATABASE_URL=placeholder`.

**What to do:**
- Document steps in `LOCAL-RUN.md`.
- Commit the documentation.
- Commit with `docs: add local database setup docs`.

### Task 9: Start the dev server and verify endpoints
**Commands:**
- `pnpm dev`
- Verify `/health` is 200.
- Verify Swagger/OpenAPI docs load.
- Test core routes with `curl` or automated scripts.
- Record any failures and fix.
- Commit with `chore: dev server health check`.

---

## Execution Handoff
After this plan is committed, the user should decide whether to run it using the **Subagent‑driven** approach or **Native**. If Subagent‑driven is chosen, invoke the `superpowers:subagent-driven-development` skill on this plan file. If Native, invoke the appropriate executing‑plans skill.

**Please confirm the chosen approach and any additional constraints** before we begin.
