# auth-team-onboarding Specification

## Purpose

Enables secure GitLab CE OAuth 2.0 user login, backend LDAP memberOf group resolution via ldapjs, onboarded team database authorization, and administrative team lifecycle management.

## Requirements

### Requirement: GitLab CE OAuth 2.0 Authentication
The platform authentication service SHALL execute the OAuth 2.0 Authorization Code flow against GitLab CE, exchanging authorization codes for access tokens, retrieving user profile information, protecting handshakes with cryptographically secure state parameters, consuming state parameters upon verification to prevent replay attacks, dynamically refreshing active team membership from the database on identity inspection, and resolving Bearer tokens in API requests to establish authenticated sessions without pre-existing cookies.

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

#### Scenario: Current user profile reflects real-time team status changes
- **WHEN** an authenticated user queries `/api/auth/me` after their team has been deactivated or updated in the database
- **THEN** the backend dynamically refreshes active teams against the database and returns the current active team membership

### Requirement: Backend LDAP Group Resolution
The backend service SHALL use `ldapjs` to directly bind to the LDAP directory and query the authenticated user's `memberOf` attributes, sanitizing search assertion values against LDAP injection per RFC 4515, capturing client socket connection errors to immediately reject pending queries, and returning HTTP 503 Service Unavailable when the directory service cannot be reached.

#### Scenario: Successfully query user LDAP groups
- **WHEN** an authenticated user establishes a session
- **THEN** the backend connects to the LDAP directory, searches for the user's DN, and extracts all `memberOf` group DNs

#### Scenario: LDAP directory unreachable
- **WHEN** the backend fails to connect to the LDAP directory
- **THEN** the service logs the connection error and returns a 503 Directory Service Unavailable error without granting access

#### Scenario: Special characters in username sanitized against LDAP injection
- **WHEN** a username containing characters such as `*`, `(`, `)`, `\`, or null bytes is submitted
- **THEN** the service escapes special characters into hexadecimal representations per RFC 4515 before evaluating the search filter

#### Scenario: Socket connection error during search or bind
- **WHEN** the LDAP client encounters a socket reset, network timeout, or DNS resolution failure
- **THEN** the error handler rejects the operation immediately and closes the client connection without leaving the request hanging

### Requirement: Team-Based Access Enforcement
The platform SHALL cross-reference the user's resolved LDAP group DNs against the `onboarded_teams` database table (`id`, `name`, `ldap_group_dn`, `gitlab_group_path`, `is_active`) across either configured SQLite or PostgreSQL database engines, using case-insensitive comparison (`COLLATE NOCASE` in SQLite, case-insensitive evaluation in PostgreSQL), deduplicating group DNs prior to query construction, and permit access only if the user belongs to at least one active onboarded team.

#### Scenario: User belongs to an active onboarded team
- **WHEN** a user belongs to an LDAP group matching an active record in `onboarded_teams`
- **THEN** the platform grants access to the dashboard and loads the user's team context

#### Scenario: User is not onboarded or team is inactive
- **WHEN** a user does not belong to any active team listed in `onboarded_teams`
- **THEN** the platform terminates access and renders a 403 Forbidden Access Denied view explaining that the user's team is not onboarded

#### Scenario: Case-insensitive LDAP DN matching
- **WHEN** an LDAP directory returns group DNs with casing that differs from the database record (e.g., `CN=Platform,OU=Groups...` vs `cn=platform,ou=groups...`)
- **THEN** the database query evaluates the match case-insensitively across the active database engine (SQLite or PostgreSQL) and correctly authorizes the user

#### Scenario: Deduplicate identical LDAP group assertions
- **WHEN** an authenticated user has duplicate group DN entries in their LDAP profile
- **THEN** the platform deduplicates the group DN list before constructing the SQL query placeholders

#### Scenario: Database provider resolution via configuration
- **WHEN** the platform starts with PostgreSQL configuration (`DATABASE_CLIENT=postgres` or a PostgreSQL `DATABASE_URL`)
- **THEN** the platform initializes a PostgreSQL connection pool and executes schema migrations for PostgreSQL, falling back to SQLite when no PostgreSQL configuration is provided

#### Scenario: PostgreSQL connection pool error handling
- **WHEN** a query is executed against PostgreSQL and the database pool encounters a connection timeout or network termination
- **THEN** the database manager rejects the operation cleanly with structured error details without crashing the application process

### Requirement: Admin Team Onboarding Management
The platform SHALL provide an Admin UI allowing authenticated platform administrators to create, read, update, delete, and toggle the active status of records in `onboarded_teams`, validate `gitlab_group_path` values against the GitLab API, strictly validate numeric identifier route parameters, reject whitespace-only mutation values, catch database errors during state toggling, and return structured JSON errors on malformed payloads.

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

#### Scenario: Whitespace-only string rejected in team creation or update
- **WHEN** an administrator submits a team name, LDAP DN, or GitLab group path consisting entirely of whitespace
- **THEN** the backend rejects the submission with a 400 Bad Request error indicating missing required fields

#### Scenario: Malformed JSON payload returns structured JSON error
- **WHEN** a client sends a request body with invalid JSON syntax
- **THEN** the application error middleware catches the syntax error and responds with HTTP 400 and a JSON `{ "error": "Invalid JSON payload" }` response

#### Scenario: Database update failure during active status toggle
- **WHEN** an administrator toggles team active status and the database operation encounters an error
- **THEN** the endpoint catches the error and responds with a structured HTTP 500 error instead of terminating unexpectedly
