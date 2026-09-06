## 1. Database Health Check Interface and Implementations

- [x] 1.1 Add `checkHealth(): Promise<{ healthy: boolean; latencyMs: number; error?: string }>` to `IDatabaseManager` and implement in `SqliteDatabaseManager` with probe query execution and latency measurement
- [x] 1.2 Implement `checkHealth` in `PostgresDatabaseManager` and delegate in `DatabaseManager`, ensuring failure handling returns structured error and unhealthy status

## 2. Health and Lifecycle Endpoints in Express App

- [x] 2.1 Update `/api/health` in `src/backend/app.ts` to perform database readiness check, returning HTTP 200 on healthy or HTTP 503 on database error
- [x] 2.2 Add dedicated `/api/health/ready` and `/api/health/live` endpoints to `src/backend/app.ts`

## 3. Graceful Lifecycle Teardown and Kubernetes Manifests

- [x] 3.1 Update `src/backend/server.ts` to await `dbManager.close()` asynchronously on `SIGTERM`, `SIGINT`, and unhandled server errors, protected with a 5-second forced timeout
- [x] 3.2 Update `k8s/platform/04-deployment.yaml` to point `readinessProbe` to `/api/health/ready` and `livenessProbe` to `/api/health/live`

## 4. Automated Testing and Verification

- [x] 4.1 Create `tests/healthLifecycle.test.ts` covering `/api/health`, `/api/health/ready`, `/api/health/live`, database failure 503 responses, and `dbManager.checkHealth()`
- [x] 4.2 Run full test suite with `npm test` and TypeScript check with `npx tsc --noEmit` to verify zero regressions
