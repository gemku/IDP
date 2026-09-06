## MODIFIED Requirements

### Requirement: KRO ResourceGraphDefinition Expansion
The platform SHALL maintain a KRO `ResourceGraphDefinition` that expands `GitLabTagTrigger` resources into an Argo Events `EventSource` (configured for `tagPushEvent`) and a secure webhook token `Secret` generated with cryptographically strong randomness, adhering to cluster sensor dependency naming conventions.

#### Scenario: KRO controller reconciles GitLabTagTrigger
- **WHEN** a `GitLabTagTrigger` instance is created in the cluster
- **THEN** the KRO controller generates an Argo Events `EventSource` service and a random webhook secret token in the target namespace

#### Scenario: KRO reconciles child readiness into parent status
- **WHEN** the generated Argo Events EventSource achieves Ready status
- **THEN** KRO reflects the readiness condition and exposes the webhook receiver URL in the `GitLabTagTrigger` status subresource

#### Scenario: Webhook token generated with cryptographic randomness
- **WHEN** a `GitLabTagTrigger` is created without an explicit secret token
- **THEN** the backend generates the secret token using cryptographically secure random bytes (`node:crypto`) rather than predictable pseudorandom generators

#### Scenario: Argo sensor dependency alignment
- **WHEN** an Argo Events Sensor consumes tag push events
- **THEN** its `eventSourceName` dependency matches the provisioned EventSource naming convention so tag push events trigger workflows reliably
