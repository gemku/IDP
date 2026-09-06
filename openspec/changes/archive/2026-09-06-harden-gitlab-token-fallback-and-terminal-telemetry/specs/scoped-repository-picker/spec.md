## MODIFIED Requirements

### Requirement: Scoped Group Project Discovery
The platform backend SHALL query the GitLab REST API endpoint `GET /api/v4/groups/:id/projects?include_subgroups=true&membership=true` using the group ID corresponding to the user's onboarded team, falling back to the configured system administrator token when no user token is provided, strictly validating numeric query parameters, and preventing access to out-of-scope repositories.

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

#### Scenario: Admin token fallback for repository queries
- **WHEN** a repository query is initiated without an active user OAuth token
- **THEN** the service uses the configured system `adminToken` to authenticate against the GitLab API

### Requirement: Interactive Repository Picker Component
The frontend SHALL render a React + Tailwind CSS repository picker component featuring debounced search input, server-side and client-side pagination, repository visibility badges (public, internal, private), and defensive fallbacks when remote fetches return undefined collections.

#### Scenario: User filters repositories by name
- **WHEN** the user types characters into the search bar
- **THEN** the component debounces input by 300ms, applies the filter query against project names and paths, and updates the rendered project list

#### Scenario: Displaying repository visibility badges
- **WHEN** projects are loaded in the picker
- **THEN** each repository item renders a color-coded Tailwind badge indicating its visibility level (green for public, yellow for internal, purple for private)

#### Scenario: Client-side pagination in fallback mode
- **WHEN** repositories are filtered locally without a remote fetcher and the user navigates between pages
- **THEN** the picker slices and displays the repository subset for the active page index

#### Scenario: Remote fetcher returns undefined or empty project collection
- **WHEN** the `fetchProjects` callback resolves with an empty or missing `projects` field
- **THEN** the component safely defaults to an empty project array without raising unhandled property access errors
