## MODIFIED Requirements

### Requirement: Interactive Repository Picker Component
The frontend SHALL render a React + Tailwind CSS repository picker component featuring debounced search input, server-side and client-side pagination, and repository visibility badges (public, internal, private).

#### Scenario: User filters repositories by name
- **WHEN** the user types characters into the search bar
- **THEN** the component debounces input by 300ms, applies the filter query against project names and paths, and updates the rendered project list

#### Scenario: Displaying repository visibility badges
- **WHEN** projects are loaded in the picker
- **THEN** each repository item renders a color-coded Tailwind badge indicating its visibility level (green for public, yellow for internal, purple for private)

#### Scenario: Client-side pagination in fallback mode
- **WHEN** repositories are filtered locally without a remote fetcher and the user navigates between pages
- **THEN** the picker slices and displays the repository subset for the active page index
