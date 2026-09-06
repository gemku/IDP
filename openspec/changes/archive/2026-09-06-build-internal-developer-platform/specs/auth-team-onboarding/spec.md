## Purpose

Enables secure GitLab CE OAuth 2.0 user login, backend LDAP memberOf group resolution via ldapjs, onboarded team database authorization, and administrative team lifecycle management.

## ADDED Requirements

### Requirement: GitLab CE OAuth 2.0 Authentication
The platform authentication service SHALL execute the OAuth 2.0 Authorization Code flow against GitLab CE, exchanging authorization codes for access tokens and retrieving user profile information.

#### Scenario: Successful OAuth 2.0 login
- **WHEN** a user initiates login and authorizes the platform application in GitLab CE
- **THEN** the platform exchanges the authorization code for a GitLab access token, retrieves the user's username and email, and establishes an authenticated session

#### Scenario: Invalid or rejected authorization code
- **WHEN** the authorization code is invalid, expired, or rejected by GitLab CE
- **THEN** the platform terminates the authentication handshake and redirects the user to the login error page with an authentication failure message

### Requirement: Backend LDAP Group Resolution
The backend service SHALL use `ldapjs` to directly bind to the LDAP directory and query the authenticated user's `memberOf` attributes to ascertain their active LDAP group memberships.

#### Scenario: Successfully query user LDAP groups
- **WHEN** an authenticated user establishes a session
- **THEN** the backend connects to the LDAP directory, searches for the user's DN, and extracts all `memberOf` group DNs

#### Scenario: LDAP directory unreachable
- **WHEN** the backend fails to connect to the LDAP directory
- **THEN** the service logs the connection error and returns a 503 Directory Service Unavailable error without granting access

### Requirement: Team-Based Access Enforcement
The platform SHALL cross-reference the user's resolved LDAP group DNs against the `onboarded_teams` database table (`id`, `name`, `ldap_group_dn`, `gitlab_group_path`, `is_active`) and permit access only if the user belongs to at least one active onboarded team.

#### Scenario: User belongs to an active onboarded team
- **WHEN** a user belongs to an LDAP group matching an active record in `onboarded_teams`
- **THEN** the platform grants access to the dashboard and loads the user's team context

#### Scenario: User is not onboarded or team is inactive
- **WHEN** a user does not belong to any active team listed in `onboarded_teams`
- **THEN** the platform terminates access and renders a 403 Forbidden Access Denied view explaining that the user's team is not onboarded

### Requirement: Admin Team Onboarding Management
The platform SHALL provide an Admin UI allowing platform administrators to create, read, update, delete, and toggle the active status of records in `onboarded_teams`, and validate `gitlab_group_path` values against the GitLab API.

#### Scenario: Administrator adds and validates a new team
- **WHEN** an administrator submits a new team with name, LDAP group DN, and GitLab group path
- **THEN** the backend validates the GitLab group path via `GET /api/v4/groups/:id` before persisting the active record in `onboarded_teams`

#### Scenario: Administrator enters an invalid GitLab group path
- **WHEN** an administrator enters a GitLab group path that does not exist or is inaccessible
- **THEN** the backend rejects the submission with a 422 Unprocessable Entity error indicating the group could not be verified in GitLab

