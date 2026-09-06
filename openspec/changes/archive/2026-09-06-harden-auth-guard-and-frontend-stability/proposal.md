## Why

A comprehensive review of the platform revealed several critical and functional issues across backend request handling, authentication guards, and frontend state management. Specifically, API requests with Bearer tokens fail authentication due to lack of token resolution in `authGuard`, missing request bodies or non-JSON content types crash endpoint handlers with unhandled `TypeError` exceptions, updating an onboarded team with a conflicting name causes an unhandled 500 SQLite error, the `DarkTerminal` component suffers from a stale React closure tagging logs with `idle` phase, `RepositoryPicker` fails client-side pagination in fallback mode, and unbuffered SSE headers are missing for Kubernetes Ingress proxies. Addressing these stabilizes the platform's API and user experience.

## What Changes

- **Bearer Token Auth Resolution**: Extend `authGuard` and platform middleware to resolve incoming `Authorization: Bearer <token>` headers against GitLab user profile, LDAP groups, and database teams so API/CLI clients can access protected endpoints without cookie sessions.
- **Request Body & Undefined Guarding**: Add optional chaining and fallback defaults (`req.body?.field`, `const { ... } = req.body || {}`) across `auth.ts`, `admin.ts`, and `triggers.ts` to prevent `TypeError: Cannot read properties of undefined` crashes.
- **Admin Team Update Error Handling**: Wrap `dbManager.updateTeam` in `PUT /api/admin/teams/:id` with a `try ... catch` block that responds with `409 Conflict` on unique constraint collisions.
- **OAuth State Token One-Time Consumption**: Delete `oauthState` from session immediately after successful verification in `/api/auth/gitlab/callback` to prevent replay attacks.
- **SSE Stream Ingress Optimization**: Add `X-Accel-Buffering: no` to `streamKpackLogs` response headers to prevent reverse proxies (Nginx, Traefik) from buffering SSE log events.
- **Metrics Parser Type Safety**: Add string coercion and validation in `parseCpuQuantity` and `parseMemoryQuantity` so numeric or unexpected inputs do not throw `TypeError: .endsWith is not a function`.
- **Frontend `DarkTerminal` Stale Closure & Clipboard Fixes**: Refactor `DarkTerminal.tsx` to track `currentPhase` via a mutable ref (`useRef`) to avoid stale closure in `eventSource.onmessage`, and add error handling to `navigator.clipboard.writeText`.
- **Frontend `RepositoryPicker` Local Pagination**: Correctly slice `filtered` projects array by `currentPage` when operating in client-side fallback mode.

## Capabilities

### New Capabilities

### Modified Capabilities
- `auth-team-onboarding`: Enable Bearer token authentication resolution in auth guard, prevent body destructuring crashes, protect against OAuth state replay, and catch update constraint conflicts.
- `observability-dashboards`: Prevent reverse proxy buffering on live SSE log streams, handle non-string quantity parsing in metrics, and eliminate stale closure and clipboard rejection errors in `DarkTerminal`.
- `scoped-repository-picker`: Enable proper client-side page slicing in `RepositoryPicker` local pagination fallback.

## Impact

- **Backend**: `src/backend/middleware/authGuard.ts`, `src/backend/routes/auth.ts`, `src/backend/routes/admin.ts`, `src/backend/routes/triggers.ts`, `src/backend/services/logStreamingService.ts`, `src/backend/services/metricsService.ts`, `src/backend/app.ts`.
- **Frontend**: `src/frontend/components/DarkTerminal.tsx`, `src/frontend/components/RepositoryPicker.tsx`.
- **Tests**: `tests/auth.test.ts`, `tests/observability.test.ts`, `tests/repositoryPicker.test.ts`, `tests/kroTrigger.test.ts`.
