## ADDED Requirements

### Requirement: Structured JSON Application Logging
The platform backend SHALL emit structured JSON log entries to standard output and standard error streams with a standardized JSON envelope including timestamp in ISO-8601 UTC format, severity level, service name (`platform-backend`), human-readable message, and optional contextual metadata (such as request ID, duration, status code, error details). The backend SHALL support configurable log levels (`debug`, `info`, `warn`, `error`) and formatting modes (`json` and `pretty`), and SHALL log inbound HTTP request completions without exposing sensitive authentication tokens or credentials.

#### Scenario: Server emits structured JSON logs in production mode
- **WHEN** the backend processes application events, lifecycle transitions, or errors with JSON formatting configured
- **THEN** log output lines are valid JSON objects containing `timestamp`, `level`, `service`, `message`, and any contextual attributes

#### Scenario: Inbound HTTP request logging with latency and status
- **WHEN** an HTTP client makes a request to an API endpoint
- **THEN** the server logs a completed request event recording method, path, response status code, elapsed duration in milliseconds, and correlation ID

#### Scenario: Sensitive credentials excluded from structured logs
- **WHEN** requests containing authorization tokens, passwords, or cookies are logged
- **THEN** the logger redacts or omits secret authorization headers and credentials from logged payloads

#### Scenario: Filtering log emission by configured log level
- **WHEN** a log level is configured (e.g. `warn` or `error`)
- **THEN** log events below the configured threshold (e.g. `debug` or `info`) are suppressed and not emitted
