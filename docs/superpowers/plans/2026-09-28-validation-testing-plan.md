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