## Why

In containerized and Kubernetes environments, logs must be structured, machine-parsable JSON to support ingestion and indexing across log aggregators (e.g. Grafana Loki, Fluentbit, Elasticsearch, Datadog, AWS CloudWatch). Currently, the platform backend relies on unstructured string outputs (`console.log` and `console.error`) and lacks unified HTTP access logging, correlation tracking, and configurable log levels.

## What Changes

- **Structured Logger Module**: Implement a lightweight, zero-dependency structured logger (`src/backend/utils/logger.ts`) supporting standard log levels (`debug`, `info`, `warn`, `error`), child contexts, and formatting modes (`json` vs `pretty`).
- **Standardized Log Envelope**: Emit JSON log entries adhering to a consistent schema: `timestamp` (ISO 8601 UTC), `level`, `service: "platform-backend"`, `message`, and optional structured metadata (`requestId`, `userId`, `durationMs`, `error`, `context`).
- **HTTP Access Logging Middleware**: Integrate structured request/response logging middleware into the Express application pipeline in `src/backend/app.ts`, logging method, path, status code, latency, and correlation IDs without logging sensitive tokens or secrets.
- **Configuration Integration**: Add `LOG_LEVEL` and `LOG_FORMAT` configuration settings in `src/backend/config.ts` with sensible defaults (`info` and `json` in production, `pretty` available for development).
- **Server Lifecycle & Probe Logging**: Replace unformatted `console.*` calls in `server.ts` and lifecycle handlers with the structured logger.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `observability-dashboards`: Add requirement for Structured JSON Application Logging covering JSON log formatting, metadata envelopes, HTTP request logging, and configurable log levels.

## Impact

- **Backend Modules**: `src/backend/utils/logger.ts` (new logger utility), `src/backend/middleware/requestLogger.ts` (new request middleware), `src/backend/config.ts` (new log options), `src/backend/app.ts` and `src/backend/server.ts` (structured logging integration).
- **Configuration**: Exposes `LOG_LEVEL` (`debug`, `info`, `warn`, `error`) and `LOG_FORMAT` (`json`, `pretty`).
- **Compatibility**: 100% backward compatible with existing API endpoints and test suites.
