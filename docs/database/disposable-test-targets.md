# Disposable database targets

**Checked:** 2026-09-30  
**Scope:** local test target readiness only; no Neon write.

## Identified local target

The existing disposable test container is `geonexo-localfirst-test-20260929`, image `postgis/postgis:16-3.4`, database `geonexo_localfirst_test`. The prior baseline report recorded this container on `127.0.0.1:52435` and a successful PostGIS integration run. After Docker Desktop was restarted, Docker showed no running containers; the named test container existed stopped. Only this identified disposable container was started.

Docker assigned loopback port `127.0.0.1:58489`. Inside the container, `pg_isready` returned ready and a read-only identity query returned database `geonexo_localfirst_test`, role `geonexo_test`, with the `postgis` extension installed. `DATABASE_URL` and `TEST_DATABASE_URL` were unset in the host environment. For the test invocation only, the local `TEST_DATABASE_URL` was constructed in process memory from the container's configured database credentials and removed in a `finally` block; its value was never printed.

Fresh command:

```text
pnpm --filter @geonexo/db exec vitest run tests/integration/postgis.test.ts --maxWorkers=1
```

Result: exit 0, 1 test file passed, **16 tests passed**, duration 49.60 seconds. The integration suite ran against the positively identified loopback-only disposable database. It is safe for this suite's migration and test cleanup behavior; it is not a production or shared local database.

## Current restrictions

- The two unrelated local PostgreSQL services on ports 5432 and 5433 were observed running but were not queried or used; their data ownership and disposability were not established.
- The service on `127.0.0.1:52435` is no longer the current host mapping. Always inspect the named container's published loopback port and database identity before constructing the test URL.
- Neon production metadata remains a read-only inventory. Its application tables, `postgis`, `pgcrypto`, and application indexes are absent, as documented in `neon-schema-drift.md`.
- Creating a Neon branch/database, applying remote migrations, or writing remote test rows remains a separate approval gate. No remote write was attempted.

## Evidence sources

- Historical target and baseline test evidence: [2026-09-30 baseline evidence](../quality/2026-09-30-baseline-evidence.md).
- Remote read-only schema inventory: [Neon schema drift](neon-schema-drift.md).
