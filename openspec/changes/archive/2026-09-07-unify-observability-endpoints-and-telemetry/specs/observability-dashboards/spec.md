## MODIFIED Requirements

### Requirement: Individual Repository 4-Step Pipeline Status
The frontend SHALL render an Individual Repository Dashboard showing real-time 4-step pipeline status progression: KRO provisioner (`KRO`), webhook receiver (`EventSource`), pipeline runner (`Workflow`), and image builder (`Kpack`). When a repository is selected, the frontend SHALL dynamically retrieve pipeline milestone status from `/api/repos/:repoName/pipeline-status` and pod resource metrics from `/api/repos/:repoName/metrics`, falling back gracefully to baseline metrics if the endpoints are unavailable.

#### Scenario: Visualizing repository pipeline status
- **WHEN** a user selects a repository dashboard
- **THEN** the UI displays four sequential milestone badges showing current state (Pending, Running, Succeeded, or Failed) with corresponding timestamp and latency details

#### Scenario: Dynamic telemetry fetching on repository selection
- **WHEN** a user switches between repositories in the dashboard
- **THEN** the client queries `/api/repos/:repoName/pipeline-status` and `/api/repos/:repoName/metrics` and updates the pipeline stage badges and resource gauges dynamically

### Requirement: Live Terminal Build Log Streaming via SSE
The backend SHALL expose SSE streaming endpoints (`/api/repos/:repoName/logs` and `/api/repos/:repoName/stream`) tailing Kpack build initContainer logs (`detect`, `build`, `export`) to a dark-mode terminal component. It SHALL validate repository names, extract query parameters safely, set unbuffering headers, handle disconnects cleanly, render custom error events, bound log buffer capacity, and output diagnostic messages upon stream disconnection or failure.

#### Scenario: User streams live build logs
- **WHEN** a user opens the log viewer for an active build
- **THEN** the frontend establishes an EventSource connection to `/api/repos/:repoName/logs` or `/api/repos/:repoName/stream` and renders ANSI-formatted log output in sequence across the `detect`, `build`, and `export` phases

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

#### Scenario: Terminal logs connection error or premature disconnection
- **WHEN** an EventSource connection fails or is severed before completing
- **THEN** the terminal component renders a diagnostic error line indicating the disconnection event and sets connected status to false

#### Scenario: Empty or whitespace repository name rejected
- **WHEN** a client requests logs, metrics, or pipeline status with an empty or whitespace-only repository name parameter
- **THEN** the backend returns a 400 Bad Request error

#### Scenario: Terminal log buffer bounded to prevent memory exhaustion
- **WHEN** an active build stream emits extensive log lines
- **THEN** the dark terminal component limits its in-memory log buffer to the most recent entries, preventing tab memory exhaustion

#### Scenario: Multi-value query parameters handled safely on observability routes
- **WHEN** a client submits repeated query parameters (e.g. `?namespace=a&namespace=b`)
- **THEN** the backend extracts the first string safely without throwing unhandled runtime type errors
