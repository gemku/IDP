## Context

See `proposal.md` for motivation. This design addresses token fallback in `GitLabService`, custom SSE error event telemetry in `DarkTerminal`, Express global JSON error handling, mutation field string sanitization in `admin.ts`, and safe defensive array defaults in `RepositoryPicker`.

## Goals / Non-Goals

**Goals:**
- Enable `GitLabService.getGroupProjects` to authenticate with `this.config.adminToken` when a user token is absent.
- Ensure `DarkTerminal` listens to custom `event: error` SSE blocks and renders them in the log view.
- Catch Express JSON body parsing `SyntaxError`s and return structured JSON responses.
- Trim and enforce non-empty string checks on team mutation endpoints in `admin.ts`.
- Guard `RepositoryPicker` against undefined project arrays.

**Non-Goals:**
- Modifying SQLite schema or KRO resource definitions.
- Changing authorization rules or OAuth callbacks.

## Decisions

### 1. GitLab Token Fallback
- Make `token?: string` optional in `IGitLabService.getGroupProjects`.
- Fall back to `this.config.adminToken` if `token` is undefined or empty string.
- Remove `'dummy-token'` workaround in `routes/repos.ts`.

### 2. SSE Error Event Telemetry in DarkTerminal
- Register `eventSource.addEventListener('error', (e: any) => ...)` alongside low-level `eventSource.onerror`.
- When `e.data` is provided, parse JSON payload or format raw string and append to terminal logs as a `[system]` line.

### 3. Express JSON Error Middleware
- Register error-handling middleware with signature `(err, req, res, next)` at the bottom of `createApp()`.
- Return HTTP 400 `{ error: 'Invalid JSON payload' }` when `err instanceof SyntaxError && err.status === 400`.

### 4. Whitespace Sanitization in Admin Routes
- Trim `name`, `ldap_group_dn`, and `gitlab_group_path` on POST and PUT before checking truthiness.
- Reject whitespace-only values with HTTP 400 Bad Request.

## Risks / Trade-offs

- [Risk] Custom error handler interferes with streaming responses → Mitigation: Check `if (res.headersSent) return next(err);` before sending response.
