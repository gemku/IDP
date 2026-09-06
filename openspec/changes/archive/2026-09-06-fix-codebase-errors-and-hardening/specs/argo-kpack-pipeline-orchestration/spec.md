## MODIFIED Requirements

### Requirement: Tag Event Sensor and Workflow Submission
The platform SHALL configure an Argo Events `Sensor` that triggers an Argo `Workflow` upon receipt of a GitLab `tagPushEvent`, sanitizing the git tag string by stripping any leading `refs/tags/` prefix before passing it to the workflow parameters, and filtering out tag deletion events.

#### Scenario: Sensor receives a valid tag push event
- **WHEN** GitLab emits a tag push webhook with ref `refs/tags/v1.2.3`
- **THEN** the Sensor extracts `v1.2.3`, injects it as the `imageTag` workflow parameter, and submits the Argo Workflow

#### Scenario: Branch push event ignored
- **WHEN** an event without a tag ref is received
- **THEN** the Sensor filter evaluates to false and drops the event without instantiating an Argo Workflow

#### Scenario: Tag deletion event ignored
- **WHEN** GitLab emits a tag push webhook where `after` is all zeros (`0000000000000000000000000000000000000000`) representing a deleted tag
- **THEN** the Sensor drops the event and does not trigger an Argo Workflow
