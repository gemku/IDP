# observability-dashboards Specification

## Purpose

Provides real-time fleet health visibility, 4-step pipeline status tracking, pod resource gauges, and live container build log streaming.

## Requirements

### Requirement: Aggregated Fleet Dashboard
The platform frontend and backend SHALL expose and render an Aggregated Fleet Dashboard at `/api/fleet/health` displaying aggregate build statistics, system status, active pipeline executions, and pass/fail metrics across all onboarded engineering teams without routing collision with repository paths.

#### Scenario: Platform user navigates to fleet dashboard
- **WHEN** an authenticated user opens the Fleet Dashboard
- **THEN** the dashboard renders fleet metrics including total active builds, success rate over the last 24 hours, average build duration, and per-team activity breakdown

#### Scenario: Fleet health endpoint isolated from repository namespace
- **WHEN** the client fetches fleet health metrics
- **THEN** the request targets `/api/fleet/health` independently from `/api/repos/:repoName/*`

### Requirement: Individual Repository 4-Step Pipeline Status
The frontend SHALL render an Individual Repository Dashboard showing real-time 4-step pipeline status progression: KRO provisioner (`KRO`), webhook receiver (`EventSource`), pipeline runner (`Workflow`), and image builder (`Kpack`).

#### Scenario: Visualizing repository pipeline status
- **WHEN** a user selects a repository dashboard
- **THEN** the UI displays four sequential milestone badges showing current state (Pending, Running, Succeeded, or Failed) with corresponding timestamp and latency details

### Requirement: Real-Time Resource Utilization Gauges
The platform backend SHALL query pod metrics from the Kubernetes Metrics API (`metrics.k8s.io/v1beta1`) and calculate percentage CPU and memory usage against pod limits, safely parsing both string and numeric metric representations without runtime exceptions, and falling back to pod resource limits when the metrics server is unavailable without failing the dashboard view.

#### Scenario: Monitoring active build resource consumption
- **WHEN** a Kpack build pod is actively executing
- **THEN** the dashboard queries `metrics.k8s.io/v1beta1`, computes memory and CPU percentage against pod resource limits, and updates real-time radial gauges every 5 seconds

#### Scenario: Metrics server unavailable
- **WHEN** the Kubernetes metrics server is unreachable or reports 404
- **THEN** the dashboard renders fallback indicators showing resource limits without failing the dashboard view

#### Scenario: Numeric or unformatted resource quantity inputs
- **WHEN** the metrics client returns numeric values or strings without standard Kubernetes unit suffixes
- **THEN** the quantity parser converts and scales the inputs safely without throwing unhandled type errors

### Requirement: Live Terminal Build Log Streaming via SSE
The backend SHALL expose a Server-Sent Events (SSE) endpoint (`/api/repos/:repoName/logs`) that tails live Kpack build initContainer logs (`detect`, `build`, `export`) using the Kubernetes Core API and streams chunks to a dark-mode frontend terminal component, setting reverse-proxy unbuffering headers, cleanly aborting when clients disconnect, and displaying custom server-sent error event descriptions in the terminal log.

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
