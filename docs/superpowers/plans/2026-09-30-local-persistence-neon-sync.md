# Local Persistence and Neon Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver an anonymous, local-first GeoNexo workspace whose edits, tombstones, conflicts, and scoped PDF blobs survive offline use and synchronize idempotently with an isolated Neon/PostGIS API.

**Architecture:** The browser owns versioned IndexedDB stores and an immutable outbox. A server-issued workspace capability scopes every API operation; only a server-side hash is persisted for bearer verification. Hono routes write workspace-scoped Drizzle repositories, accept idempotent push batches, and expose cursor pull; the client preserves local edits and explicit conflicts while acknowledgements advance only the operation they acknowledge. PDF bytes remain in a browser blob store and use scoped API upload sessions for resumable transfer.

**Tech Stack:** Vite/React, IndexedDB, TypeScript, Zod shared contracts, Hono, Drizzle ORM, PostgreSQL/PostGIS, Neon TCP, MapLibre, Vitest, Playwright, and a disposable loopback PostGIS integration target.

**Spec:** `docs/superpowers/specs/2026-09-29-geonexo-localfirst-geopdf.md`

## Global Constraints

- No login screen, login route, login redirect, or credential prompt.
- No browser Neon driver, connection string, service key, or database password.
- The installation identifier is metadata only; it is never accepted as authorization.
- Every API read/write is scoped by a validated workspace capability; pull cursor scope is derived from that capability, never from a client workspace parameter.
- Capability bearer material is stored in IndexedDB; only a server-side hash is persisted in the database.
- Bearer and raw bootstrap proof are canonical unpadded base64url encodings of exactly 32 bytes (43 characters); the runtime must generate them with a cryptographically secure random source. Syntax validation alone does not establish entropy.
- Each feature geometry is limited to 10,000 coordinate positions; the runtime also rejects request bodies above 1 MiB before JSON parsing.
- Persist an entity change and its outbox operation atomically; never silently evict unsynced work.
- Outbox operations are immutable and idempotent; a lost response must be safe to retry.
- A durable pull cursor is allocated under a workspace row lock in the same transaction that commits the change, preventing out-of-order sequence skips.
- Older operation acknowledgements must not overwrite newer local changes; predecessor/dependency information remains explicit.
- Sync conflicts preserve both sides and require an explicit resolution action; no silent last-write-wins.
- PDF import must fail for unsupported CRS/profile/limits/password/corruption and must never guess ordinary PDF placement.
- Use only a positively identified disposable PostGIS target for migrations and destructive integration setup.
- Do not add dependencies or edit manifests in this plan without an approved dependency decision.
- Shared `ImportMetadata` and `BlobRef` types are defined once in `packages/contracts/src`; PDF and sync tasks consume them.
- API traffic uses `/api/v1`; Vite uses a same-origin `/api` proxy in development and same-origin production serving.

## Review Focus

- Lost push/upload response after the server commits: retry by immutable operation/upload identifiers and assert no duplicate row or blob.
- Two tabs or concurrent devices pushing the same workspace: lock the writer, preserve predecessor chains, and assert no cursor gap or reordered acknowledgement.
- A stale local edit acknowledged after a newer local edit: retain the newer entity/outbox record and expose the predecessor relationship.
- Revoked/malformed/empty capability and guessed `installationId`: reject before repository access without treating installation metadata as auth.
- Oversized, password-protected, unsupported-CRS, corrupt, or interrupted PDF blob: reject or resume within limits without losing the local original or claiming placement.

---

## File Map and Ownership

The implementation must keep these boundaries. A task may modify only the paths listed in its own section and indispensable shared contract files listed in Task 1.

- `packages/contracts/src/workspace.ts`: canonical workspace/capability/bootstrap/recovery schemas.
- `packages/contracts/src/sync.ts`: canonical operation, cursor, tombstone, conflict, and push/pull schemas/types.
- `packages/contracts/src/map.ts`: canonical map projection reused by local persistence and sync.
- `packages/contracts/src/offline-map.ts`: canonical bounded offline package manifest.
- `packages/contracts/src/pdf.ts`: the single canonical `GeoReference`, `BlobRef`, and `ImportMetadata` definition shared with the PDF plan.
- `packages/db/src/schema/workspaces.ts`, `sync.ts`, `imports.ts`, and `packages/db/src/queries/*`: workspace-scoped persistence, idempotency, ordering, tombstones, and blob metadata. Backend owns these paths.
- `packages/db/drizzle/*`: forward-only migrations owned by backend/database; run only against the disposable target.
- `services/api/src/middleware/workspace-capability.ts`, `routes/workspaces.ts`, `routes/sync.ts`, `routes/imports.ts`, and workspace repositories/tests: API owner implements the HTTP boundary.
- `apps/admin/src/lib/local-db/*`, `local-repositories/*`, `sync/*`, and tests: frontend owner implements IndexedDB, atomic outbox, retry/locking, and conflict UI state.
- `apps/admin/src/lib/api-client.ts` and its consumer test: frontend owner aligns `/api/v1`; same-origin service-worker/Vite changes remain exclusively in the PWA plan.
- `apps/admin/e2e/*`: quality owner runs real API plus isolated DB browser tests; no mocked sync assertions.

## Dependency Graph and Bounded Ownership

```text
Written-plan PASS -> Task 1 contracts (= G0.2; one implementation task)
Task 1 / G0.2 -> G0.5 W0 map proof (consumes the frozen manifest)
G0.2 + G0.3 + G0.4 + G0.5 evidence -> independent gate review -> Task 2 DB/migrations
                                                            -> Task 6 local store (parallel, separate files)
Task 2 -> Task 3 runtime -> Task 4 capability -> Task 5 CRUD/sync/upload API
Tasks 5 + 6 -> Task 7 sync engine -> Task 8 transport integration -> Task 9 real E2E
```

- Task 1 is the contract implementation portion of master G0.2; it is not downstream of G0.2. After written-plan PASS, the contracts owner may complete Task 1 while the independent G0.3 parser proof, G0.4 metadata/drift inventory, and security review proceed. G0.5 W0 starts only after these contracts are implemented and independently reviewed.
- Tasks 2–9 and production PDF/map/PWA builders remain blocked until fresh G0.2–G0.5 evidence passes independent review. The G0.4 inventory is read-only; migrations/writes require the positively identified disposable target and any separately required authorization.
- Task 1: contracts owner; one writer for `packages/contracts/src`; its output is exactly the shared contract output of G0.2.
- Task 2: backend/database owner; one writer for `packages/db` and migrations.
- Tasks 3–5: backend/API owner; one writer for `services/api`.
- Tasks 6–8: frontend persistence/integration owner; one writer per assigned frontend directory.
- Task 9: quality/security owner; read-only review plus E2E fixtures, repairs assigned back to the owning task.
- PDF parser, PWA, basemap, and device-sensor work remains behind the root-owned architecture/specification gates and is not implemented by this plan.

## Task 1: Freeze shared sync and import contracts

**Files:**

- Create: `packages/contracts/src/workspace.ts`, `packages/contracts/src/sync.ts`, `packages/contracts/src/pdf.ts`, `packages/contracts/src/map.ts`, `packages/contracts/src/offline-map.ts`
- Modify: `packages/contracts/src/index.ts`
- Test: `packages/contracts/tests/sync.test.ts`

**Interfaces:**

- `GeoReference` is imported from `packages/contracts/src/pdf.ts` and has the exact PDF-plan shape: `profile`, `sourceCrs`, `pageIndex`, `cropBox`, `rotation`, `controls`, `neatline`, affine `transform`, and `residual`.
- `BlobRef = { id: string; sha256: string; bytes: number; mediaType: string }`.
- `ImportMetadata = { id: string; projectId: string; originalName: string; source: BlobRef; format: "pdf"; state: "queued" | "processing" | "needs-calibration" | "ready" | "failed"; pageCount: number | null; geoReference: GeoReference | null; errorCode: string | null }`.
- `WorkspaceCapability = { workspaceId: string; bearer: string; generation: string; issuedAt: string }` is a client-only response shape; bearer is canonical unpadded base64url of 32 random bytes. The server persists only a digest and generation. Generation is an unsigned integer encoded as decimal text.
- `BootstrapProof = { installationId: string; proofDigest: string; createdAt: string }` is the server record; the raw proof stays in IndexedDB and `installationId` is never sufficient authorization.
- `CapabilityProvisionRequest = { bootstrapProof: string; installationId: string; workspaceId: string }`; `CapabilityRecoveryRequest = { bootstrapProof: string }`. Raw proof is canonical unpadded base64url of 32 CSPRNG bytes; the client generates/persists the requested workspace UUID offline so queued operation scope never needs rewriting.
- `CapabilityProvisionResponse = WorkspaceCapability`; clients durably retain only the highest returned generation.
- `SyncEntity = "project" | "map" | "layer" | "feature" | "import"`.
- `SyncEntityPayload = { entity: "project"; data: ProjectSyncData } | { entity: "map"; data: MapSyncData } | { entity: "layer"; data: LayerSyncData } | { entity: "feature"; data: FeatureSyncData } | { entity: "import"; data: ImportMetadata }`, where the projections preserve canonical invariants, reject unknown fields, and bound layer style/metadata JSON.
- `FeatureSyncData.geometry` allows no more than 10,000 coordinate positions per non-collection geometry; the API body limit remains 1 MiB.
- `SyncUpsertOperation = { operationId: string; workspaceId: string; entity: SyncEntity; entityId: string; operation: "upsert"; payload: SyncEntityPayload; baseVersion: number | null; predecessorOperationId?: string; createdAt: string }`.
- `SyncDeleteOperation = { operationId: string; workspaceId: string; entity: SyncEntity; entityId: string; operation: "delete"; baseVersion: number | null; predecessorOperationId?: string; createdAt: string }`.
- `SyncOperation = SyncUpsertOperation | SyncDeleteOperation`.
- `SyncCursor` is an opaque string `v1.<base64url-payload>.<base64url-HMAC-SHA256>`; the signed payload contains workspace UUID and committed sequence. The schema checks token syntax only. Pull middleware verifies the MAC and binds its workspace to the capability before calling a repository with the decoded internal sequence; repositories do not trust a client workspace field.
- `Tombstone = { entity: SyncOperation["entity"]; entityId: string; version: number; sequence: string; deletedAt: string }`
- `SyncConflict = { operationId: string; entity: SyncEntity; entityId: string; baseVersion: number | null; serverVersion: number; localPayload?: SyncEntityPayload; serverPayload?: SyncEntityPayload; reason: "VERSION_CONFLICT" | "SCOPE_REJECTED" }`; `SCOPE_REJECTED` uses `serverVersion: 0` and never carries `serverPayload`; `VERSION_CONFLICT` requires a positive server version.
- `PushSyncAck = { operationId: string; version: number; sequence: string; predecessorOperationId?: string }`; `PushSyncRequest = { operations: SyncOperation[] }`; `PushSyncResponse = { accepted: PushSyncAck[]; conflicts: SyncConflict[]; alreadyApplied: PushSyncAck[] }`. Replayed operations return their original durable version/sequence, not just IDs.
- `ServerChange = { operationId: string; entity: SyncEntity; entityId: string; operation: "upsert"; payload: SyncEntityPayload; version: number; sequence: string } | { operationId: string; entity: SyncEntity; entityId: string; operation: "delete"; version: number; sequence: string }`.
- `PullSyncResponse = { changes: ServerChange[]; tombstones: Tombstone[]; nextCursor: SyncCursor; hasMore: boolean }`. An empty page preserves the input cursor (initial sequence `"0"`); the last nonempty page returns its last applied sequence even when `hasMore=false`. Never reset the durable cursor to null at end of pagination.
- Entity discriminants and payload entity/ID must match; schema tests reject mismatched project/map/layer/feature bodies, unknown fields, missing upsert payload, payload on delete, scope-conflict server payload, malformed 32-byte secret encodings, and over-budget geometry.

- [x] **Step 1: Write schema tests** for exact PDF-plan `BlobRef`/`ImportMetadata`, bootstrap proof versus installation ID, bounded operation/entity discriminants, cursor syntax, immutable predecessor IDs, and operation payloads without `unknown`.
- [x] **Step 2: Run focused contract tests** and use their results to repair schema/projection mismatches before freezing the boundary.
- [x] **Step 3: Implement the schemas/types** with Zod discriminated unions and bounded payload metadata; do not use `z.any()` for geometry, operation envelopes, or blob references.
- [x] **Step 4: Export from `packages/contracts/src/index.ts`** and rerun `pnpm exec vitest run tests/sync.test.ts tests/contracts.test.ts tests/import.test.ts` plus `pnpm --filter @geonexo/contracts typecheck`.
- [x] **Step 5: Independently review JSON shapes and the dependency graph** against Tasks 2–4 before marking the contract design gate done. Runtime enforcement remains downstream.

## Task 2: Add workspace-scoped PostGIS persistence

**Files:**

- Create: `packages/db/src/schema/workspaces.ts`
- Create: `packages/db/src/schema/sync.ts`
- Modify: `packages/db/src/schema/index.ts`
- Modify: `packages/db/src/schema/projects.ts`, `layers.ts`, `features.ts`, `imports.ts`
- Create: `packages/db/drizzle/0001_workspace_sync.sql`
- Modify: `packages/db/src/queries/workspaces.ts`, `sync.ts`, `projects.ts`, `layers.ts`, `features.ts`, `imports.ts`
- Test: `packages/db/tests/integration/workspace-sync.test.ts`

**Interfaces:**

- `createWorkspace(db, input: { workspaceId: string; proofDigest: string; capabilityHash: string; generation: string }): Promise<{ workspaceId: string }>` binds a previously unused client workspace UUID to its private proof. Unique workspace/proof constraints and revocation checks apply.
- `findWorkspaceByCapabilityHash(db, hash: string): Promise<{ workspaceId: string } | null>`
- `applyPushOperation(db, input: SyncOperation, capabilityWorkspaceId: string): Promise<{ status: "accepted" | "already_applied" | "conflict"; version?: number; sequence?: string; conflict?: SyncConflict }>`
- `pullChanges(db, input: { workspaceId: string; afterSequence: string; limit: number }): Promise<{ changes: ServerChange[]; tombstones: Tombstone[]; lastSequence: string; hasMore: boolean }>`; the API signs `lastSequence` into the next cursor. This DB method accepts only the workspace derived from a verified capability and the sequence decoded from a MAC-verified cursor.
- `createUploadSession(db, input: { workspaceId: string; metadata: ImportMetadata }): Promise<{ blobId: string; uploadId: string }>`

- [ ] **Step 1: Write failing disposable PostGIS tests** for workspace foreign keys, workspace-scoped project/layer/feature/import rows, unique `(workspace_id, operation_id)`, tombstones, and cursor ordering.
- [ ] **Step 2: Run the focused integration file** with only `TEST_DATABASE_URL` pointing to the approved loopback database; confirm schema/query failures.
- [ ] **Step 3: Add forward-only migration/schema** with workspace IDs on every synchronized entity, capability hash only, operation idempotency, durable sequence, tombstones, and indexes by `(workspace_id, sequence)`.
- [ ] **Step 4: Implement `applyPushOperation`** in one transaction: lock the workspace row, check operation idempotency, verify the base version, write entity/tombstone, allocate sequence, and commit the idempotency result atomically.
- [ ] **Step 5: Implement `pullChanges`** from the verified internal sequence. API middleware verifies the cursor HMAC and workspace binding before repository access; the API signs the returned last sequence into `nextCursor`.
- [ ] **Step 6: Add live tests** for duplicate push, lost-response retry, stale version conflict, delete tombstone retention, cursor monotonicity under concurrent transactions, and cross-workspace denial.
- [ ] **Step 7: Run migration and the full DB integration suite** only against the approved disposable target; capture migration, test, and exit-code evidence.

## Task 3: Make API runtime dependencies injectable

**Files:**

- Modify: `services/api/src/env.ts`, `services/api/src/server.ts`, `services/api/src/app.ts`
- Modify: `services/api/src/lib/db.ts` and existing DB-using route handlers to consume the typed injected request/runtime dependency, not the process-global singleton
- Test: `services/api/tests/server.test.ts`, `services/api/tests/env.test.ts`

**Interfaces:**

- `ApiRuntimeDeps = { getDb: () => Db; closeDb: () => Promise<void> }` is passed into server/app construction. Production creates an owned `createDb(env.DATABASE_URL)` handle from the resolved server Env; tests supply an isolated handle. A closed runtime rejects later DB calls; routes never fall back to the module-time process-global singleton.
- `startServer(env: Env, deps: ApiRuntimeDeps, serveImpl?: ServeImpl): { server: Server; shutdown: Shutdown }` owns only the server it starts.
- `createGracefulShutdown(server: ClosableServer, closeDb: () => Promise<void>, timeoutMs?: number): Shutdown` is idempotent, bounded, and invalidates its owned handle after close.

- [ ] **Step 1: Write failing tests** for injected DB access, server startup without module-time environment snapshots, idempotent SIGINT/SIGTERM cleanup, and a second `getDb` call after shutdown failing closed.
- [ ] **Step 2: Run `pnpm --filter api exec vitest run tests/server.test.ts tests/env.test.ts`** and confirm the current module singleton behavior fails.
- [ ] **Step 3: Refactor runtime construction** so `loadEnv`/DB handles are supplied at startup and no test imports start a live listener or capture stale environment variables.
- [ ] **Step 4: Verify bounded/idempotent shutdown** with an injected fake server and DB handle, then run API typecheck.

## Task 4: Provision and enforce anonymous workspace capability

**Files:**

- Create: `services/api/src/middleware/workspace-capability.ts`
- Create: `services/api/src/routes/workspaces.ts`
- Modify: `services/api/src/app.ts`, `services/api/src/env.ts`
- Test: `services/api/tests/workspace-capability.test.ts`

**Interfaces:**

- `createBootstrapProof(): { installationId: string; workspaceId: string; rawProof: string }` runs before offline edits/first online attempt and stores the private proof/scope only in IndexedDB. The server independently computes its digest from validated proof bytes.
- `hashCapability(raw: string): string` and `verifyCapability(raw: string, digest: string): boolean` remain server-only utilities; raw bearer/proof values are never logged or stored server-side.
- `workspaceCapability(): MiddlewareHandler` sets typed context `{ workspaceId: string }` after `Authorization: Bearer <capability>` verification.
- `POST /api/v1/workspaces/provision` consumes `CapabilityProvisionRequest` and atomically creates/replays `WorkspaceCapability` after verifying or registering the proof binding.
- `POST /api/v1/workspaces/recover` consumes `{ bootstrapProof: string }` and atomically rotates/reissues a lost bearer for the same workspace; installation ID alone cannot recover it.
- `POST /api/v1/workspaces/revoke -> 204` revokes the current capability without accepting an installation ID as authority.

**Bootstrap mechanism:** the client creates 32 cryptographically random private proof bytes and a workspace UUID, saving both before offline edits or provisioning. Initial provisioning is intentionally open to create a new anonymous workspace. The server computes the proof digest itself and atomically binds an unused requested workspace UUID to that unique digest; it never claims that an unregistered proof establishes a person's identity. An already bound UUID with another proof is rejected without revealing its owner. Repeated requests with the private proof find the same workspace. Public installation/workspace IDs cannot recover or authorize it. Rate/body/workspace quotas guard anonymous creation. Stable scope keeps offline outbox envelopes immutable.

**Lost response:** the server stores bearer hashes, so it cannot replay a random bearer verbatim. Provision/recover reissues a new bearer under the same workspace row lock and increments `generation`; identity/data creation is idempotent, token issuance rotates. Clients persist the greatest generation atomically, retry if a newer lost response invalidated their token, and never replace a newer token with an older late response. Revocation invalidates the proof binding and bearer together: the proof cannot recreate/recover that revoked workspace. Only an explicit new-workspace action generates a new proof; old local data remains exportable.

- [ ] **Step 1: Write failing API tests** for proof creation before first online attempt, idempotent provision replay, malformed/empty bearer, lost provision response plus recovery, revoked bearer, guessed `x-installation-id`, and cross-workspace access.
- [ ] **Step 2: Run `pnpm --filter api exec vitest run tests/workspace-capability.test.ts`** and confirm failure.
- [ ] **Step 3: Implement proof hashing, verification, typed context, and provisioning** with bounded random bytes; never log or persist raw proof/bearer.
- [ ] **Step 4: Apply middleware to workspace-scoped routes** and map missing/invalid scope to the shared typed error envelope.
- [ ] **Step 5: Implement revocation semantics**: recovery is disabled after revoke unless the client explicitly starts a new workspace intent; old local data remains retained but is not silently rebound.
- [ ] **Step 6: Verify raw proof/bearer is returned only over the intended response, never in logs/database rows/browser URL state, and capability rate/size caps are enforced.

## Task 5: Align workspace-scoped CRUD and sync API

**Files:**

- Modify: `services/api/src/routes/projects.ts`, `layers.ts`, `features.ts`
- Create: `services/api/src/routes/sync.ts`
- Create: `services/api/src/routes/imports.ts`
- Modify: `services/api/src/storage.ts`; create `services/api/src/storage/{blob-store,local-blob-store,s3-blob-store}.ts`
- Modify: `services/api/src/app.ts`
- Test: `services/api/tests/workspace-crud.test.ts`, `sync.test.ts`, `imports.test.ts`

**Interfaces:**

- `POST /api/v1/sync/push` consumes `PushSyncRequest` and returns `PushSyncResponse`.
- `GET /api/v1/sync/pull?cursor=<opaque>&limit=<bounded>` returns `PullSyncResponse`.
- `POST /api/v1/imports` consumes bounded `ImportMetadata` and returns the server import record plus scoped `BlobRef`.
- `POST /api/v1/imports/:id/upload-session` consumes `{ uploadId: string; source: BlobRef }` and returns `{ uploadId: string; blobId: string; partSize: number; expiresAt: string }`. The client-generated upload UUID is only an idempotency ID; the authenticated workspace and import ownership authorize it. Same ID/different metadata is rejected.
- `PUT /api/v1/imports/:id/blob/:uploadId/:part` streams a zero-based part with checksum header; enforce 5 MiB maximum per part after workspace authorization, shorter final part only, 25 MiB file total. Duplicate same part/hash is idempotent; same index/different bytes is rejected.
- `GET /api/v1/imports/:id/upload-session/:uploadId` returns `{ uploadId: string; state: "uploading" | "finalizing" | "complete" | "expired"; receivedParts: { part: number; bytes: number; sha256: string }[]; source: BlobRef }` for reconnect/status reconciliation.
- `POST /api/v1/imports/:id/complete` consumes `{ uploadId: string }`, verifies final byte count/hash and is retryable after lost response or interruption between object-store completion and DB acknowledgement.
- `GET /api/v1/imports/:id/blob` authorizes workspace/import/source ownership and streams the verified BlobRef with bounded range support. The client never supplies an object-store key.
- `BlobStore` adapter supplies `putPart`, `listParts`, `complete`, `head`, `readRange` and `abort`, all keyed by server-generated workspace/import/upload paths. Development integration uses an explicitly owned temporary filesystem root; production uses the existing S3-compatible adapter only after credentials/provider are explicitly configured. Missing production blob storage is a reported gate, not a fake upload success.

- [ ] **Step 1: Write failing route tests** for CRUD scope, push/pull envelopes, duplicate request bodies, stale conflicts, tombstones, bounded import metadata, and lost upload completion response.
- [ ] **Step 2: Run focused API tests** and confirm missing routes/scope behavior.
- [ ] **Step 3: Mount `/api/v1` routes** and delegate all writes to Task 2 repositories; do not duplicate SQL or accept client-selected workspace IDs.
- [ ] **Step 4: Implement idempotent push/pull** preserving `operationId`, predecessor, conflict, and cursor semantics.
- [ ] **Step 5: Implement scoped upload sessions** with server-generated keys, byte limits, checksum verification, expiry, status/download endpoints and safe completion replay. Persist finalizing state; reconcile an already completed object by head/hash before committing complete metadata. Do not assume object-store and SQL commit are atomic. Only a verified complete source may be announced as remotely available.
- [ ] **Step 6: Run API contract tests against the disposable PostGIS target** and verify no response contains capability hashes, Neon URLs, or provider errors.

## Task 6: Build versioned IndexedDB and atomic local repositories

**Files:**

- Create: `apps/admin/src/lib/local-db/schema.ts`
- Create: `apps/admin/src/lib/local-db/database.ts`
- Create: `apps/admin/src/lib/local-repositories/entities.ts`, `outbox.ts`, `blobs.ts`, `index.ts`
- Create: `apps/admin/src/lib/hooks/useLocalWorkspace.ts`
- Root-only integration: `apps/admin/src/pages/workspace/CommandCenterPage.tsx`, `apps/admin/src/pages/imports/ImportsPage.tsx`; this task supplies repository hooks/events and focused tests but does not edit these pages.
- Test: `apps/admin/src/test/local-db-migrations.test.ts`, `local-repositories.test.ts`, `local-workspace-hook.test.ts`

**Interfaces:**

- Stores: `workspace`, `projects`, `maps`, `layers`, `features`, `imports`, `blobs`, `outbox`, `tombstones`, `syncState`, `conflicts`.
- `openLocalDatabase(name?: string): Promise<LocalDatabase>` performs explicit version migrations.
- `putEntityAndOutbox<T>(entity: T, operation: SyncOperation): Promise<void>` commits entity and immutable outbox row in one IndexedDB transaction.
- `readPendingOperations(workspaceId: string, limit: number): Promise<SyncOperation[]>` returns stable creation order without mutation.
- `putBlob(blob: Blob, ref: BlobRef): Promise<void>` rejects over-quota/over-limit writes with a recoverable error.
- `localWorkspaceRepository(): { listProjects(): Promise<ProjectSyncData[]>; saveProject(data: ProjectSyncData): Promise<void>; listMaps(): Promise<MapSyncData[]>; saveMap(data: MapSyncData): Promise<void>; queueImport(metadata: ImportMetadata, blob: Blob): Promise<void> }` is the typed export consumed by the existing workspace/import screens.

- [ ] **Step 1: Write failing browser tests** for schema upgrade, atomic entity+outbox commit, rollback on transaction failure, tombstone persistence, blob checksum/limit, and reload retention.
- [ ] **Step 2: Run `pnpm --filter admin exec vitest run src/test/local-db-migrations.test.ts src/test/local-repositories.test.ts src/test/local-workspace-hook.test.ts`** and confirm stores/transactions are absent.
- [ ] **Step 3: Implement versioned stores and indexes** with no silent eviction; preserve queued edits across reload/browser restart.
- [ ] **Step 4: Implement repositories** so local CRUD always creates immutable outbox operations with `baseVersion` and optional predecessor.
- [ ] **Step 5: Test quota failure and export/recovery affordance** without deleting pending data.

## Task 7: Implement capability recovery and sync engine

**Files:**

- Create: `apps/admin/src/lib/sync/capability.ts`
- Create: `apps/admin/src/lib/sync/engine.ts`, `lock.ts`, `retry.ts`
- Modify: `apps/admin/src/lib/api-client.ts`
- Test: `apps/admin/src/test/sync-engine.test.ts`, `capability-recovery.test.ts`

**Interfaces:**

- `provisionWorkspace(input: CapabilityProvisionRequest): Promise<WorkspaceCapability>` stores the returned bearer/generation in IndexedDB only.
- `recoverWorkspace(input: { bootstrapProof: string }): Promise<"recovered" | "offline" | "revoked">` retries proof-based recovery without erasing local records.
- `syncOnce(signal?: AbortSignal): Promise<SyncReport>` uses a single-writer lease across tabs.
- `SyncReport = { pushed: number; pulled: number; conflicts: number; pending: number; status: "idle" | "retrying" | "revoked" | "offline" }`.
- `resolveConflict(input: { conflictId: string; resolution: "keep_local" | "keep_server" | "merged"; payload?: SyncEntityPayload }): Promise<void>` writes a new predecessor-linked operation.

- [ ] **Step 1: Write failing tests** for offline bootstrap proof persistence, capability recovery, revocation, two-tab lock, bounded exponential retry, lost push response, duplicate ack, cursor pull, tombstone application, and newer-local-edit preservation.
- [ ] **Step 2: Run `pnpm --filter admin exec vitest run src/test/sync-engine.test.ts src/test/capability-recovery.test.ts`** and confirm failure.
- [ ] **Step 3: Implement capability storage/recovery** without localStorage, URLs, logs, or installation-ID authorization; a revoked workspace requires explicit new-workspace intent.
- [ ] **Step 4: Implement the lock/lease** with expiry and safe release on page hide/unload where available.

- [ ] **Step 5: Implement push acknowledgement rules**: B queued while A was in flight retains its entire immutable envelope, including original `baseVersion` and `predecessorOperationId`. The server resolves B's expected version from A's durable accepted result for the same workspace/entity/ID; an unknown/conflicted predecessor blocks B. Client applies acknowledgement only to A's queue entry/server metadata, preserving B's newer displayed entity. Conflict resolution creates a fresh operation chain rather than rewriting a previously sent operation.
- [ ] **Step 6: Implement server acknowledgement rules**: persist original result plus canonical request digest atomically, reject an operation ID reused with any different envelope, and return the full original acknowledgement on replay. Verify predecessor result belongs to the same entity/workspace and does not form a cycle; a typed conflict blocks dependents until resolution.
- [ ] **Step 7: Apply every pull page and its next cursor in one IndexedDB transaction**. Preserve the cursor on empty pages and handle `hasMore` explicitly; page failure leaves both records and cursor unchanged. Pending local versions remain protected by the conflict/newer-edit rules.
- [ ] **Step 8: Run browser tests with interrupted network responses** and prove retry does not duplicate server mutations, skip cursor pages, or drop local edits.

## Task 8: Same-origin API/Vite wiring and controlled service-worker behavior

**Files:**

- Modify: `apps/admin/src/lib/api-client.ts`
- Test: `apps/admin/src/test/api-client.test.ts`

**Interfaces:**

- Browser API base is `/api/v1`; development proxy forwards `/api` to the actual local API URL reported by the process.
- `apiFetch<T>(path: string, init?: RequestInit): Promise<T>` never accepts or serializes `DATABASE_URL`, Neon credentials, or raw capability into a URL.

- [ ] **Step 1: Write failing tests** for `/api/v1` path alignment, same-origin production requests, proxy development requests, and rejection of arbitrary cross-origin GET caching.
- [ ] **Step 2: Implement the route alignment in `api-client.ts`** without inventing a remote port; same-origin service-worker/Vite changes remain owned by the PWA plan.
- [ ] **Step 3: Add only the consumer contract test** proving API calls use `/api/v1` and never serialize credentials or raw capability into a URL.
- [ ] **Step 4: Run `pnpm --filter admin exec vitest run src/test/api-client.test.ts`** and inspect the browser bundle for database credentials.

## Task 9: Real end-to-end and approval gates

**Files:**

- Modify: `apps/admin/playwright.config.ts` and existing E2E fixtures only after owners confirm paths
- Create: `apps/admin/e2e/local-first-sync.spec.ts`, `apps/admin/e2e/import-upload-resume.spec.ts` under the single Q5 quality owner; no sync builder edits these tests.
- Test data: lawful, representative PDF fixtures kept outside secrets and production data

- [ ] **Step 1: Gate G0.3** with measured offline GeoPDF parser/render/CRS/profile/accuracy/licensing evidence; stop if no candidate passes.
- [ ] **Step 2: Gate G0.4** by positively identifying the disposable loopback PostGIS/Neon target before migrations or writes.
- [ ] **Step 3: Run Playwright against the real local API and isolated DB** for offline CRUD/reload, capability recovery, duplicate replay, tombstones/conflicts, resumable blob upload, and same-origin operation.
- [ ] **Step 4: Run the five Review Focus input classes** and attach raw evidence to the owning tests.
- [ ] **Step 5: Run `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, and actual Playwright E2E**; classify every failure as implementation, environment, or unrelated.
- [ ] **Step 6: Obtain independent security/technical review** of capability scope, upload/parser limits, service-worker policy, XSS/SSRF, secrets, and migration safety.
- [ ] **Step 7: Only after all gates pass, verify a loopback preview and request the separate approval required for any deployment or remote mutation.**

## Approval Boundary

The user authorized execution of the PRD and the written-plan review passed. Task 1 is authorized as the G0.2 contract implementation; downstream implementation remains blocked until the applicable G0.2–G0.5 evidence receives independent review. No migration, remote Neon write, production deployment, commit, push, or destructive database action is authorized by this document.

## Self-Review Coverage

- **Spec coverage:** anonymous workspace, local IndexedDB/outbox, scoped CRUD, sync idempotency/cursors/tombstones/conflicts, resumable PDF blobs, same-origin API wiring, disposable Neon/PostGIS proof, E2E/security gates, and unresolved GeoPDF/offline-map gates each map to a task or explicit gate.
- **Type consistency:** Task 1 defines the envelopes consumed by Tasks 2–6; `SyncCursor`, `SyncOperation`, `BlobRef`, and `ImportMetadata` names are reused without duplicate shapes.
- **Atomicity:** Task 2 locks the workspace row while committing changes and sequence; Task 6 atomically commits local entity plus outbox; Task 7 applies pull records and cursor together.
- **Review focus:** all five risky input classes are pinned to Tasks 2–7 and the real Task 9 acceptance tests.
- **Proportion:** steps specify paths, signatures, test names/values, dependency gates, and evidence without prescribing implementation bodies that the repository can determine.
