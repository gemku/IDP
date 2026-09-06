## MODIFIED Requirements

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
