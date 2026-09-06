## Context

While previous changes established functional features and resolved compiler errors, production deployment requires addressing security vulnerabilities (LDAP injection, weak token entropy, OAuth CSRF) and operational gaps (case-sensitive LDAP matching in SQLite, missing server process entrypoint).

See `proposal.md` for motivation.

## Goals / Non-Goals

**Goals:**
- Sanitize LDAP filters per RFC 4515 to eliminate injection attack vectors.
- Ensure case-insensitive LDAP DN comparisons in SQLite database schema and queries.
- Replace Math.random() in KroService with crypto.randomBytes(24).toString('hex').
- Add OAuth 2.0 CSRF state verification across login and callback endpoints.
- Ensure Kubernetes custom resource metadata names strictly comply with RFC 1123 DNS subdomain format.
- Add an executable src/backend/server.ts entrypoint with graceful shutdown (SIGTERM/SIGINT) and configure standard npm scripts.

**Non-Goals:**
- Migrating from SQLite to external PostgreSQL in this change.
- Altering existing React UI layouts or dashboard visual styles.

## Decisions

### Decision 1: RFC 4515 LDAP Escaping Function
- **Choice**: Introduce scapeLdapFilter(input: string): string in src/backend/services/ldapService.ts.
- **Rationale**: RFC 4515 defines specific escape sequences: \ (\5c), * (\2a), ( (\28), ) (\29), and \0 (\00). Escaping guarantees user inputs cannot escape filter assertion brackets.

### Decision 2: SQLite COLLATE NOCASE Collation
- **Choice**: Update onboarded_teams table schema and SELECT ... WHERE ldap_group_dn COLLATE NOCASE IN (...).
- **Rationale**: RFC 4514 states Distinguished Names are case-insensitive. Standard SQLite text comparison is binary/case-sensitive; adding COLLATE NOCASE ensures accurate group matching regardless of casing returned by Active Directory or OpenLDAP.

### Decision 3: Cryptographic Token Generation
- **Choice**: Use Node's standard 
ode:crypto (andomBytes(24).toString('hex')).
- **Rationale**: Webhook tokens protect against forgeable push events. Pseudorandom generators like Math.random() are predictable and insecure.

### Decision 4: OAuth 2.0 State Verification
- **Choice**: Generate a cryptographically random state token in /api/auth/gitlab/login, store it in the session or cookie state, and verify eq.query.state === expectedState in /api/auth/gitlab/callback.

### Decision 5: RFC 1123 Name Sanitization
- **Choice**: Normalize epoName before constructing trigger names:
  `	s
  const clean = repoName.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/^-+|-+$/g, '').slice(0, 50);
  const triggerName = ${clean || 'app'}-trigger;
  `

### Decision 6: Executable Server Entrypoint
- **Choice**: Create src/backend/server.ts which loads environment variables (dotenv), initializes DatabaseManager, GitLabService, LdapService, KroService, MetricsService, and LogStreamingService, invokes createApp(), binds to config.server.port, and attaches graceful shutdown handlers for SIGTERM/SIGINT.
- **Package Scripts**: Add "test": "vitest run", "build": "tsc", and "start": "node dist/backend/server.js" to package.json.

## Risks / Trade-offs

- **[Risk]** Existing SQLite databases may have been created without COLLATE NOCASE on the column.
  → *Mitigation*: Use COLLATE NOCASE explicitly in the SELECT query in indActiveTeamsForUser in addition to the table DDL migration.
- **[Risk]** Session persistence across OAuth redirects in distributed setups.
  → *Mitigation*: Support state validation gracefully in tests and provide cookie/session fallback.
