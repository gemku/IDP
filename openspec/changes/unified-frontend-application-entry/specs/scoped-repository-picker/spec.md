## MODIFIED Requirements

### Requirement: Interactive Repository Picker Component
The frontend SHALL render a React + Tailwind CSS repository picker component featuring debounced search input, server-side and client-side pagination, repository visibility badges (public, internal, private), resetting pagination index when the team selection changes, defensive fallbacks when remote fetches return undefined collections, and seamless selection callback integration within the unified single-page application shell.

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

#### Scenario: Pagination resets to page 1 upon team selection change
- **WHEN** the `teamId` prop changes to a different team
- **THEN** the component resets `currentPage` to 1 to avoid requesting invalid page offsets

#### Scenario: Repository selection updates active workspace
- **WHEN** a user selects a repository in the picker
- **THEN** the application shell transitions to the selected repository's live dashboard and terminal execution stream
