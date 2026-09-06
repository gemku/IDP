## 1. TypeScript Configuration & Compilation Fixes

- [x] 1.1 Update `tsconfig.json` with `"jsx": "react-jsx"` and `"DOM"`, `"DOM.Iterable"` in compiler options
- [x] 1.2 Explicitly narrow required environment variables in `src/backend/config.ts` to satisfy strict types
- [x] 1.3 Update route parameter handling in `src/backend/routes/admin.ts`, `triggers.ts`, and `observability.ts` to safely parse Express 5 `string | string[]` params
- [x] 1.4 Update `KroService` in `src/backend/services/kroService.ts` with an adapter supporting @kubernetes/client-node v2.0 custom object requests
- [x] 1.5 Run `npx tsc --noEmit` and verify that all 84 compiler errors are eliminated

## 2. Runtime & Stream Reliability Hardening

- [x] 2.1 Implement `res.on('close')` abort handling in `LogStreamingService.streamKpackLogs` to terminate streaming loops on client disconnect
- [x] 2.2 Decouple fleet health from repository routes in `src/backend/app.ts` by introducing a dedicated `createFleetRouter` at `/api/fleet`
- [x] 2.3 Add numeric ID validation (guarding against `NaN`) with 400 Bad Request responses in admin and trigger routes

## 3. Kubernetes Sensor Hardening

- [x] 3.1 Add a negative filter condition in `k8s/argo/events/gitlab-tag-sensor.yaml` to ignore tag deletion pushes (where `after` is all zeros)

## 4. Verification & Validation

- [x] 4.1 Run complete Vitest test suite (`npx vitest run`) and confirm all unit, integration, and E2E tests pass
- [x] 4.2 Run `openspec validate fix-codebase-errors-and-hardening --strict` and verify change integrity
