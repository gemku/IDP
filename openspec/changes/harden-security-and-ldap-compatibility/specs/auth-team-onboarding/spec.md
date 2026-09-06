## MODIFIED Requirements

### Requirement: GitLab CE OAuth 2.0 Authentication
The platform authentication service SHALL execute the OAuth 2.0 Authorization Code flow against GitLab CE, exchanging authorization codes for access tokens, retrieving user profile information, protecting handshakes with cryptographically secure state parameters, and accepting valid Bearer tokens for API access.

#### Scenario: Successful OAuth 2.0 login
- **WHEN** a user initiates login and authorizes the platform application in GitLab CE
- **THEN** the platform verifies the OAuth state parameter, exchanges the authorization code for a GitLab access token, retrieves the user's username and email, and establishes an authenticated session

#### Scenario: Invalid or rejected authorization code
- **WHEN** the authorization code is invalid, expired, or rejected by GitLab CE
- **THEN** the platform terminates the authentication handshake and redirects the user to the login error page with an authentication failure message

#### Scenario: CSRF state parameter mismatch
- **WHEN** an OAuth callback request arrives with a state parameter that does not match the session-generated state or is missing
- **THEN** the platform aborts the authentication handshake with a 403 Forbidden error indicating state verification failed

#### Scenario: API request authenticated with Bearer token
- **WHEN** a client sends an API request carrying a valid Bearer access token in the Authorization header
- **THEN** the auth guard resolves the user context and permits access without requiring a pre-existing cookie session

### Requirement: Backend LDAP Group Resolution
The backend service SHALL use `ldapjs` to directly bind to the LDAP directory and query the authenticated user's `memberOf` attributes, sanitizing search assertion values against LDAP injection per RFC 4515.

#### Scenario: Successfully query user LDAP groups
- **WHEN** an authenticated user establishes a session
- **THEN** the backend connects to the LDAP directory, searches for the user's DN, and extracts all `memberOf` group DNs

#### Scenario: LDAP directory unreachable
- **WHEN** the backend fails to connect to the LDAP directory
- **THEN** the service logs the connection error and returns a 503 Directory Service Unavailable error without granting access

#### Scenario: Special characters in username sanitized against LDAP injection
- **WHEN** a username containing characters such as `*`, `(`, `)`, `\`, or null bytes is submitted
- **THEN** the service escapes special characters into hexadecimal representations per RFC 4515 before evaluating the search filter

### Requirement: Team-Based Access Enforcement
The platform SHALL cross-reference the user's resolved LDAP group DNs against the `onboarded_teams` database table (`id`, `name`, `ldap_group_dn`, `gitlab_group_path`, `is_active`) using case-insensitive collation (`COLLATE NOCASE`) and permit access only if the user belongs to at least one active onboarded team.

#### Scenario: User belongs to an active onboarded team
- **WHEN** a user belongs to an LDAP group matching an active record in `onboarded_teams`
- **THEN** the platform grants access to the dashboard and loads the user's team context

#### Scenario: User is not onboarded or team is inactive
- **WHEN** a user does not belong to any active team listed in `onboarded_teams`
- **THEN** the platform terminates access and renders a 403 Forbidden Access Denied view explaining that the user's team is not onboarded

#### Scenario: Case-insensitive LDAP DN matching
- **WHEN** an LDAP directory returns group DNs with casing that differs from the database record (e.g., `CN=Platform,OU=Groups...` vs `cn=platform,ou=groups...`)
- **THEN** the database query evaluates the match using `COLLATE NOCASE` and correctly authorizes the user
