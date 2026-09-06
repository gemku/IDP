# observability-dashboards Specification

## Purpose

Provides real-time fleet health visibility, 4-step pipeline status tracking, pod resource gauges, and live container build log streaming.

## Requirements

### Requirement: Aggregated Fleet Dashboard
The platform frontend and backend SHALL expose and render an Aggregated Fleet Dashboard at `/api/fleet/health` displaying aggregate build statistics, system status, active pipeline executions, and pass/fail metrics across all onboarded engineering teams without routing collision with repository paths, and handling uninitialized state safely without runtime exceptions.

#### Scenario: Platform user navigates to fleet dashboard
- **WHEN** an authenticated user opens the Fleet Dashboard
- **THEN** the dashboard renders fleet metrics including total active builds, success rate over the last 24 hours, average build duration, and per-team activity breakdown

#### Scenario: Fleet health endpoint isolated from repository namespace
- **WHEN** the client fetches fleet health metrics
- **THEN** the request targets `/api/fleet/health` independently from `/api/repos/:repoName/*`

#### Scenario: Fleet dashboard handles uninitialized or undefined stats safely
- **WHEN** the fleet dashboard renders before telemetry statistics have finished loading
- **THEN** the component renders a defensive loading fallback state without runtime exceptions

### Requirement: Individual Repository 4-Step Pipeline Status
The frontend SHALL render an Individual Repository Dashboard showing real-time 4-step pipeline status progression: KRO provisioner (`KRO`), webhook receiver (`EventSource`), pipeline runner (`Workflow`), and image builder (`Kpack`).

#### Scenario: Visualizing repository pipeline status
- **WHEN** a user selects a repository dashboard
- **THEN** the UI displays four sequential milestone badges showing current state (Pending, Running, Succeeded, or Failed) with corresponding timestamp and latency details

### Requirement: Real-Time Resource Utilization Gauges
The platform backend SHALL query pod metrics from the Kubernetes Metrics API (`metrics.k8s.io/v1beta1`) and calculate percentage CPU and memory usage against pod limits, safely parsing both string and numeric metric representations without runtime exceptions, clamping percentage values between 0 and 100 percent, and falling back to pod resource limits when the metrics server is unavailable without failing the dashboard view.

#### Scenario: Monitoring active build resource consumption
- **WHEN** a Kpack build pod is actively executing
- **THEN** the dashboard queries `metrics.k8s.io/v1beta1`, computes memory and CPU percentage against pod resource limits, and updates real-time radial gauges every 5 seconds

#### Scenario: Metrics server unavailable
- **WHEN** the Kubernetes metrics server is unreachable or reports 404
- **THEN** the dashboard renders fallback indicators showing resource limits without failing the dashboard view

#### Scenario: Numeric or unformatted resource quantity inputs
- **WHEN** the metrics client returns numeric values or strings without standard Kubernetes unit suffixes
- **THEN** the quantity parser converts and scales the inputs safely without throwing unhandled type errors

#### Scenario: Utilization percentages bounded between 0 and 100
- **WHEN** resource metrics are calculated for a build pod
- **THEN** the backend clamps CPU and memory percentage values strictly within the range of 0 to 100 percent inclusive

### Requirement: Live Terminal Build Log Streaming via SSE
The backend SHALL expose an SSE endpoint (`/api/repos/:repoName/logs`) tailing Kpack build initContainer logs (`detect`, `build`, `export`) to a dark-mode terminal component. It SHALL validate repository names, extract query parameters safely, set unbuffering headers, handle disconnects cleanly, render custom error events, and bound log buffer capacity.

#### Scenario: User streams live build logs
- **WHEN** a user opens the log viewer for an active build
- **THEN** the frontend establishes an EventSource connection to `/api/repos/:repoName/logs` and renders ANSI-formatted log output in sequence across the `detect`, `build`, and `export` phases

#### Scenario: Build completes during log streaming
- **WHEN** the last initContainer (`export`) finishes and the build pod terminates
- **THEN** the SSE endpoint sends a completion event and cleanly closes the stream connection

#### Scenario: Client disconnects during streaming
- **WHEN** the client terminates the HTTP connection while logs are actively streaming
- **THEN** the server catches the connection close event, stops tailing and timer loops, and releases all stream listeners immediately

#### Scenario: Ingress reverse proxy stream transmission
- **WHEN** the SSE stream is initiated through an ingress proxy
- **THEN** the backend transmits `X-Accel-Buffering: no` in response headers to ensure real-time chunk delivery

#### Scenario: Terminal component handles dynamic phase updates and clipboard actions
- **WHEN** log chunks are received across build phases or copied to clipboard
- **THEN** the terminal component captures the active build phase without stale closure anomalies and handles clipboard rejections gracefully

#### Scenario: Server-sent error event rendered in terminal
- **WHEN** the backend transmits a custom `event: error` SSE block with an error message payload
- **THEN** the terminal component parses the error payload and renders an informative system error line in the log stream

#### Scenario: Empty or whitespace repository name rejected
- **WHEN** a client requests logs, metrics, or pipeline status with an empty or whitespace-only repository name parameter
- **THEN** the backend returns a 400 Bad Request error

#### Scenario: Terminal log buffer bounded to prevent memory exhaustion
- **WHEN** an active build stream emits extensive log lines
- **THEN** the dark terminal component limits its in-memory log buffer to the most recent entries, preventing tab memory exhaustion

#### Scenario: Multi-value query parameters handled safely on observability routes
- **WHEN** a client submits repeated query parameters (e.g. `?namespace=a&namespace=b`)
- **THEN** the backend extracts the first string safely without throwing unhandled runtime type errors
