## Why

A thorough review of the codebase identified several operational resilience gaps:
1. `GitLabService.getGroupProjects` unconditionally requires a user token and omits fallback to the configured `adminToken`, forcing route callers to supply placeholder tokens or failing with empty authorization headers.
2. `DarkTerminal.tsx` lacks an `eventSource.addEventListener('error', ...)` handler, ignoring backend `event: error` payloads and failing to display build pod error descriptions.
3. Express lacks a global error-handling middleware, causing malformed JSON request bodies (`SyntaxError`) to emit raw HTML stack traces instead of structured JSON responses.
4. Admin team creation and updates in `admin.ts` permit whitespace-only strings for team names, LDAP DNs, and GitLab group paths.
5. `RepositoryPicker.tsx` lacks defensive null-checks for remote project responses.

## What Changes

- **GitLab Token Fallback**: Update `GitLabService.getGroupProjects` to make `token?: string` optional and fall back to `this.config.adminToken`, removing placeholder token hacks.
- **SSE Error Event Rendering**: Add an `error` event listener in `DarkTerminal.tsx` to extract and display structured error details in the build terminal.
- **JSON Error Middleware**: Add an Express error handler in `app.ts` returning JSON `{ error: 'Invalid JSON payload' }` on body parser syntax errors.
- **Whitespace Sanitization**: Trim and validate strings for `name`, `ldap_group_dn`, and `gitlab_group_path` in `admin.ts` routes.
- **Frontend Defensive Fallback**: Guard `setProjects` and `setTotalCount` in `RepositoryPicker.tsx` with `res?.projects || []` and `res?.total || 0`.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `scoped-repository-picker`: Support administrative token fallback in group project discovery and defend repository picker against undefined responses.
- `observability-dashboards`: Capture and display custom server-sent error events in the live build terminal.
- `auth-team-onboarding`: Reject whitespace-only team mutation fields and format body-parser syntax errors as JSON responses.

## Impact

- `src/backend/services/gitlabService.ts`: `token?: string` with `adminToken` fallback.
- `src/backend/routes/repos.ts`: Removes `'dummy-token'` workaround.
- `src/backend/app.ts`: Mounts JSON error handling middleware.
- `src/backend/routes/admin.ts`: Trims mutation fields and validates non-empty values.
- `src/frontend/components/DarkTerminal.tsx`: Handles `event: error` in EventSource.
- `src/frontend/components/RepositoryPicker.tsx`: Adds safe array defaults.
- `tests/`: Adds tests for JSON parse errors, whitespace validation, and token fallback.
