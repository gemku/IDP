## Context

The system has an established pattern for route protection, param validation, and SSE event emissions in `src/backend/routes/observability.ts`. The UI components (`RepositoryDashboard` and `DarkTerminal`) are rendered within `src/frontend/App.tsx`. See `proposal.md` for motivation.

## Goals / Non-Goals

**Goals:**
- Provide zero-friction dual route binding on both `/:repoName/logs` and `/:repoName/stream`.
- Load real-time pipeline status and resource usage from the backend when a repository is selected in the UI.
- Provide user-visible system feedback in `DarkTerminal` when the SSE stream drops or fails to connect.
- Retain full backwards compatibility with all existing tests and consumers.

**Non-Goals:**
- Modifying underlying Kubernetes Kpack streaming logic or changing Kpack log container sequence.
- Replacing the UI design or adding third-party websocket libraries.

## Decisions

### 1. Dual Route Handler Binding in Observability Router
- **Choice**: Extract the async handler function in `createObservabilityRouter` and bind it explicitly to both `router.get('/:repoName/logs', ...)` and `router.get('/:repoName/stream', ...)`.
- **Rationale**: Clean, explicit, and universally compatible across Express 4 and Express 5 route parsers without relying on multi-path array nuances.
- **Alternatives Considered**: HTTP 301/307 redirect from `/stream` to `/logs` (rejected because SSE clients often do not follow redirects or incur unnecessary roundtrips).

### 2. Dynamic Fetch with Graceful Offline Fallback in `App.tsx`
- **Choice**: Implement an effect in `App.tsx` triggered by `selectedProject?.name` that concurrently fetches `/api/repos/${selectedProject.name}/pipeline-status` and `/api/repos/${selectedProject.name}/metrics`. Fall back gracefully to standard baseline metrics if network requests fail or in offline demo mode.
- **Rationale**: Ensures the UI displays live data when running against a live backend while guaranteeing the UI remains fully functional in offline testing/demo mode.

### 3. Clear System Message in `DarkTerminal` On Error
- **Choice**: In `eventSource.onerror`, append a `{ phase: 'system', line: '[SYSTEM] Stream disconnected or failed to connect to ' + streamUrl, timestamp: ... }` log entry prior to closing.
- **Rationale**: Prevents confusion when a stream ends or fails, informing the developer of the exact event.

## Risks / Trade-offs

- **[Risk] High polling load on repository switch** → **Mitigation**: Fetch metrics only when a repository is selected; do not run an unthrottled infinite poll loop.
- **[Risk] SSE reconnect loops on connection close** → **Mitigation**: Standard EventSource reconnection is cleanly closed upon error in `DarkTerminal`.
