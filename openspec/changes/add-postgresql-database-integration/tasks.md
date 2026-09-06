## 1. Dependencies and Configuration

- [x] 1.1 Add `pg` and `@types/pg` dependencies to `package.json` and verify package installation
- [x] 1.2 Update `src/backend/config.ts` to parse PostgreSQL configuration (`DATABASE_CLIENT`, `DATABASE_URL`, `POSTGRES_*`) and verify config loading tests pass

## 2. Asynchronous Database Provider Architecture

- [x] 2.1 Define `IDatabaseManager` interface in `src/backend/db.ts` with asynchronous method signatures for all team CRUD and lookup operations
- [x] 2.2 Implement `SqliteDatabaseManager` implementing `IDatabaseManager` with backward-compatible SQLite storage
- [x] 2.3 Implement `PostgresDatabaseManager` implementing `IDatabaseManager` using `pg.Pool`, automated table migrations, parameterized queries, and case-insensitive LDAP DN lookup
- [x] 2.4 Implement unified `DatabaseManager` factory selecting provider based on configuration, and verify existing `tests/db.test.ts` passes

## 3. Router and Middleware Integration

- [x] 3.1 Update `src/backend/middleware/authGuard.ts` to await database team lookups
- [x] 3.2 Update `src/backend/routes/auth.ts` to await active team queries during OAuth callback and `/api/auth/me`
- [x] 3.3 Update `src/backend/routes/admin.ts` to await all team administration CRUD operations and verify admin tests pass

## 4. Kubernetes Manifests, Testing, and Verification

- [x] 4.1 Update `k8s/platform/02-configmap-secret.yaml` and deployment documentation to support PostgreSQL connection injection
- [x] 4.2 Add comprehensive test suite in `tests/postgresDb.test.ts` validating PostgreSQL provider queries, connection error handling, and provider switching
- [x] 4.3 Verify TypeScript compilation with `npm run build` and run full automated test suite with `npm test`
