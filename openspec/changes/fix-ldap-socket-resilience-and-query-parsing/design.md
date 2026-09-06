## Context

See `proposal.md` for motivation. The platform coordinates GitLab OAuth, LDAP groups via `ldapjs`, SQLite team memberships, KRO custom resources, and Argo Events sensors. A comprehensive review revealed edge case failure modes in network socket error handling, query parameter type coercion, and event source naming.

## Goals / Non-Goals

**Goals:**
- Eliminate unhandled LDAP client socket errors and guarantee that network/DNS failures reject promptly with descriptive errors rather than leaving HTTP requests hanging.
- Sanitize and strictly validate query parameters (`teamId`, `page`, `limit`) on `/api/repos` to eliminate `NaN` propagation and return 400 Bad Request on invalid numeric IDs.
- Deduplicate LDAP DNs before executing SQLite queries in `DatabaseManager`.
- Add an error listener to `server.listen()` to handle `EADDRINUSE` cleanly.
- Align Argo Events Sensor and KRO trigger EventSource naming conventions.

**Non-Goals:**
- Replacing `ldapjs` or `better-sqlite3`/`node:sqlite`.
- Altering core RBAC business logic or API contracts outside of error handling and query parsing.

## Decisions

### 1. Settle Guard for `LdapService` Promise
- **Decision**: Add a `settled` boolean flag and register `client.on('error')` to reject with `LDAP Connection Error` if not already settled, followed by `client.unbind()`.
- **Rationale**: `ldapjs` emits socket errors on the client instance. If an error occurs prior to or during the bind phase, the bind callback might not be invoked. A settle guard ensures the promise resolves or rejects exactly once, avoiding unhandled exceptions or hung requests.
- **Alternatives considered**: Relying on client timeouts alone (leaves connection hanging for up to 5000ms and fails to release resources immediately).

### 2. Strict Numeric Validation for `teamId` and Safe Bounds for Pagination
- **Decision**: In `src/backend/routes/repos.ts`:
  - If `req.query.teamId` is present, validate with `parseNumericId(req.query.teamId)`. If invalid, return `400 Bad Request` with `{ error: 'Invalid team ID: must be a numeric identifier' }`.
  - For `page` and `limit`, parse with integer checks: `Number.isFinite(val) && val > 0 ? val : fallback`.
- **Rationale**: Keeps `/api/repos` consistent with `/api/admin/teams/:id` and `/api/repos/:projectId/trigger`, preventing `NaN` pollution in pagination calculations.
- **Alternatives considered**: Throwing 400 for all invalid pagination strings (less forgiving for UI defaults than falling back to page 1, limit 10).

### 3. LDAP Group DN Deduplication
- **Decision**: Filter and deduplicate `userLdapGroupDns` with `Array.from(new Set(dns.map(d => d.trim()).filter(Boolean)))` before SQL query generation.
- **Rationale**: Prevents generating duplicate SQL placeholders and reduces query parsing overhead.

### 4. Server Port Conflict Listener
- **Decision**: Attach an `'error'` event handler to `server` in `server.ts` checking for `err.code === 'EADDRINUSE'`.
- **Rationale**: Prevents uncaught stack trace dumps in terminal when port 3000 is occupied.

### 5. Argo Sensor and EventSource Naming Alignment
- **Decision**: Align `gitlab-tag-sensor.yaml` event source dependency name with the KRO ResourceGraphDefinition event source convention or allow shared sensor routing.

## Risks / Trade-offs

- [Risk] `client.unbind()` called on an already closed socket in `ldapjs` → Mitigation: Wrap `client.unbind(() => {})` in a `try ... catch` and no-op callback.
- [Risk] Strict 400 for non-numeric `teamId` could break clients sending malformed queries → Mitigation: Validated numeric IDs are the documented API contract; returning 400 is standard REST practice over a misleading 403.
