## MODIFIED Requirements

### Requirement: Aggregated Fleet Dashboard
The platform frontend and backend SHALL expose and render an Aggregated Fleet Dashboard at `/api/fleet/health` and within a unified single-page application, displaying aggregate build statistics, system status, active pipeline executions, and pass/fail metrics across all onboarded engineering teams without routing collision with repository paths, and handling uninitialized state safely without runtime exceptions.

#### Scenario: Platform user navigates to fleet dashboard
- **WHEN** an authenticated user opens the Fleet Dashboard in the application view
- **THEN** the dashboard renders fleet metrics including total active builds, success rate over the last 24 hours, average build duration, and per-team activity breakdown

#### Scenario: Fleet health endpoint isolated from repository namespace
- **WHEN** the client fetches fleet health metrics
- **THEN** the request targets `/api/fleet/health` independently from `/api/repos/:repoName/*`

#### Scenario: Fleet dashboard handles uninitialized or undefined stats safely
- **WHEN** the fleet dashboard renders before telemetry statistics have finished loading
- **THEN** the component renders a defensive loading fallback state without runtime exceptions

#### Scenario: Single-page application shell navigation
- **WHEN** a user navigates between the Fleet Dashboard and Repository workspaces in the browser application
- **THEN** the application switches views responsively without requiring page refreshes
