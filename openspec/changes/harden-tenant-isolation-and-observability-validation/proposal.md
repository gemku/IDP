## Why

While testing and auditing the platform across multi-tenant boundaries, two key security and resilience gaps were identified:
1. `GET /api/repos/:projectId/trigger` does not verify tenant authorization against the user's active onboarded teams, permitting cross-tenant inspection of KRO triggers and webhook secret tokens.
2. Observability endpoints (`/logs`, `/metrics`, `/pipeline-status`) do not reject empty or whitespace-only repository parameters, and frontend dashboards lack defensive loading states and bounded log memory management.

Closing these vulnerabilities ensures strict tenant isolation and prevents server or browser instability.

## What Changes

- **Tenant Authorization on Trigger Inspection**: Enforce `verifyProjectAccess` in `GET /api/repos/:projectId/trigger`, returning 403 Forbidden if the project does not belong to any of the user's active onboarded teams.
- **Observability Parameter Validation**: Validate `:repoName` in `/api/repos/:repoName/logs`, `/api/repos/:repoName/metrics`, and `/api/repos/:repoName/pipeline-status`, returning 400 Bad Request if missing or whitespace-only.
- **Defensive Metric Calculation**: Guard `cpuPercent` and `memoryPercent` against negative or out-of-range bounds with `Math.max(0, Math.min(100, ...))`.
- **Defensive LDAP Filter Escaping**: Ensure `escapeLdapFilter` handles undefined, null, or non-string inputs safely without throwing a TypeError.
- **Frontend Dashboard Resilience**: Add fallback handling to `FleetDashboard` when `stats` is null/undefined during loading, and cap `DarkTerminal` log buffer to prevent browser memory exhaustion.

## Capabilities

### Modified Capabilities
- `kro-trigger-provisioning`: Enforces tenant isolation on trigger lookup (`GET /api/repos/:projectId/trigger`), ensuring users cannot inspect triggers outside their onboarded teams.
- `observability-dashboards`: Enforces repository name validation on observability endpoints, adds bounded percent calculation, and improves frontend dashboard stability.

## Impact

- `src/backend/routes/triggers.ts`: Adds tenant authorization check to GET endpoint.
- `src/backend/routes/observability.ts`: Adds input validation for repository name parameter.
- `src/backend/services/metricsService.ts`: Clamps utilization percentages strictly between 0 and 100.
- `src/backend/services/ldapService.ts`: Adds non-string defense to `escapeLdapFilter`.
- `src/frontend/components/FleetDashboard.tsx`: Prevents crash when `stats` is undefined.
- `src/frontend/components/DarkTerminal.tsx`: Bounds in-memory log lines.
- Unit and integration tests in `tests/kroTrigger.test.ts` and `tests/observability.test.ts`.
