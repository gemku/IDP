## Why

Auditing Express query handling, frontend component state, and identity synchronization revealed key edge cases:
1. HTTP Parameter Pollution (HPP): when query parameters (`search`, `repoName`, `namespace`, `podName`) are provided as arrays (e.g. `?search=a&search=b`), calling `.trim()` directly on `req.query.*` throws unhandled runtime `TypeError` exceptions resulting in HTTP 500 errors.
2. In `RepositoryPicker`, switching `teamId` leaves `currentPage` on the previous page index, which can cause empty project lists when switching from a large team to a small team.
3. In `auth.ts`, `GET /api/auth/me` returns static session active teams without refreshing against the database, preventing immediate visibility of team deactivation or deletion.
4. Spec requirements in `kro-trigger-provisioning` and `observability-dashboards` exceeded recommended length thresholds.

## What Changes

- **Query Parameter Safety**: Introduce a centralized helper `getStringParam` across routes to safely extract string values from query parameters, preventing runtime `TypeError: .trim is not a function` during parameter pollution.
- **Frontend Page Reset**: Reset `currentPage` to 1 in `RepositoryPicker` whenever `teamId` changes.
- **Real-Time Active Team Refresh**: In `GET /api/auth/me`, re-query active teams for the user's LDAP groups using `dbManager.findActiveTeamsForUser(sessionUser.ldapGroups)` to reflect real-time team status changes.
- **Admin Status Toggle Error Handling**: Wrap `PATCH /api/admin/teams/:id/toggle` in try/catch to return HTTP 500 JSON errors if database updates fail.
- **Spec Brevity Refinement**: Streamline requirement descriptions in `kro-trigger-provisioning` and `observability-dashboards` to eliminate OpenSpec length warnings.

## Capabilities

### Modified Capabilities
- `scoped-repository-picker`: Handles array-polluted query parameters safely and resets pagination when switching teams.
- `auth-team-onboarding`: Refreshes active teams dynamically on `/me` and adds error handling to team toggle.
- `kro-trigger-provisioning`: Sanitizes multi-value query parameters and refines requirement description length.
- `observability-dashboards`: Sanitizes multi-value query parameters and refines requirement description length.

## Impact

- `src/backend/routes/repos.ts`: Uses `getStringParam` for query parameters.
- `src/backend/routes/triggers.ts`: Uses `getStringParam` for query parameters.
- `src/backend/routes/observability.ts`: Uses `getStringParam` for query parameters.
- `src/backend/routes/auth.ts`: Refreshes `sessionUser.activeTeams` dynamically in `/me`.
- `src/backend/routes/admin.ts`: Wraps toggle in try/catch.
- `src/frontend/components/RepositoryPicker.tsx`: Adds `useEffect` resetting `currentPage` on `teamId` change.
- Tests across `tests/repos.test.ts`, `tests/auth.test.ts`, `tests/kroTrigger.test.ts`, and `tests/repositoryPicker.test.ts`.
