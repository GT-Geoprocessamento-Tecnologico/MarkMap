---
title: Integration Details – Backend & Frontend Coordination
date: 2026-09-28
---

# Integration Details – Backend & Frontend Coordination

## Overview
This document resolves open gaps identified during the PRD review (see *GeoNexo – PRD* files). It defines the contracts, UI‑API interactions, and operational expectations required for the parallel agents (`@backend‑visionario` and `@frontend‑visionario`) to work without conflict.

---

## 1. Inspector Contextual (Frontend)

- **Component**: `FeatureInspector` (located in `apps/admin/src/components/FeatureInspector.tsx`).
- **Behaviour**:
  1. When a feature is selected on the map, the inspector slides in from the right as a **Drawer**.
  2. The drawer displays a **dynamic form** generated from the Zod schema `FeatureSchema` (in `packages/contracts/feature.ts`).
  3. Fields are rendered according to their type:
     - `string` → `Input`
     - `number` → `Input` with `type="number"`
     - `enum` → `Select`
     - `boolean` → `Checkbox`
  4. The form is **controlled** – values are stored in a local React state (`dirty: boolean`).
  5. **Save button** triggers a `PATCH /features/:id` request; the button is disabled while `dirty === false`.
  6. **Cancel button** discards local changes and closes the drawer.

- **Error handling**: If the PATCH returns `409 VERSION_CONFLICT`, the UI shows a toast *“Feature has been modified by another user – reload to resolve.”* and refreshes the feature from the server.

---

## 2. Persistence & Dirty State (Frontend ↔ Backend)

| Aspect | Specification |
|--------|----------------|
| **Auto‑save** | **Disabled** – user must explicitly click **Save**. The drawer shows a visual indicator (`*` next to the title) when the form is dirty.
| **Optimistic updates** | Not used in MVP. The UI waits for the server response before updating the TanStack Query cache.
| **Version field** | Every `Feature` carries a `version: number`. The PATCH payload must include this value. The backend validates it and returns **409** on mismatch.
| **Error envelope** | All error responses follow the contract (`error.code`, `error.message`, `requestId`). The frontend maps `code` to toast messages.

---

## 3. Geometry Validation & Type Compatibility

- **Layer → Geometry mapping** (stored in `packages/contracts/layer.ts`):

```ts
export const LayerKind = z.enum(["point","line","polygon","mixed","raster","remote"]);
export type LayerKind = z.infer<typeof LayerKind>;

export const LayerSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  name: z.string(),
  kind: LayerKind,
  srid: z.number().int().default(4674),
  // … other fields
});
```

- **Feature validation** (in `packages/contracts/feature.ts`):

```ts
export const GeometryType = z.enum(["Point","LineString","Polygon"]);
export const FeatureSchema = z.object({
  id: z.string().uuid(),
  layerId: z.string().uuid(),
  geometry: z.object({
    type: GeometryType,
    coordinates: z.array(z.any()), // refined per type (see below)
  }),
  properties: z.record(z.any()),
  version: z.number().int().default(1),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
```

- **Coordinate validation** – added per‑type helpers (stored in `packages/contracts/geometry-helpers.ts`):

```ts
export const PointCoordinates = z.tuple([z.number(), z.number()]);
export const LineStringCoordinates = z.array(PointCoordinates).min(2);
export const PolygonCoordinates = z.array(z.array(PointCoordinates).min(4));

export const GeometrySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('Point'),   coordinates: PointCoordinates }),
  z.object({ type: z.literal('LineString'), coordinates: LineStringCoordinates }),
  z.object({ type: z.literal('Polygon'), coordinates: PolygonCoordinates }),
]);
```

- **Backend enforcement** – the Hono route `POST /features` validates the incoming payload against `FeatureSchema` **and** runs `GeometrySchema` on `payload.geometry`. Invalid geometry yields `INVALID_GEOMETRY` (error code).

---

## 4. Import Flow (Upload UI & API)

### Frontend (apps/admin)
1. User selects **Import** → opens a modal (`ImportModal`).
2. Modal contains a **file picker** (`<input type="file" accept=".geojson,.kml,.zip"/>`).
3. On **Submit**, the file is sent via `POST /imports` using `FormData` with `multipart/form-data`.
4. UI displays a **progress bar** linked to the `Import` resource’s `status` (`queued → processing → completed/failed`).
5. Polling is performed via TanStack Query – `useQuery` with `refetchInterval: 3000` while status is `queued` or `processing`.
6. Errors (e.g., file too large, unsupported format) are shown as toast messages derived from the `error.code`.

### Backend (services/api)
- **Endpoint**: `POST /imports`
- **Payload**: `multipart/form-data` with field `file`.
- **Validation**:
  - Max file size: **10 MiB** (configurable via env `IMPORT_MAX_SIZE`).
  - Allowed extensions: `geojson`, `kml`, `zip` (validated via MIME + magic bytes).
- **Processing**:
  1. Store the raw upload under a temporary directory (`/tmp/imports/<uuid>`).
  2. Immediately create an `Import` record with status `queued`.
  3. Kick‑off an async worker (Node `worker_threads`) that parses the file, validates each feature against `FeatureSchema`, and inserts them in a transaction.
  4. On success → status `completed`, `rowCount` populated.
  5. On error → status `failed`, `errorCode` and sanitized `errorMessage` stored.
- **Security**: The temporary path is outside the project root, removed after processing. No user‑controlled path is ever used.

---

## 5. Performance Budgets (Quality)
| Metric | Budget (max) | Measurement Tool |
|--------|--------------|-----------------|
| **Workspace load** (admin shell) | 1.8 s | Chrome DevTools `Performance` (first contentful paint) |
| **Map initialization** (MapLibre + basemap) | 1.2 s | `performance.now()` measured inside `MapCanvas` mount |
| **Feature list query** (10 k features) | 800 ms | TanStack Query timing logs |
| **Save mutation** (PATCH feature) | 600 ms | Network timing (resource‑timing API) |
| **Import processing** (10 MiB GeoJSON) | 3 s | Server‑side log `process.hrtime` |

These budgets will be enforced in the CI pipeline (see `scripts/perf-check.ts`).

---

## 6. Contract‑First Workflow Reminder
1. **Create / update Zod schema** in `packages/contracts`.
2. **Add unit test** in `packages/contracts/__tests__` that validates a sample payload.
3. **Backend** implements the route using the schema – any mismatch results in a compile‑time type error.
4. **Frontend** consumes the generated TypeScript types via `ts-node` script `scripts/generate-types.ts`.
5. **Commit** the schema and tests together before any implementation.

---

## 7. Next Steps for Agents
- **Backend‑visionario**: ensure `services/api` routes use the new `GeometrySchema` and return proper `INVALID_GEOMETRY` errors.
- **Frontend‑visionario**: implement `FeatureInspector` drawer, import modal, and integrate version‑conflict handling.
- Run the full command suite to verify:
  ```bash
  pnpm install && pnpm lint && pnpm typecheck && pnpm test && pnpm build
  ```
- Once all checks pass, merge the `foundation` branch into `main` and allow parallel agents to proceed.

---

*Document generated by Claude Code – integration of PRDs and gap analysis.*