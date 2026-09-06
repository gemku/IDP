## Why

An architectural and security audit of the platform revealed several critical gaps:
1. Trigger provisioning on `/api/repos/:projectId/trigger` does not verify project ownership, allowing users from one team to provision triggers and webhooks against other teams' repositories (tenant isolation bypass).
2. Administrative team routes (`/api/admin`) lack authentication guards.
3. When the LDAP directory is unreachable, the auth callback returns a generic 500 instead of the specified 503 Directory Service Unavailable.
4. When the Kubernetes metrics server is unavailable or returns 404, the metrics endpoint returns 500 instead of fallback indicators displaying pod limits.
5. Missing `repoName` query parameters on trigger GET and DELETE operations cause accidental mutations against a fallback `app-trigger` name.
6. Case-sensitive Bearer token extraction and missing array guards in frontend dashboards pose operational risks.

## What Changes

- **Tenant Isolation on Project Triggers**: Verify that `:projectId` exists within one of the authenticated user's active team GitLab groups before permitting KRO trigger provisioning or deletion; reject unauthorized requests with HTTP 403 Forbidden.
- **Admin Endpoint Protection**: Secure `/api/admin` routes with `requireAuth` to prevent unauthenticated administrative operations.
- **503 Directory Service Unavailable Handling**: Catch LDAP connection/bind/search failures in `/api/auth/gitlab/callback` and respond with HTTP 503 and `{ error: 'Directory Service Unavailable' }`.
- **Metrics Server Fallback Resilience**: Catch `client.getPodMetrics` exceptions in `getBuildResourceUsage` and fall back to 0 utilization while preserving configured pod limits, preventing 500 errors when the metrics server is down.
- **Trigger Query Parameter Validation**: Make `repoName` a required query parameter on `GET` and `DELETE /api/repos/:projectId/trigger`, returning `400 Bad Request` if omitted.
- **Regex Bearer Token Extraction**: Update token extraction to case-insensitively strip Bearer prefixes using `/^Bearer\s+/i`.
- **Frontend Dashboard Defensive Rendering**: Provide fallback empty arrays for `stats.teamsActivity` and `steps` in `FleetDashboard.tsx` and `RepositoryDashboard.tsx`.

## Capabilities

### New Capabilities

### Modified Capabilities
- `scoped-repository-picker`: Enforce tenant group boundary verification on project trigger operations, returning 403 Forbidden for projects outside the user's onboarded team.
- `auth-team-onboarding`: Return HTTP 503 Directory Service Unavailable on LDAP outages, and secure administrative endpoints against unauthenticated access.
- `observability-dashboards`: Render fallback resource limit indicators when the metrics server is unreachable, and harden frontend dashboard array rendering.
- `kro-trigger-provisioning`: Require valid `repoName` query parameters on trigger inspection and deletion routes.

## Impact

- **Backend**: `src/backend/routes/triggers.ts`, `src/backend/routes/auth.ts`, `src/backend/routes/admin.ts`, `src/backend/routes/repos.ts`, `src/backend/services/metricsService.ts`, `src/backend/services/gitlabService.ts`.
- **Frontend**: `src/frontend/components/FleetDashboard.tsx`, `src/frontend/components/RepositoryDashboard.tsx`.
- **Tests**: `tests/auth.test.ts`, `tests/kroTrigger.test.ts`, `tests/observability.test.ts`, `tests/repos.test.ts`.
