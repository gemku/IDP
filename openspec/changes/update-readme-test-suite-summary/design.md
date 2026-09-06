## Context

The repository documentation in `README.md` provides an overview of the test suite and API endpoints. Following the additions of `postgresDb.test.ts` (6 tests) and `healthLifecycle.test.ts` (10 tests), the documentation needs to be updated to match the current codebase state.

See `proposal.md` for motivation.

## Goals / Non-Goals

**Goals:**
- Update `README.md` test suite summary block to list all 13 test files and 92 passing tests.
- Update `README.md` Health API reference to detail `/api/health/live` and `/api/health/ready`.

**Non-Goals:**
- Modifying backend or frontend source code.
- Modifying existing OpenSpec capability specifications.

## Decisions

### Decision 1: Test Suite Output Representation
- Reflect the exact alphabetical/execution output from Vitest:
  ```text
   ✓ tests/db.test.ts (7 tests)
   ✓ tests/repos.test.ts (8 tests)
   ✓ tests/observability.test.ts (11 tests)
   ✓ tests/healthLifecycle.test.ts (10 tests)
   ✓ tests/frontendEntry.test.ts (5 tests)
   ✓ tests/kubernetesDeployment.test.ts (5 tests)
   ✓ tests/repositoryPicker.test.ts (5 tests)
   ✓ tests/argoKpack.test.ts (4 tests)
   ✓ tests/postgresDb.test.ts (6 tests)
   ✓ tests/config.test.ts (3 tests)
   ✓ tests/e2e.test.ts (1 test)
   ✓ tests/kroTrigger.test.ts (9 tests)
   ✓ tests/auth.test.ts (18 tests)

   Test Files  13 passed (13)
        Tests  92 passed (92)
  ```

### Decision 2: Health API Reference Details
- Document probe contracts:
  - `GET /api/health`: Deep readiness check (status 200 with component status, or 503 on error). Supports `?probe=live`.
  - `GET /api/health/ready`: Kubernetes readiness probe verifying database connectivity.
  - `GET /api/health/live`: Kubernetes liveness probe verifying process responsiveness.

## Risks / Trade-offs

- **[Risk]** Documentation getting out of sync again if further tests are added.
  - **Mitigation**: Future changes will update test tallies during their respective OpenSpec tasks.

