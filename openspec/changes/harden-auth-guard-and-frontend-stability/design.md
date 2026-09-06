## Context

See `proposal.md` for motivation. The platform currently has working core capabilities across 5 OpenSpec modules, verified with 37 tests. However, auditing revealed gaps in Bearer token extraction for API clients, potential runtime crashes when requests omit bodies or Content-Type headers, SQLite unique constraint violations throwing unhandled 500s during admin updates, reverse-proxy buffering of SSE log streams, numeric type errors in quantity parsing, and React closure/pagination bugs in frontend components.

## Goals / Non-Goals

**Goals:**
- Provide seamless Bearer token authentication resolution across API routes without requiring a browser session cookie.
- Harden all request handlers against undefined `req.body` destructuring crashes.
- Handle admin team unique constraint collisions gracefully with HTTP 409 Conflict.
- Prevent OAuth CSRF state replay by clearing session state after validation.
- Eliminate reverse-proxy buffering on SSE log streams with `X-Accel-Buffering: no`.
- Ensure robust type coercion in CPU/memory quantity parsers.
- Fix React stale closure on terminal phase logs, handle clipboard errors, and properly paginate local project lists.

**Non-Goals:**
- Replacing SQLite with PostgreSQL or external databases.
- Modifying Kubernetes CRDs or Argo manifest structures.
- Changing GitLab OAuth scopes or LDAP schema structures.

## Decisions

### Decision 1: Bearer Token Resolution via Context Middleware
- **Approach**: Introduce a bearer token resolution middleware in `src/backend/middleware/authGuard.ts` (or integrated into `createApp`), which checks `req.headers.authorization`. When a `Bearer <token>` is present and no session user exists, it calls `gitlabService.getUserProfile(token)`, queries LDAP groups via `ldapService`, and matches active teams via `dbManager`, setting `req.user`.
- **Rationale**: Keeps existing session cookie behavior intact while enabling programmatic API access (e.g. CLI, automated pipelines, curl).
- **Alternatives Considered**: Resolving tokens inside each route independently — rejected as it duplicates logic and breaks `requireOnboardedTeam` which executes first.

### Decision 2: Guarding Request Payloads with Fallbacks
- **Approach**: Protect all destructuring of `req.body` with `req.body || {}` and access properties using optional chaining (`req.body?.field`).
- **Rationale**: Express with `express.json()` leaves `req.body` undefined if requests lack an `application/json` header or payload. Fallbacks guarantee zero unhandled `TypeError` exceptions.

### Decision 3: SQLite Constraint Catching in Admin PUT
- **Approach**: Wrap `dbManager.updateTeam` in `PUT /api/admin/teams/:id` in `try ... catch` and respond with `409 Conflict`, identical to the error handling in `POST /api/admin/teams`.
- **Rationale**: Consistent error semantics across create and update endpoints.

### Decision 4: Stale Closure Elimination in `DarkTerminal`
- **Approach**: Use `useRef` to maintain the latest `currentPhase` value accessible synchronously within the `eventSource.onmessage` closure.
- **Rationale**: Avoids re-subscribing the `EventSource` connection on every phase transition while guaranteeing that unparsed log lines receive the correct active phase tag.

## Risks / Trade-offs

- **[Risk]** Bearer token lookup triggers remote GitLab and LDAP calls per request.  
  → **Mitigation**: Bearer token resolution is only invoked if `!req.user && !req.session?.user && req.headers.authorization`.
- **[Risk]** Clipboard API rejection on unsecured origins or headless browser testing.  
  → **Mitigation**: Use `.catch(() => {})` with a fallback or silent catch to prevent unhandled promise rejections.
