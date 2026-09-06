## Context

See proposal.md - Why.
During security testing and API fuzzing, several hardening needs were identified:
1. `GET /api/repos/:projectId/trigger` omitted the `verifyProjectAccess` tenant check present in POST and DELETE.
2. Observability endpoints did not check if `:repoName` was non-empty after trimming.
3. `MetricsService` utilization percentages could theoretically report negative values if unexpected input were encountered.
4. `escapeLdapFilter` lacked guards for falsy/non-string arguments.
5. `FleetDashboard` and `DarkTerminal` components lacked defensive handling for loading states and high-volume log streams.

## Goals / Non-Goals

**Goals:**
- Enforce tenant isolation uniformly across all KRO trigger routes (`POST`, `GET`, `DELETE`).
- Ensure all observability endpoints reject invalid repository names with HTTP 400.
- Guarantee CPU and memory percentages are bounded to `[0, 100]`.
- Provide fail-safe non-string defense in `escapeLdapFilter`.
- Prevent UI crashes on uninitialized stats and buffer terminal logs to a maximum of 2,000 lines.

**Non-Goals:**
- Changing database schemas or altering existing GitLab OAuth flows.
- Modifying Argo Events or Kpack Kubernetes manifests.

## Decisions

### 1. Tenant Authorization on `GET /:projectId/trigger`
- **Choice**: Invoke `verifyProjectAccess(req.user, projectId, token)` identically to POST and DELETE before querying KRO.
- **Rationale**: Any request attempting to read secrets or trigger configuration for a project outside the user's active onboarded teams must fail immediately with 403 Forbidden.
- **Alternatives Considered**: Allow read access if authenticated — rejected because trigger custom resources contain sensitive secret tokens.

### 2. Observability Route Validation
- **Choice**: Extract `repoName`, trim whitespace, and return `{ error: 'Missing or invalid repository name' }` (HTTP 400) if empty.
- **Rationale**: Prevents spurious Kubernetes pod lookups and malformed SSE streams.

### 3. Metric Percentage Clamping
- **Choice**: `Math.min(100, Math.max(0, Math.round(...)))`.
- **Rationale**: Guarantees percentages stay in the interval `[0, 100]` regardless of anomalies.

### 4. Frontend Component Resilience
- **Choice**: Render a loading skeleton in `FleetDashboard` if `stats` is falsy, and in `DarkTerminal` slice `logs` state to keep the latest 2,000 entries (`[...prev, item].slice(-2000)`).
- **Rationale**: Prevents uncaught TypeErrors and DOM memory exhaustion during heavy build streams.

## Risks / Trade-offs

- [Truncating build logs in terminal] → Slicing to the latest 2,000 lines preserves ample context for all build phases while safeguarding browser performance.
