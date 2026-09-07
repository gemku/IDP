## 1. Backend Route Unification

- [x] 1.1 Support both `/:repoName/logs` and `/:repoName/stream` in `src/backend/routes/observability.ts` and verify unit tests pass
- [x] 1.2 Add automated test coverage in `tests/observability.test.ts` for `/:repoName/stream` endpoint alongside `/:repoName/logs` and verify with `npm test`

## 2. Frontend Telemetry and Streaming Enhancements

- [x] 2.1 Fetch dynamic pipeline milestones from `/api/repos/:repoName/pipeline-status` and pod metrics from `/api/repos/:repoName/metrics` in `src/frontend/App.tsx` upon repository selection
- [x] 2.2 Add stream disconnection and failure diagnostic reporting in `src/frontend/components/DarkTerminal.tsx`
- [x] 2.3 Compile client assets using `npm run build:client` and verify type safety with `npx tsc --noEmit`

## 3. End-to-End Verification

- [x] 3.1 Run the full test suite (`npm test`) to ensure all 92+ tests pass with zero regressions
- [x] 3.2 Validate OpenSpec changes with `openspec validate --changes`
