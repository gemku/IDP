## 1. Core Structured Logger Implementation

- [x] 1.1 Implement `Logger` class and log formatting in `src/backend/utils/logger.ts` supporting log levels, JSON envelopes, pretty printing, and child logger contexts
- [x] 1.2 Add `logging` configuration options (`LOG_LEVEL` and `LOG_FORMAT`) in `src/backend/config.ts`
- [x] 1.3 Add unit tests in `tests/logger.test.ts` validating JSON envelope structure, level filtering, error serialization, and pretty mode

## 2. Express Request Logging & Server Integration

- [x] 2.1 Implement `createRequestLoggerMiddleware` in `src/backend/middleware/requestLogger.ts` with request timing, correlation ID tracking, and credential redaction
- [x] 2.2 Attach request logger middleware in `src/backend/app.ts` and migrate server lifecycle logging in `src/backend/server.ts` to the structured logger
- [x] 2.3 Add integration tests in `tests/requestLogger.test.ts` verifying HTTP request log emission, correlation headers, and credential redaction

## 3. End-to-End Verification & Documentation

- [x] 3.1 Run full test suite (`npm test`) and type checks (`npx tsc --noEmit`) to verify zero regressions
- [x] 3.2 Update `README.md` with logging configuration variables and run `npx openspec validate --changes`
