## MODIFIED Requirements

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
The platform SHALL cross-reference the user's resolved LDAP group DNs against the `onboarded_teams` database table (`id`, `name`, `ldap_group_dn`, `gitlab_group_path`, `is_active`) using case-insensitive collation (`COLLATE NOCASE`), deduplicating group DNs prior to query construction, and permit access only if the user belongs to at least one active onboarded team.

#### Scenario: User belongs to an active onboarded team
- **WHEN** a user belongs to an LDAP group matching an active record in `onboarded_teams`
- **THEN** the platform grants access to the dashboard and loads the user's team context

#### Scenario: User is not onboarded or team is inactive
- **WHEN** a user does not belong to any active team listed in `onboarded_teams`
- **THEN** the platform terminates access and renders a 403 Forbidden Access Denied view explaining that the user's team is not onboarded

#### Scenario: Case-insensitive LDAP DN matching
- **WHEN** an LDAP directory returns group DNs with casing that differs from the database record (e.g., `CN=Platform,OU=Groups...` vs `cn=platform,ou=groups...`)
- **THEN** the database query evaluates the match using `COLLATE NOCASE` and correctly authorizes the user

#### Scenario: Deduplicate identical LDAP group assertions
- **WHEN** an authenticated user has duplicate group DN entries in their LDAP profile
- **THEN** the platform deduplicates the group DN list before constructing the SQL query placeholders
