## Context

See proposal.md - Why.
During parameter fuzzing and route analysis, we observed that repeated query parameters (e.g. `?search=a&search=b` or `?repoName=a&repoName=b`) cause Express to supply an array of strings in `req.query.*`. In standard route handlers where `(req.query.* as string).trim()` is evaluated without type narrowing, calling `.trim()` on an array throws an unhandled `TypeError: .trim is not a function`, leading to HTTP 500 crashes.
Additionally:
- `RepositoryPicker` did not reset `currentPage` to 1 on `teamId` change, leading to empty repository lists when switching between teams with different project counts.
- `GET /api/auth/me` did not dynamically refresh `activeTeams` against `DatabaseManager`.
- Admin team status toggling lacked error handling in the event of SQLite write errors.

## Goals / Non-Goals

**Goals:**
- Provide parameter extraction utility `getStringParam` across route handlers.
- Reset `currentPage` to 1 on `teamId` change in `RepositoryPicker`.
- Dynamically refresh user `activeTeams` in `GET /api/auth/me` from `dbManager.findActiveTeamsForUser`.
- Wrap `PATCH /api/admin/teams/:id/toggle` in try/catch.
- Shorten overlength spec requirement statements to eliminate OpenSpec CLI warnings.

**Non-Goals:**
- Modifying underlying database schema or LDAP directory search protocols.

## Decisions

### 1. Unified Query Parameter Extraction
- **Choice**: Implement `getStringParam(param: unknown, fallback = ''): string` returning `Array.isArray(param) ? (typeof param[0] === 'string' ? param[0] : fallback) : (typeof param === 'string' ? param : fallback)`.
- **Rationale**: Completely immune to HTTP Parameter Pollution and unexpected non-string shapes.

### 2. Live Active Team Refresh in `/me`
- **Choice**: In `createAuthRouter`'s `GET /me`, if `sessionUser.ldapGroups` exists, recompute `sessionUser.activeTeams = dbManager.findActiveTeamsForUser(sessionUser.ldapGroups)`.
- **Rationale**: Reflects immediate admin actions (team deactivations or onboardings) without forcing the user to logout and re-authorize via OAuth.

### 3. Frontend Page Reset
- **Choice**: Add an effect in `RepositoryPicker` targeting `[teamId]`: `setCurrentPage(1)`.
- **Rationale**: Clean, decoupled, and resets pagination before data fetching begins.

## Risks / Trade-offs

- [Single query param selection on duplicates] → Selecting the first value on duplicate keys is the standard RFC convention for HTTP Parameter Pollution handling and prevents server crashes.
