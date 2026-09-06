## MODIFIED Requirements

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

