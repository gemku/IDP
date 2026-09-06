## MODIFIED Requirements

### Requirement: Scoped Group Project Discovery
The platform backend SHALL query the GitLab REST API endpoint `GET /api/v4/groups/:id/projects?include_subgroups=true&membership=true` using the group ID corresponding to the user's onboarded team, preventing access to out-of-scope repositories, strictly validating numeric `teamId`, `page`, and `limit` query parameters without propagating `NaN`, and rejecting trigger provisioning or management requests for project IDs outside the user's authorized team groups.

#### Scenario: User queries repositories for their onboarded team
- **WHEN** a user navigates to the repository selection view
- **THEN** the backend fetches and returns only projects residing within the user's assigned GitLab group hierarchy where the user has active membership

#### Scenario: Attempt to access projects outside the team group
- **WHEN** a client submits a project request for a project ID outside their assigned team group
- **THEN** the backend rejects the request with HTTP 403 Forbidden

#### Scenario: Attempt to provision trigger for project outside team group
- **WHEN** a client submits a trigger provisioning request on `/api/repos/:projectId/trigger` for a project not belonging to any of their active teams
- **THEN** the backend rejects the request with HTTP 403 Forbidden indicating unauthorized cross-team project access

#### Scenario: Invalid non-numeric teamId parameter provided
- **WHEN** a client submits a non-numeric `teamId` query parameter (e.g., `?teamId=invalid`)
- **THEN** the backend responds with HTTP 400 Bad Request indicating that `teamId` must be a valid numeric identifier

#### Scenario: Non-numeric pagination parameters safely bounded
- **WHEN** a client supplies non-numeric or out-of-bounds `page` or `limit` query parameters (e.g., `?page=foo&limit=bar`)
- **THEN** the backend safely falls back to default pagination bounds (`page=1`, `limit=10`) without calculating `NaN` or returning corrupted pagination metadata
