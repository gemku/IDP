# argo-kpack-pipeline-orchestration Specification

## Purpose

Orchestrates tag-driven build pipelines with concurrency semaphores, non-blocking workflow progression, and OOM-hardened Kpack image builds.

## Requirements

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

### Requirement: Concurrency Limiting via Semaphore
The platform SHALL configure an Argo Workflow `synchronization.semaphore` backed by a Kubernetes `ConfigMap` to enforce a strict concurrency limit on simultaneous container build executions across the cluster.

#### Scenario: Build within concurrency limit
- **WHEN** an Argo Workflow begins execution and available semaphore slots exist in the ConfigMap
- **THEN** the workflow acquires a semaphore slot and immediately proceeds to execute the build step

#### Scenario: Concurrency limit reached
- **WHEN** all semaphore slots are acquired by running builds
- **THEN** newly triggered workflows enter a Pending synchronization state until a running build completes and releases its slot

### Requirement: Non-Premature Workflow Completion
The workflow step applying the Kpack `Image` resource (`kpack.io/v1alpha2`) SHALL declare explicit `successCondition` (`status.conditions.@filter(type=="Ready").0.status == True`) and `failureCondition` (`status.conditions.@filter(type=="Ready").0.status == False`) so the workflow step remains running until the Kpack build completes.

#### Scenario: Successful Kpack build completion
- **WHEN** the Kpack `Image` reconciles and its Ready condition transitions to True
- **THEN** the Argo Workflow step evaluates the successCondition, marks the step as Succeeded, and releases the semaphore slot

#### Scenario: Kpack build failure
- **WHEN** the Kpack `Image` Ready condition transitions to False due to a buildpack or compile error
- **THEN** the Argo Workflow step evaluates the failureCondition, terminates the workflow with Failed status, and releases the semaphore slot

### Requirement: Kpack Memory and Environment Hardening
Kpack build environments SHALL be configured with explicit container memory limits, runtime environment variables (`BP_JVM_VERSION`, `NODE_OPTIONS=--max-old-space-size=...`), and Git credentials to prevent build termination with Exit Code 137 (OOMKilled).

#### Scenario: Large build execution without OOM
- **WHEN** a high-memory application build executes under Kpack
- **THEN** the build pod utilizes allocated memory headroom within configured container limits and completes without being killed by the Linux kernel OOM killer
