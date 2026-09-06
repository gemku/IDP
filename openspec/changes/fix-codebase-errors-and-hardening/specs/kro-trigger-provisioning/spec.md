## MODIFIED Requirements

### Requirement: KRO GitLabTagTrigger Custom Resource Management
The backend service SHALL use `@kubernetes/client-node` to dynamically create, inspect, and delete KRO `GitLabTagTrigger` custom resources under group `kro.run/v1alpha1` in the team namespace when a repository is linked to the platform, strictly validating numeric project identifiers.

#### Scenario: Linking a repository to trigger provisioning
- **WHEN** a user selects and enables pipeline triggering for a repository
- **THEN** the backend constructs and applies a `GitLabTagTrigger` custom resource specifying repo URL, project ID, and target namespace

#### Scenario: Removing a repository trigger
- **WHEN** a user deprovisions a repository trigger
- **THEN** the backend issues a delete call for the `GitLabTagTrigger` CR, cascading deletion to all synthesized resources

#### Scenario: Non-numeric project ID provided
- **WHEN** a client submits a non-numeric project ID to the trigger provision endpoint
- **THEN** the backend rejects the request with a 400 Bad Request error
