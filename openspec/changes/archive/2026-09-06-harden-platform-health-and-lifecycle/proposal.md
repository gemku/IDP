## Why

The platform's `/api/health` endpoint currently returns a static `{ status: 'ok' }` without checking database connectivity or underlying system readiness. In production and Kubernetes environments, if PostgreSQL or SQLite fails, Kubernetes probes still mark the pod healthy and continue routing incoming traffic to a broken container. Furthermore, server shutdown handlers in `server.ts` invoke asynchronous database connection cleanup (`dbManager.close()`) synchronously without awaiting connection draining, risking premature process termination and unclosed database pool connections.

Hardening platform health checks, separating liveness from deep readiness verification, and ensuring asynchronous graceful lifecycle teardown ensures Kubernetes workloads reliably detect dependency failures and terminate safely.

## What Changes

- Add a standardized `checkHealth(): Promise<{ healthy: boolean; latencyMs: number; error?: string }>` method to `IDatabaseManager`, implemented across `SqliteDatabaseManager`, `PostgresDatabaseManager`, and delegated via `DatabaseManager`.
- Update the `/api/health` endpoint to perform a deep database readiness check by default, returning HTTP 200 with component status and latency when database is reachable, and HTTP 503 Service Unavailable when the database is unreachable or degraded.
- Provide dedicated `/api/health/ready` (readiness) and `/api/health/live` (liveness) subroutes to align with Kubernetes probe best practices.
- Update `src/backend/server.ts` to await `dbManager.close()` during graceful shutdown (`SIGTERM`, `SIGINT`) and error handling before process exit.
- Update Kubernetes manifests (`k8s/platform/04-deployment.yaml`) to separate `readinessProbe` (`/api/health/ready`) and `livenessProbe` (`/api/health/live`).

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `kubernetes-platform-deployment`: Modifies health probe requirements to specify separate liveness and deep database readiness probing, and graceful process lifecycle termination.
- `auth-team-onboarding`: Modifies database management requirement to mandate active database health probing across SQLite and PostgreSQL engines.

## Impact

- `src/backend/db.ts`: Added `checkHealth` to `IDatabaseManager`, `SqliteDatabaseManager`, `PostgresDatabaseManager`, and `DatabaseManager`.
- `src/backend/app.ts`: Enhanced `/api/health`, added `/api/health/ready` and `/api/health/live`.
- `src/backend/server.ts`: Asynchronous graceful shutdown handling.
- `k8s/platform/04-deployment.yaml`: Updated readiness and liveness probe paths.
- Tests: Added comprehensive health and lifecycle unit tests in `tests/healthLifecycle.test.ts`.
