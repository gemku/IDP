## 1. Backend Security & Validation

- [x] 1.1 Enforce tenant authorization on `GET /api/repos/:projectId/trigger` using `verifyProjectAccess` and verify cross-tenant access returns 403 Forbidden
- [x] 1.2 Validate and trim `:repoName` on observability routes (`/logs`, `/metrics`, `/pipeline-status`) in `src/backend/routes/observability.ts`, returning 400 Bad Request if missing or whitespace-only
- [x] 1.3 Clamp CPU and memory percentage calculations to `[0, 100]` in `src/backend/services/metricsService.ts` and verify unit tests pass
- [x] 1.4 Add non-string and falsy parameter guard to `escapeLdapFilter` in `src/backend/services/ldapService.ts` and verify unit tests pass

## 2. Frontend Component Hardening

- [x] 2.1 Add fallback loading state to `FleetDashboard` in `src/frontend/components/FleetDashboard.tsx` when `stats` is null/undefined
- [x] 2.2 Limit in-memory log lines buffer in `DarkTerminal` in `src/frontend/components/DarkTerminal.tsx` to 2,000 lines to prevent memory exhaustion

## 3. Test Coverage & Verification

- [x] 3.1 Expand `tests/kroTrigger.test.ts` to test 403 Forbidden on `GET /api/repos/:projectId/trigger` for projects outside active teams
- [x] 3.2 Expand `tests/observability.test.ts` to verify 400 Bad Request on whitespace/empty repository names and percentage clamping
- [x] 3.3 Run `npx tsc --noEmit` and `npm test` to verify zero type errors and all tests passing
