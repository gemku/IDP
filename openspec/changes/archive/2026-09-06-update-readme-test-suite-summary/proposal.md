## Why

The root `README.md` currently documents an outdated test suite summary of 11 test files and 75 tests, predating the dual PostgreSQL database integration and health/lifecycle hardening changes. The test suite has grown to 13 test files and 92 automated tests. Updating the documentation ensures developers and evaluators have an accurate reference for project verification.

## What Changes

- Update the "Current test suite summary" code block in `README.md` to reflect all 13 test files and 92 passing tests.
- Update the Health section in the `README.md` API Reference to document the dedicated `/api/health/ready` and `/api/health/live` probe endpoints.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
<!-- None: Pure documentation update; skip_specs: true is configured -->

## Impact

- `README.md`: Updated test suite results and API reference for health probes.
- No source code, dependencies, or system behavioral specifications are modified.

