## Context

The platform supports both SQLite and PostgreSQL backends via `IDatabaseManager`. Currently `/api/health` does not query the database, so downstream database failures are invisible to Kubernetes orchestrators. Furthermore, `server.ts` does not await `dbManager.close()` during process termination signals.

See `proposal.md` and delta specs for motivation and behavioral requirements.

## Goals / Non-Goals

**Goals:**
- Provide reliable database connectivity inspection in `IDatabaseManager` (`checkHealth`) across both SQLite and PostgreSQL.
- Return HTTP 200 with structured component diagnostics on healthy status, and HTTP 503 on database failure for `/api/health` and `/api/health/ready`.
- Provide a lightweight `/api/health/live` probe that tests the HTTP process without cascading downstream dependency failures.
- Implement robust, asynchronous graceful shutdown in `server.ts` that awaits database disconnection with a 5-second forced timeout safeguard.
- Update Kubernetes manifests to use the dedicated probe endpoints.

**Non-Goals:**
- Adding third-party external APM agents or heavy monitoring daemons.
- Altering existing application business routes (`/api/auth`, `/api/admin`, etc.).

## Decisions

### Decision 1: Health Probe Routing Architecture
- **Choice**:
  - `GET /api/health`: Executes full readiness checks, returning 200 with status info or 503 if the database fails. Maintains backwards compatibility.
  - `GET /api/health/ready`: Explicit Kubernetes readiness probe alias. Returns 200 when database is ready, 503 when not ready.
  - `GET /api/health/live`: Explicit Kubernetes liveness probe. Immediately returns HTTP 200 `{ status: 'ok' }` as long as Express can process requests.
- **Alternatives Considered**:
  - Only query parameters (`/api/health?probe=liveness`): Supported as an optional fallback, but dedicated paths (`/api/health/live`, `/api/health/ready`) are cleaner and standard in Kubernetes manifests.

### Decision 2: Standardized `checkHealth` on `IDatabaseManager`
- **Choice**:
  - Add `checkHealth(): Promise<{ healthy: boolean; latencyMs: number; error?: string }>` to `IDatabaseManager`.
  - `SqliteDatabaseManager`: runs `this.db.prepare('SELECT 1').get()`.
  - `PostgresDatabaseManager`: executes `await this.pool.query('SELECT 1')`.
  - `DatabaseManager`: delegates to `this.provider.checkHealth()`.
- **Alternatives Considered**:
  - Simple boolean return (`ping(): Promise<boolean>`): Rejected because latency measurement and error capture provide vital diagnostics in logs and health responses.

### Decision 3: Asynchronous Graceful Teardown
- **Choice**:
  - In `src/backend/server.ts`, wrap `SIGTERM` and `SIGINT` handlers in an async flow:
    1. Stop accepting new HTTP connections via `server.close()`.
    2. Await `dbManager.close()`.
    3. Clear timeout and call `process.exit(0)`.
    4. Guard with a 5-second unref/active timeout that forcefully calls `process.exit(1)` if stuck.
- **Alternatives Considered**:
  - Unhandled termination: Exiting immediately leaves in-flight transactions abruptly severed and pool sockets orphaned.

## Risks / Trade-offs

- **[Risk]** Database slow query during readiness check could delay probe response.
  - **Mitigation**: Health check uses the most lightweight query possible (`SELECT 1`), avoiding table scans and transaction locks.
- **[Risk]** Database outage causing pod restart loops.
  - **Mitigation**: Liveness probe checks process health only (`/api/health/live`), preventing Kubernetes from continually restarting pods when PostgreSQL is temporarily unavailable. Readiness probe (`/api/health/ready`) removes the pod from the endpoints pool until PostgreSQL recovers.

## Migration Plan

1. Update `IDatabaseManager` interface and implementations.
2. Update Express routes in `src/backend/app.ts`.
3. Update server shutdown logic in `src/backend/server.ts`.
4. Update `k8s/platform/04-deployment.yaml` readiness and liveness paths.
5. Add test coverage for all new endpoints and failure modes.
