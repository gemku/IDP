## MODIFIED Requirements

### Requirement: Backend LDAP Group Resolution
The backend service SHALL use `ldapjs` to directly bind to the LDAP directory and query the authenticated user's `memberOf` attributes, sanitizing search assertion values against LDAP injection per RFC 4515, and returning HTTP 503 Service Unavailable when the directory service cannot be reached.

#### Scenario: Successfully query user LDAP groups
- **WHEN** an authenticated user establishes a session
- **THEN** the backend connects to the LDAP directory, searches for the user's DN, and extracts all `memberOf` group DNs

#### Scenario: LDAP directory unreachable
- **WHEN** the backend fails to connect to the LDAP directory
- **THEN** the service logs the connection error and returns a 503 Directory Service Unavailable error without granting access

#### Scenario: Special characters in username sanitized against LDAP injection
- **WHEN** a username containing characters such as `*`, `(`, `)`, `\`, or null bytes is submitted
- **THEN** the service escapes special characters into hexadecimal representations per RFC 4515 before evaluating the search filter

### Requirement: Admin Team Onboarding Management
The platform SHALL provide an Admin UI allowing authenticated platform administrators to create, read, update, delete, and toggle the active status of records in `onboarded_teams`, validate `gitlab_group_path` values against the GitLab API, strictly validate numeric identifier route parameters, safely handle missing request bodies, and reject duplicate team updates with conflict errors.

#### Scenario: Administrator adds and validates a new team
- **WHEN** an administrator submits a new team with name, LDAP group DN, and GitLab group path
- **THEN** the backend validates the GitLab group path via `GET /api/v4/groups/:id` before persisting the active record in `onboarded_teams`

#### Scenario: Administrator enters an invalid GitLab group path
- **WHEN** an administrator enters a GitLab group path that does not exist or is inaccessible
- **THEN** the backend rejects the submission with a 422 Unprocessable Entity error indicating the group could not be verified in GitLab

#### Scenario: Non-numeric team ID provided
- **WHEN** a client submits a non-numeric team ID to an admin route (e.g., `/api/admin/teams/abc`)
- **THEN** the backend responds with a 400 Bad Request error indicating an invalid numeric ID format

#### Scenario: Administrator updates team with conflicting unique attributes
- **WHEN** an administrator submits an update to a team's name or LDAP DN that conflicts with an existing team
- **THEN** the backend intercepts the constraint violation and returns a 409 Conflict status with error details instead of a 500 error

#### Scenario: Request body missing or empty on admin mutation endpoints
- **WHEN** an admin request is received without a payload or with non-JSON Content-Type
- **THEN** the endpoint rejects the request with a 400 Bad Request error without raising unhandled destructuring exceptions

#### Scenario: Unauthenticated request to admin endpoints rejected
- **WHEN** an unauthenticated client sends a request to any `/api/admin/*` endpoint
- **THEN** the backend rejects the request with a 401 Unauthorized status
