## Why

The platform frontend and backend currently exhibit a route discrepancy where the frontend and README reference `/api/repos/:repoName/stream` for live container build logs, while the backend observability router previously bound only `/api/repos/:repoName/logs`. Additionally, the repository dashboard renders static mock telemetry rather than fetching real-time pipeline status and pod resource usage from `/api/repos/:repoName/pipeline-status` and `/api/repos/:repoName/metrics`, and the DarkTerminal component silently terminates without rendering diagnostic connection failure logs when an SSE connection drops.

## What Changes

- **Observability Router Unified Log Streaming**: Expose SSE build log streaming on both `/api/repos/:repoName/logs` (canonical) and `/api/repos/:repoName/stream` (alias) so all client call sites and documentation match seamless runtime expectations.
- **Dynamic Repository Telemetry Integration**: Update `App.tsx` to dynamically query `/api/repos/:repoName/pipeline-status` and `/api/repos/:repoName/metrics` whenever an active repository is selected, with resilient fallback defaults when offline or during initial load.
- **Terminal Disconnect & Error Diagnostics**: Enhance `DarkTerminal.tsx` to render clear diagnostic system messages whenever an EventSource stream encounters an error or disconnects unexpectedly before build completion.
- **Comprehensive Automated Verification**: Add unit tests in `tests/observability.test.ts` to assert that both `/api/repos/:repoName/logs` and `/api/repos/:repoName/stream` return compliant SSE streams with `text/event-stream` and `X-Accel-Buffering: no`.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `observability-dashboards`: Add dual-path SSE streaming support (`/api/repos/:repoName/logs` and `/api/repos/:repoName/stream`), dynamic telemetry status and metrics integration in repository dashboard, and terminal error/disconnect reporting.

## Impact

- **Backend Routes**: `src/backend/routes/observability.ts` mounts both `/:repoName/logs` and `/:repoName/stream`.
- **Frontend Components**: `src/frontend/App.tsx` queries live pipeline and pod metrics endpoints for selected repositories; `src/frontend/components/DarkTerminal.tsx` renders connection drop diagnostics.
- **Tests**: `tests/observability.test.ts` verifies both log endpoints.
- **Compatibility**: 100% backwards-compatible with existing clients and test suites.
