## Context

The platform backend currently runs on Node.js 24 and Express 5. Logging across the application is uncoordinated, utilizing standard `console.log` and `console.error` calls in `server.ts` without timestamps, severity levels, service context, or machine-readable JSON envelopes.

## Goals / Non-Goals

**Goals:**
- Provide a zero-dependency, high-performance structured `Logger` class in `src/backend/utils/logger.ts`.
- Format log output as newline-delimited JSON by default, with human-readable "pretty" fallback for local development.
- Support standard severity hierarchy: `debug` (0), `info` (1), `warn` (2), `error` (3) filtered by `LOG_LEVEL`.
- Integrate Express request access logging middleware capturing HTTP method, path, response status, duration in milliseconds, IP, and correlation IDs (`X-Request-Id`).
- Automatically redact sensitive headers and fields (`authorization`, `cookie`, `password`, `secret`).
- Support child loggers (`logger.child({ module: "..." })`) for modular context propagation.

**Non-Goals:**
- Adding heavyweight external logging frameworks (e.g. Winston, Morgan, Pino) when native TypeScript JSON serialization is lightweight, zero-dependency, and highly optimized.
- Altering the DarkTerminal frontend SSE log streaming mechanics or container initContainer logs.

## Decisions

### 1. Zero-Dependency Native Logger
- **Choice**: Implement a lightweight TypeScript `Logger` class outputting to `process.stdout` (for debug/info/warn) and `process.stderr` (for error).
- **Rationale**: Keeps container footprint minimal, avoids supply-chain dependencies, and natively integrates with Kubernetes container log collectors (Fluentbit, Promtail, Vector).
- **Alternatives Considered**: Pino / Winston (adds extra transitive dependencies without material benefit for this service scope).

### 2. Standardized JSON Envelope Format
- **Envelope fields**:
  - `timestamp`: ISO-8601 UTC timestamp.
  - `level`: Lowercase severity (`debug`, `info`, `warn`, `error`).
  - `service`: Static `"platform-backend"`.
  - `message`: Primary description of the logged event.
  - Contextual attributes: Arbitrary key-value pairs (e.g. `durationMs`, `status`, `requestId`, `error`, `stack`).

### 3. Request Access Logging Middleware
- **Choice**: Add `createRequestLoggerMiddleware(logger)` in `src/backend/middleware/requestLogger.ts`.
- **Details**:
  - Checks for incoming `x-request-id` header or generates a crypto UUID.
  - Sets `X-Request-Id` on the outgoing response.
  - Hooks `res.on("finish")` calculating high-resolution duration via `process.hrtime.bigint()`.
  - Suppresses routine `/api/health/live` probe logs from polluting production logs unless level is `debug` or status >= 400.

## Risks / Trade-offs

- **[Risk] High-frequency Kubernetes health probe spam** → **Mitigation**: Filter routine 200 OK `/api/health/live` requests from info-level access logs; allow full tracing at `debug` level.
- **[Risk] Credential leaks in logs** → **Mitigation**: Explicitly sanitize and omit `authorization`, `cookie`, and sensitive body/query parameters before serialization.
