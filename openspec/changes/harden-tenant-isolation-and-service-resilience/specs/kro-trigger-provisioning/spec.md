## MODIFIED Requirements

### Requirement: KRO GitLabTagTrigger Custom Resource Management
The backend service SHALL use `@kubernetes/client-node` to dynamically create, inspect, and delete KRO `GitLabTagTrigger` custom resources under group `kro.run/v1alpha1` in the team namespace when a repository is linked to the platform, strictly validating numeric project identifiers, requiring repository names on trigger retrieval and deletion, and sanitizing resource names to adhere to Kubernetes RFC 1123 DNS subdomain requirements.

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
