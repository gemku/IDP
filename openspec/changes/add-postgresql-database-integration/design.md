## Context

See proposal.md - Why.
The platform currently provides `DatabaseManager` in `src/backend/db.ts` utilizing Node.js 24's native `DatabaseSync` (`node:sqlite`). All methods are synchronous.
To support PostgreSQL alongside SQLite:
- `pg` (node-postgres) is network-based and asynchronous.
- The interface must be asynchronous (`Promise<T>`) across all database operations.
- The route handlers in `src/backend/routes/auth.ts`, `src/backend/routes/admin.ts`, and middleware in `src/backend/middleware/authGuard.ts` already use `async`/`await` for upstream services (`gitlabService`, `ldapService`) and can naturally `await` database calls.

## Goals / Non-Goals

**Goals:**
- Provide a clean `IDatabaseManager` interface defining all team persistence operations.
- Implement `SqliteDatabaseManager` for local zero-config workflows (`node:sqlite`).
- Implement `PostgresDatabaseManager` using `pg.Pool` with parameterized queries (`$1, $2...`) and automatic table migration.
- Provide a unified factory `createDatabaseManager(config)` or provider selection in `DatabaseManager` that selects the provider based on `DATABASE_CLIENT` or `DATABASE_URL`.
- Support case-insensitive LDAP group DN queries in both engines (`COLLATE NOCASE` in SQLite, `LOWER(ldap_group_dn)` in PostgreSQL).
- Update `AppConfig` in `src/backend/config.ts` to parse PostgreSQL configuration.
- Update Kubernetes manifests and documentation to reflect PostgreSQL deployment options.

**Non-Goals:**
- Adopting heavy ORM frameworks (e.g. Prisma, TypeORM, Hibernate-like layers).
- Supporting other relational engines (MySQL, Oracle) at this stage.

## Decisions

### 1. Direct Driver (`pg.Pool`) Over Heavy ORM
- **Choice**: Use the standard `pg` package with connection pooling.
- **Rationale**: The data model consists of a single entity table (`onboarded_teams`). A direct driver provides maximum performance, minimal dependency footprint, predictable query execution, and zero schema compilation overhead.
- **Alternatives Considered**: Prisma / TypeORM — rejected due to excessive binary footprint and build complexity in lightweight container environments.

### 2. Async `IDatabaseManager` Contract
- **Choice**: All database operations return promises (`Promise<OnboardedTeam | undefined>`, etc.).
- **Rationale**: While `node:sqlite` is synchronous, PostgreSQL queries are inherently asynchronous. Normalizing on `Promise<T>` allows interchangeable provider swapping without leaky abstractions.

### 3. Case-Insensitive LDAP Collation Handling
- **Choice**:
  - SQLite: `ldap_group_dn COLLATE NOCASE IN (...)`
  - PostgreSQL: `LOWER(ldap_group_dn) = ANY($1::text[])` or `LOWER(ldap_group_dn) IN ($1, $2...)` with `CREATE INDEX IF NOT EXISTS idx_onboarded_teams_ldap ON onboarded_teams (LOWER(ldap_group_dn));`
- **Rationale**: Ensures case-insensitive RFC 4515 LDAP group matching functions identically across both storage engines.

### 4. Configuration and Auto-Detection
- **Choice**: Determine engine via `DATABASE_CLIENT` (`'postgres' | 'sqlite'`) or infer from `DATABASE_URL` prefix (`postgres://` / `postgresql://`). Default to `'sqlite'`.
- **Rationale**: Backward-compatible with all existing environments and tests without manual flag toggling.

## Risks / Trade-offs

- [Async refactoring in Express routes] → The route handlers are already `async` or can easily `await` database calls. Error handling middleware catches any unhandled promise rejections.
- [Database connection failures in PostgreSQL] → The PostgreSQL provider will gracefully catch pool errors and report connection health in `/api/health`.

