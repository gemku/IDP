## Context

See `proposal.md` for motivation. While authentication and input sanitization have been improved, cross-tenant project authorization must be enforced to prevent one team from controlling another team's project triggers. Additionally, operational error handling needs refinement: LDAP failures must yield 503 instead of 500, metrics server outages must yield fallback limits rather than 500 errors, administrative endpoints require authentication, and trigger queries/deletions must explicitly require `repoName`.

## Goals / Non-Goals

**Goals:**
- Enforce strict tenant isolation by verifying `:projectId` belongs to one of the authenticated user's active team GitLab groups before trigger provisioning or deletion.
- Secure `/api/admin` with authentication (`requireAuth`).
- Differentiate LDAP connectivity/bind errors to respond with HTTP 503 Directory Service Unavailable.
- Render fallback metrics with pod limits and 0 usage when the Kubernetes metrics server returns 404 or connection failures.
- Require `repoName` on trigger GET and DELETE operations to avoid accidental default fallback actions.
- Use case-insensitive regex for Bearer token extraction.

**Non-Goals:**
- Modifying underlying Kubernetes CRD definitions or KRO schemas.
- Changing GitLab OAuth scope configurations.

## Decisions

### Decision 1: Tenant Ownership Verification for Trigger Operations
- **Approach**: In `triggers.ts`, before creating or deleting a trigger, check if the project with `projectId` is present in `gitlabService.getGroupProjects(team.gitlab_group_path, token)` for any of `req.user.activeTeams`. If not found, return `403 Forbidden`.
- **Rationale**: Reuses existing GitLab group query mechanics and guarantees that users cannot trigger or manipulate pipelines on repositories outside their onboarded teams.

### Decision 2: 503 Status on LDAP Failures
- **Approach**: In `auth.ts`, inspect errors caught during OAuth user profile and group lookup. If the error originates from LDAP (e.g. `err.message` contains `LDAP Bind Failure` or `LDAP Search Failure` or `LDAP Entry Error`), respond with `503` status and `{ error: 'Directory Service Unavailable', message: err.message }`.
- **Rationale**: Conforms directly with spec requirements and informs clients that identity directory infrastructure is temporarily unavailable rather than application logic crashing.

### Decision 3: Resilient Pod Metrics Fallback
- **Approach**: In `metricsService.getBuildResourceUsage`, catch `client.getPodMetrics` failure independently of `client.getPodLimits`. If `getPodMetrics` rejects (e.g. 404), continue with `rawMetrics = { containers: [] }`, resulting in 0 cores / 0% usage while successfully returning the pod's configured resource limits (`cpuLimitCores`, `memoryLimitBytes`).
- **Rationale**: Prevents dashboard metric view failures when the Kubernetes metrics-server is restarting or absent in development clusters.

### Decision 4: Mandatory `repoName` Parameter on Trigger Routes
- **Approach**: In `triggers.ts`, inspect `req.query.repoName`. If empty or whitespace, reject with `400 Bad Request` (`Missing required query parameter: repoName`).
- **Rationale**: Prevents accidental operations on the fallback name `app-trigger`.

## Risks / Trade-offs

- **[Risk]** Additional GitLab API call to verify project group membership on trigger provision.  
  → **Mitigation**: Project listings for team groups are fast and already scoped via `per_page=100`.
