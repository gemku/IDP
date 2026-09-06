# observability-dashboards Specification

## Purpose

Provides real-time fleet health visibility, 4-step pipeline status tracking, pod resource gauges, and live container build log streaming.

## Requirements

### Requirement: Aggregated Fleet Dashboard
The platform frontend SHALL render an Aggregated Fleet Dashboard displaying aggregate build statistics, system status, active pipeline executions, and pass/fail metrics across all onboarded engineering teams.

#### Scenario: Platform user navigates to fleet dashboard
- **WHEN** an authenticated user opens the Fleet Dashboard
- **THEN** the dashboard renders fleet metrics including total active builds, success rate over the last 24 hours, average build duration, and per-team activity breakdown

### Requirement: Individual Repository 4-Step Pipeline Status
The frontend SHALL render an Individual Repository Dashboard showing real-time 4-step pipeline status progression: KRO provisioner (`KRO`), webhook receiver (`EventSource`), pipeline runner (`Workflow`), and image builder (`Kpack`).

#### Scenario: Visualizing repository pipeline status
- **WHEN** a user selects a repository dashboard
- **THEN** the UI displays four sequential milestone badges showing current state (Pending, Running, Succeeded, or Failed) with corresponding timestamp and latency details

### Requirement: Real-Time Resource Utilization Gauges
The platform backend SHALL query pod metrics from the Kubernetes Metrics API (`metrics.k8s.io/v1beta1`) and calculate percentage CPU and memory usage against pod limits, transmitting values to frontend radial gauges.

#### Scenario: Monitoring active build resource consumption
- **WHEN** a Kpack build pod is actively executing
- **THEN** the dashboard queries `metrics.k8s.io/v1beta1`, computes memory and CPU percentage against pod resource limits, and updates real-time radial gauges every 5 seconds

#### Scenario: Metrics server unavailable
- **WHEN** the Kubernetes metrics server is unreachable or reports 404
- **THEN** the dashboard renders fallback indicators showing resource limits without failing the dashboard view

### Requirement: Live Terminal Build Log Streaming via SSE
The backend SHALL expose a Server-Sent Events (SSE) endpoint (`/api/repos/:repoName/logs`) that tails live Kpack build initContainer logs (`detect`, `build`, `export`) using the Kubernetes Core API and streams chunks to a dark-mode frontend terminal component.

#### Scenario: User streams live build logs
- **WHEN** a user opens the log viewer for an active build
- **THEN** the frontend establishes an EventSource connection to `/api/repos/:repoName/logs` and renders ANSI-formatted log output in sequence across the `detect`, `build`, and `export` phases

#### Scenario: Build completes during log streaming
- **WHEN** the last initContainer (`export`) finishes and the build pod terminates
- **THEN** the SSE endpoint sends a completion event and cleanly closes the stream connection

