## Why

The platform currently relies exclusively on Node.js 24 native SQLite (`node:sqlite`) for team persistence and identity authorization. While SQLite is lightweight and zero-dependency for local development and single-pod deployments, it restricts Kubernetes deployments to a single pod (`replicas: 1`, `Recreate` strategy) due to file-locking limitations on concurrent writers. Adding PostgreSQL integration alongside SQLite allows enterprise high-availability deployments, horizontal pod autoscaling, and integration with managed cloud databases (e.g., AWS RDS, GCP Cloud SQL) while preserving fast, zero-configuration local development on SQLite.

## What Changes

- **Database Abstraction Layer (`IDatabaseManager` / Provider Architecture)**:
  - Create a unified asynchronous database interface (`IDatabaseManager`) implemented by `SqliteDatabaseManager` (wrapping `node:sqlite`) and `PostgresDatabaseManager` (using `pg` connection pooling).
  - Implement a `DatabaseManager` factory that automatically selects the appropriate provider based on configuration (`DATABASE_CLIENT=postgres` or `DATABASE_URL` starting with `postgres://` / `postgresql://`, defaulting to `sqlite`).
  - Provide asynchronous CRUD and query methods across all route handlers (`src/backend/routes/auth.ts`, `src/backend/routes/admin.ts`, `src/backend/middleware/authGuard.ts`).
- **PostgreSQL Schema & Migrations**:
  - Provide automatic DDL schema initialization and migrations for PostgreSQL (`SERIAL PRIMARY KEY`, `VARCHAR`, case-insensitive index on `ldap_group_dn`, timestamps).
  - Case-insensitive LDAP group DN matching across both database engines (`COLLATE NOCASE` in SQLite, `LOWER(ldap_group_dn)` in PostgreSQL).
- **Configuration & Connection Management**:
  - Extend `AppConfig` to support PostgreSQL connection parameters (`DATABASE_CLIENT`, `DATABASE_URL`, `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD`).
  - Provide graceful connection teardown and health verification in `/api/health`.
- **Kubernetes Manifest Updates**:
  - Extend Kubernetes ConfigMap and Secret templates to optionally accept PostgreSQL connection settings.
  - Document multi-replica (`replicas > 1`) and `RollingUpdate` deployment capabilities when backed by PostgreSQL.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `auth-team-onboarding`: Expand team storage and access enforcement requirements to support both PostgreSQL and SQLite backends with unified case-insensitive LDAP group resolution, asynchronous execution, and connection pooling.
- `kubernetes-platform-deployment`: Update workload deployment requirements to support external/in-cluster PostgreSQL configuration and multi-replica horizontal scalability alongside SQLite PVC persistence.

## Impact

- `package.json`: Add `pg` and `@types/pg` dependencies.
- `src/backend/db.ts`: Refactor into modular database architecture with `IDatabaseManager`, SQLite provider, and PostgreSQL provider.
- `src/backend/config.ts`: Add PostgreSQL configuration schema and validation.
- `src/backend/routes/`: Update route handlers to await database operations.
- `src/backend/app.ts` & `src/backend/server.ts`: Asynchronous database lifecycle initialization and shutdown.
- `k8s/platform/`: Update ConfigMap/Secret manifests for PostgreSQL connection variables.
- `tests/`: Add unit and integration tests for PostgreSQL provider (with mocked pool / in-memory compatibility) and ensure 100% test pass rate for existing SQLite tests.

