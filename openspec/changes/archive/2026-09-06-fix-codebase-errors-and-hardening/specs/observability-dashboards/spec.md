## MODIFIED Requirements

### Requirement: Aggregated Fleet Dashboard
The platform frontend and backend SHALL expose and render an Aggregated Fleet Dashboard at `/api/fleet/health` displaying aggregate build statistics, system status, active pipeline executions, and pass/fail metrics across all onboarded engineering teams without routing collision with repository paths.

#### Scenario: Platform user navigates to fleet dashboard
- **WHEN** an authenticated user opens the Fleet Dashboard
- **THEN** the dashboard renders fleet metrics including total active builds, success rate over the last 24 hours, average build duration, and per-team activity breakdown

#### Scenario: Fleet health endpoint isolated from repository namespace
- **WHEN** the client fetches fleet health metrics
- **THEN** the request targets `/api/fleet/health` independently from `/api/repos/:repoName/*`

### Requirement: Live Terminal Build Log Streaming via SSE
The backend SHALL expose a Server-Sent Events (SSE) endpoint (`/api/repos/:repoName/logs`) that tails live Kpack build initContainer logs (`detect`, `build`, `export`) using the Kubernetes Core API and streams chunks to a dark-mode frontend terminal component, cleanly aborting when clients disconnect.

#### Scenario: User streams live build logs
- **WHEN** a user opens the log viewer for an active build
- **THEN** the frontend establishes an EventSource connection to `/api/repos/:repoName/logs` and renders ANSI-formatted log output in sequence across the `detect`, `build`, and `export` phases

#### Scenario: Build completes during log streaming
- **WHEN** the last initContainer (`export`) finishes and the build pod terminates
- **THEN** the SSE endpoint sends a completion event and cleanly closes the stream connection

#### Scenario: Client disconnects during streaming
- **WHEN** the client terminates the HTTP connection while logs are actively streaming
- **THEN** the server catches the connection close event, stops tailing and timer loops, and releases all stream listeners immediately
