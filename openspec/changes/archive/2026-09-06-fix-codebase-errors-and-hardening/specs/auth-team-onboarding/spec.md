## MODIFIED Requirements

### Requirement: Admin Team Onboarding Management
The platform SHALL provide an Admin UI allowing platform administrators to create, read, update, delete, and toggle the active status of records in `onboarded_teams`, and validate `gitlab_group_path` values against the GitLab API, strictly validating numeric identifier route parameters.

#### Scenario: Administrator adds and validates a new team
- **WHEN** an administrator submits a new team with name, LDAP group DN, and GitLab group path
- **THEN** the backend validates the GitLab group path via `GET /api/v4/groups/:id` before persisting the active record in `onboarded_teams`

#### Scenario: Administrator enters an invalid GitLab group path
- **WHEN** an administrator enters a GitLab group path that does not exist or is inaccessible
- **THEN** the backend rejects the submission with a 422 Unprocessable Entity error indicating the group could not be verified in GitLab

#### Scenario: Non-numeric team ID provided
- **WHEN** a client submits a non-numeric team ID to an admin route (e.g., `/api/admin/teams/abc`)
- **THEN** the backend responds with a 400 Bad Request error indicating an invalid numeric ID format
