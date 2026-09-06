## ADDED Requirements

### Requirement: Active Database Health Verification
The database manager SHALL provide an asynchronous health check capability across both SQLite and PostgreSQL backends that verifies active query execution, measures round-trip query latency, and captures connectivity failures.

#### Scenario: Healthy SQLite database verification
- **WHEN** the database health check is executed against an active SQLite database instance
- **THEN** the check executes a probe query, confirms availability, and returns healthy status with elapsed latency

#### Scenario: Healthy PostgreSQL database verification
- **WHEN** the database health check is executed against an active PostgreSQL database pool
- **THEN** the check queries the PostgreSQL pool, confirms connectivity, and returns healthy status with elapsed latency

#### Scenario: Unhealthy or disconnected database backend
- **WHEN** the database health check runs against a closed, uninitialized, or failing database instance
- **THEN** the check captures the error and returns unhealthy status with error details without raising uncaught exceptions
