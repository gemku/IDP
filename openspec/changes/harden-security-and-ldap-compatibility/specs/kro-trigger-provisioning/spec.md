## MODIFIED Requirements

### Requirement: KRO GitLabTagTrigger Custom Resource Management
The backend service SHALL use `@kubernetes/client-node` to dynamically create, inspect, and delete KRO `GitLabTagTrigger` custom resources under group `kro.run/v1alpha1` in the team namespace when a repository is linked to the platform, strictly validating numeric project identifiers and sanitizing resource names to adhere to Kubernetes RFC 1123 DNS subdomain requirements.

#### Scenario: Linking a repository to trigger provisioning
- **WHEN** a user selects and enables pipeline triggering for a repository
- **THEN** the backend constructs and applies a `GitLabTagTrigger` custom resource specifying repo URL, project ID, and target namespace

#### Scenario: Removing a repository trigger
- **WHEN** a user deprovisions a repository trigger
- **THEN** the backend issues a delete call for the `GitLabTagTrigger` CR, cascading deletion to all synthesized resources

#### Scenario: Non-numeric project ID provided
- **WHEN** a client submits a non-numeric project ID to the trigger provision endpoint
- **THEN** the backend rejects the request with a 400 Bad Request error

#### Scenario: Resource name normalized to RFC 1123 DNS subdomain standard
- **WHEN** a repository name contains non-alphanumeric characters, underscores, or excess length
- **THEN** the backend sanitizes the metadata name to only lowercase alphanumeric characters and internal hyphens, capped at 63 characters, and starting/ending with an alphanumeric character

### Requirement: KRO ResourceGraphDefinition Expansion
The platform SHALL maintain a KRO `ResourceGraphDefinition` that expands `GitLabTagTrigger` resources into an Argo Events `EventSource` (configured for `tagPushEvent`) and a secure webhook token `Secret` generated with cryptographically strong randomness.

#### Scenario: KRO controller reconciles GitLabTagTrigger
- **WHEN** a `GitLabTagTrigger` instance is created in the cluster
- **THEN** the KRO controller generates an Argo Events `EventSource` service and a random webhook secret token in the target namespace

#### Scenario: KRO reconciles child readiness into parent status
- **WHEN** the generated Argo Events EventSource achieves Ready status
- **THEN** KRO reflects the readiness condition and exposes the webhook receiver URL in the `GitLabTagTrigger` status subresource

#### Scenario: Webhook token generated with cryptographic randomness
- **WHEN** a `GitLabTagTrigger` is created without an explicit secret token
- **THEN** the backend generates the secret token using cryptographically secure random bytes (`node:crypto`) rather than predictable pseudorandom generators
