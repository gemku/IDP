## 1. Tenant Project Authorization in Triggers Route

- [x] 1.1 Add project team ownership validation in `triggers.ts` before trigger creation and deletion, returning 403 on mismatch
- [x] 1.2 Require non-empty `repoName` query parameter on trigger GET and DELETE routes, returning 400 if omitted
- [x] 1.3 Add unit tests in `tests/kroTrigger.test.ts` verifying 403 on cross-team projects and 400 on missing `repoName`

## 2. Directory Service Availability & Admin Endpoint Authentication

- [x] 2.1 Catch LDAP connection/bind failures in `auth.ts` and respond with 503 Directory Service Unavailable
- [x] 2.2 Protect `/api/admin` routes with `requireAuth` middleware
- [x] 2.3 Update token extraction in `repos.ts` and `triggers.ts` to use case-insensitive regex `replace(/^Bearer\s+/i, '')`
- [x] 2.4 Add unit tests in `tests/auth.test.ts` verifying 503 LDAP response and 401 on unauthenticated admin access

## 3. Observability Fallback & Frontend Defensive Guards

- [x] 3.1 Make `metricsService.getBuildResourceUsage` resilient to `getPodMetrics` rejections by returning fallback limits
- [x] 3.2 Add defensive empty array fallbacks for `stats.teamsActivity` and `steps` in `FleetDashboard.tsx` and `RepositoryDashboard.tsx`
- [x] 3.3 Add unit tests in `tests/observability.test.ts` verifying metrics fallback when metrics client rejects
