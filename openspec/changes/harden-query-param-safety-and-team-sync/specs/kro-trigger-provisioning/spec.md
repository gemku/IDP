## MODIFIED Requirements

### Requirement: KRO GitLabTagTrigger Custom Resource Management
The backend service SHALL use `@kubernetes/client-node` to manage KRO `GitLabTagTrigger` resources under `kro.run/v1alpha1`. It SHALL strictly validate numeric project identifiers, enforce active team tenant authorization on all trigger routes, safely parse query parameters, require repository names on trigger retrieval and deletion, and sanitize resource names per RFC 1123 DNS subdomain standards.

#### Scenario: Linking a repository to trigger provisioning
- **WHEN** a user selects and enables pipeline triggering for a repository
- **THEN** the backend constructs and applies a `GitLabTagTrigger` custom resource specifying repo URL, project ID, and target namespace

#### Scenario: Removing a repository trigger
- **WHEN** a user deprovisions a repository trigger with a valid repoName parameter
- **THEN** the backend issues a delete call for the `GitLabTagTrigger` CR, cascading deletion to all synthesized resources

#### Scenario: Non-numeric project ID provided
- **WHEN** a client submits a non-numeric project ID to the trigger provision endpoint
- **THEN** the backend rejects the request with a 400 Bad Request error

#### Scenario: Resource name normalized to RFC 1123 DNS subdomain standard
- **WHEN** a repository name contains non-alphanumeric characters, underscores, or excess length
- **THEN** the backend sanitizes the metadata name to only lowercase alphanumeric characters and internal hyphens, capped at 63 characters, and starting/ending with an alphanumeric character

#### Scenario: Trigger query or delete request missing repoName parameter
- **WHEN** a client requests GET or DELETE on `/api/repos/:projectId/trigger` without providing a `repoName` query parameter
- **THEN** the backend rejects the request with a 400 Bad Request error indicating missing repository name

#### Scenario: Tenant isolation enforced on trigger inspection
- **WHEN** an authenticated user attempts to inspect or get a trigger for a project ID that does not belong to any of their active onboarded teams
- **THEN** the backend rejects the request with a 403 Forbidden error and descriptive access denial message

#### Scenario: Multi-value query parameters handled safely on trigger routes
- **WHEN** a client submits multi-value query parameters (e.g., `?repoName=a&repoName=b`) on trigger inspection or deletion
- **THEN** the backend extracts the first string safely without throwing unhandled runtime type errors
