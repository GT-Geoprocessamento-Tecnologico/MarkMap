# Anonymous workspace security boundary

GeoNexo starts locally and does not ask for an account. The installation UUID and the local bootstrap proof identify a capability record; neither is a person identity and the installation UUID alone never authorizes an API request. A server-issued bearer is scoped to exactly one workspace and is accepted only after server-side proof verification.

The raw bootstrap proof and bearer are retained only in the browser's protected local store. The server stores a one-way proof digest and a bearer digest, plus a monotonically increasing generation and revocation state. Provisioning is idempotent for the same proof and requested workspace. Recovery returns the highest generation and never replaces a newer local generation with a late response. A revoked record cannot be recovered by the old proof; the user must explicitly create a new workspace while retaining old local data for export.

Threats covered by the contract are a lost provisioning response, a leaked bearer, replay after revocation, duplicate installation IDs, guessed workspace/entity IDs, and untrusted or oversized blobs. All resource IDs are UUIDs and every route checks the capability workspace before reading or writing. Uploads use bounded metadata, checksums, scoped server-generated keys, and fixed byte/part limits. Sync operations are immutable, replay-safe by operation ID and request digest, and carry a workspace scope, predecessor and bounded payload.

The anonymous model deliberately does not promise multi-device sharing or human attribution. Cross-device access requires a future, explicit share capability with its own review. Local first launch, edits and PDF retention do not depend on any server response.

## Frozen wire constraints and runtime boundary

The bearer and raw bootstrap proof use the canonical unpadded base64url form of exactly 32 bytes (43 characters). The format check rejects malformed encodings; it does not create entropy. The client/server runtime must generate these bytes with a cryptographically secure random source, hash before persistence, compare digests in constant time, and enforce generation/revocation transactionally. No provisioning, recovery, revocation, or capability middleware exists yet in this checkout.

Sync supports `project`, `map`, `layer`, `feature`, and `import`. Feature geometry is limited to 10,000 coordinate positions and API JSON bodies remain capped at 1 MiB; runtime validation must apply both limits before database work. A `SCOPE_REJECTED` conflict uses `serverVersion: 0` and omits `serverPayload`, so it reveals no server entity version or payload. A sync cursor is the opaque string `v1.<base64url-payload>.<base64url-HMAC-SHA256>`; the server must verify its MAC and workspace binding against the validated capability before any cursor query. The schema can validate token syntax only. These are frozen contract requirements, not evidence of runtime enforcement.
