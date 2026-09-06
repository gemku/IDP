## MODIFIED Requirements

### Requirement: GitLab CE OAuth 2.0 Authentication
The platform authentication service SHALL execute the OAuth 2.0 Authorization Code flow against GitLab CE, exchanging authorization codes for access tokens, retrieving user profile information, protecting handshakes with cryptographically secure state parameters, consuming state parameters upon verification to prevent replay attacks, and resolving Bearer tokens in API requests to establish authenticated sessions without pre-existing cookies.

#### Scenario: Successful OAuth 2.0 login
- **WHEN** a user initiates login and authorizes the platform application in GitLab CE
- **THEN** the platform verifies the OAuth state parameter, exchanges the authorization code for a GitLab access token, retrieves the user's username and email, and establishes an authenticated session

#### Scenario: Invalid or rejected authorization code
- **WHEN** the authorization code is invalid, expired, or rejected by GitLab CE
- **THEN** the platform terminates the authentication handshake and redirects the user to the login error page with an authentication failure message

#### Scenario: CSRF state parameter mismatch
- **WHEN** an OAuth callback request arrives with a state parameter that does not match the session-generated state or is missing
- **THEN** the platform aborts the authentication handshake with a 403 Forbidden error indicating state verification failed

#### Scenario: CSRF state parameter consumed after verification
- **WHEN** an OAuth callback request successfully verifies the session state parameter
- **THEN** the platform clears the stored state parameter from the session immediately to prevent subsequent replay attempts

#### Scenario: API request authenticated with Bearer token
- **WHEN** a client sends an API request carrying a valid Bearer access token in the Authorization header
- **THEN** the auth guard resolves the user context and permits access without requiring a pre-existing cookie session

#### Scenario: Malformed or missing request body
- **WHEN** a client sends a request to the auth callback without a body or with an unsupported Content-Type header
- **THEN** the endpoint safely inspects query parameters without raising unhandled property access exceptions

### Requirement: Admin Team Onboarding Management
The platform SHALL provide an Admin UI allowing platform administrators to create, read, update, delete, and toggle the active status of records in `onboarded_teams`, validate `gitlab_group_path` values against the GitLab API, strictly validate numeric identifier route parameters, safely handle missing request bodies, and reject duplicate team updates with conflict errors.

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
