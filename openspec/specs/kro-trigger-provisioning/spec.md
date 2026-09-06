# kro-trigger-provisioning Specification

## Purpose

Automates Kubernetes custom resource provisioning via KRO and coordinates webhook registration with GitLab CE for tag push events.

## Requirements

### Requirement: KRO GitLabTagTrigger Custom Resource Management
The backend service SHALL use `@kubernetes/client-node` to dynamically create, inspect, and delete KRO `GitLabTagTrigger` custom resources under group `kro.run/v1alpha1` in the team namespace when a repository is linked to the platform.

#### Scenario: Linking a repository to trigger provisioning
- **WHEN** a user selects and enables pipeline triggering for a repository
- **THEN** the backend constructs and applies a `GitLabTagTrigger` custom resource specifying repo URL, project ID, and target namespace

#### Scenario: Removing a repository trigger
- **WHEN** a user deprovisions a repository trigger
- **THEN** the backend issues a delete call for the `GitLabTagTrigger` CR, cascading deletion to all synthesized resources

### Requirement: KRO ResourceGraphDefinition Expansion
The platform SHALL maintain a KRO `ResourceGraphDefinition` that expands `GitLabTagTrigger` resources into an Argo Events `EventSource` (configured for `tagPushEvent`) and a secure webhook token `Secret`.

#### Scenario: KRO controller reconciles GitLabTagTrigger
- **WHEN** a `GitLabTagTrigger` instance is created in the cluster
- **THEN** the KRO controller generates an Argo Events `EventSource` service and a random webhook secret token in the target namespace

#### Scenario: KRO reconciles child readiness into parent status
- **WHEN** the generated Argo Events EventSource achieves Ready status
- **THEN** KRO reflects the readiness condition and exposes the webhook receiver URL in the `GitLabTagTrigger` status subresource

### Requirement: Automated GitLab Project Webhook Registration
The backend service SHALL call the GitLab REST API `POST /api/v4/projects/:id/hooks` to register a project webhook pointing to the Argo Events gateway with `tag_push_events: true` and the shared secret token retrieved from the generated Secret.

#### Scenario: Automated webhook creation upon trigger provisioning
- **WHEN** the `GitLabTagTrigger` custom resource successfully generates the webhook token Secret
- **THEN** the backend registers the webhook in GitLab CE with `tag_push_events: true`, `push_events: false`, and the shared secret token

#### Scenario: Duplicate webhook detection
- **WHEN** a webhook pointing to the platform gateway already exists in the GitLab project
- **THEN** the backend updates the existing webhook secret and URL rather than creating a duplicate entry
