# Validation and Testing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement foreign-key validation in project creation, enforce strict geometry validation on feature creation, refactor validation middleware to be fully generic, generate shared Zod contract types, add unit tests for validation logic, verify `/health` endpoint, and run the full verification suite (`lint` → `typecheck` → `test` → `build`).

**Architecture:** 
- Changes are isolated to backend route files (`projects.ts`, `features.ts`), middleware (`validation.ts`), and test files.
- Introduce a generic Zod validation layer that can be reused across all routes.
- Ensure all error responses conform to contract schemas (`ErrorSchema`, `ValidationError`).
- Generate shared contract types from existing Zod schemas to avoid duplication.

**Tech Stack:** 
- TypeScript, Hono, Zod, Drizzle ORM, Neon, Jest (or Vitest), Drizzle queries.

**Spec:** N/A (this plan is the spec)

---

## Global Constraints
- **Foreign-key validation:** A layer cannot be created with a non‑existent project ID. The route must reject with `PROJECT_NOT_FOUND` error.
- **Geometry validation:** Incoming geometry payloads must be strictly validated against `GeometrySchema`. Invalid payloads must return a `400` with `INVALID_GEOMETRY` error.
- **Validation middleware:** Must be fully generic and reusable across all routes. Should transform Zod parse errors into the contract‑defined `ValidationError` format.
- **Error logging:** In production, error details must be redacted; only sanitized messages are returned to the client.
- **Verification order:** `lint` → `typecheck` → `test` → `build`. All steps must pass before a PR can be merged.
- **`/health` endpoint:** Must respond with `200 OK` and a minimal JSON body indicating service health.

---

## Review Focus
- **Missing foreign‑key check** in `POST /projects` path‑parameter validation.
- **Geometry validation bypass** if `GeometrySchema` is not tightly integrated in `POST /features`.
- **Validation middleware** not producing contract‑compliant errors for all Zod failures.
- **Absence of unit tests** for the new validation paths.
- **Race condition** in `softDeleteLayer` that could leave orphaned references.
- **Insufficient test coverage** for newly added validation logic.

---

### Task 1: Generic Validation Middleware Refactor

**Files:**
- Modify: `services/api/src/middleware/validation.ts`
- Test: `services/api/src/middleware/validation.test.ts` (Create)

**Interfaces:**
- Produces: `validate` middleware that returns `ValidationError` formatted responses.

- [ ] **Step 1: Write failing test for Zod error transformation**
  - Create `validation.test.ts`.
  - Mock Hono context.
  - Test that `validate(schema)` returns a 400 with the correct `ValidationError` structure when parsing fails.
- [ ] **Step 2: Implement generic transformation in `validate` middleware**
  - Use `result.error.issues` to map Zod issues to `FieldIssue` as defined in contracts.
  - Ensure the response body matches the contract: `{ error: { code, message, requestId, details } }`.
- [ ] **Step 3: Verify tests pass**
- [ ] **Step 4: Commit**

### Task 2: Foreign-Key Validation in Project Routes

**Files:**
- Modify: `services/api/src/routes/projects.ts`
- Test: `packages/contracts/__tests__\project.existence.test.ts` (Update/Fix)

**Interfaces:**
- Consumes: `projects` table via Drizzle.
- Produces: `PROJECT_NOT_FOUND` error for invalid references.

- [ ] **Step 1: Fix existing `project.existence.test.ts`**
  - The current test is a dummy. Implement a real integration test using a test DB or mock.
- [ ] **Step 2: Implement existence check in `POST /projects` (and any others referencing projects)**
  - Mirror logic from `createLayer` in `packages/db/src/queries/layers.ts`.
- [ ] **Step 3: Verify tests pass**
- [ ] **Step 4: Commit**

### Task 3: Strict Geometry Validation in Feature Routes

**Files:**
- Modify: `services/api/src/routes/features.ts`
- Test: `packages/contracts/__tests__\geometry.test.ts` (Update)

**Interfaces:**
- Consumes: `GeometrySchema` from `@geonexo/contracts/geometry-helpers`.
- Produces: `INVALID_GEOMETRY` error.

- [ ] **Step 1: Ensure `POST /features` uses `GeometrySchema` strictly**
  - Verify `validate(GeometrySchema)` is used.
  - Ensure that internal `createFeature` errors regarding geometry are mapped to `INVALID_GEOMETRY`.
- [ ] **Step 2: Write test for invalid GeoJSON payloads**
  - Test Point, LineString, Polygon with incorrect coordinates/types.
- [ ] **Step 3: Verify tests pass**
- [ ] **Step 4: Commit**

### Task 4: Error Handler Redaction and Production Safety

**Files:**
- Modify: `services/api/src/middleware/error-handler.ts`
- Test: `services/api/src/middleware/error-handler.test.ts` (Create)

**Interfaces:**
- Produces: Redacted error logs and sanitized client responses in production.

- [ ] **Step 1: Write test for secret masking in logs**
  - Test `maskSecrets` function with passwords, tokens, etc.
- [ ] **Step 2: Implement production-mode redaction in `createErrorHandler`**
  - Ensure `detail` is truncated/masked when `NODE_ENV === 'production'`.
- [ ] **Step 3: Verify sanitized client response**
  - Test that stack traces and raw error messages are hidden in production.
- [ ] **Step 4: Commit**

### Task 5: Type Generation and Final Verification

**Files:**
- Modify: `scripts/generate-types.js`
- Test: Full suite (`pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`)

**Interfaces:**
- Produces: Synced types in `packages/contracts/src/generated/`.

- [ ] **Step 1: Run type generation script**
- [ ] **Step 2: Resolve any remaining `pnpm typecheck` errors**
- [ ] **Step 3: Run `pnpm lint`**
- [ ] **Step 4: Run `pnpm test`**
- [ ] **Step 5: Run `pnpm build`**
- [ ] **Step 6: Verify `/health` endpoint**
- [ ] **Step 7: Final Commit**
