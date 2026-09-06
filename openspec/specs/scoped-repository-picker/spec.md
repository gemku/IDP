# scoped-repository-picker Specification

## Purpose

Restricts repository discovery strictly to the user's onboarded GitLab group hierarchy and provides an interactive, searchable repository picker.

## Requirements

### Requirement: Scoped Group Project Discovery
The platform backend SHALL query the GitLab REST API endpoint `GET /api/v4/groups/:id/projects?include_subgroups=true&membership=true` using the group ID corresponding to the user's onboarded team, preventing access to out-of-scope repositories.

#### Scenario: User queries repositories for their onboarded team
- **WHEN** a user navigates to the repository selection view
- **THEN** the backend fetches and returns only projects residing within the user's assigned GitLab group hierarchy where the user has active membership

#### Scenario: Attempt to access projects outside the team group
- **WHEN** a client submits a project request for a project ID outside their assigned team group
- **THEN** the backend rejects the request with HTTP 403 Forbidden

### Requirement: Interactive Repository Picker Component
The frontend SHALL render a React + Tailwind CSS repository picker component featuring debounced search input, server-side or client pagination, and repository visibility badges (public, internal, private).

#### Scenario: User filters repositories by name
- **WHEN** the user types characters into the search bar
- **THEN** the component debounces input by 300ms, applies the filter query against project names and paths, and updates the rendered project list

#### Scenario: Displaying repository visibility badges
- **WHEN** projects are loaded in the picker
- **THEN** each repository item renders a color-coded Tailwind badge indicating its visibility level (green for public, yellow for internal, purple for private)
