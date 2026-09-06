## Context

Enterprise development teams require an Internal Developer Platform (IDP) that combines repository discovery, self-service pipeline provisioning, automated container builds, and real-time observability while maintaining strict team boundary isolation. See `proposal.md` for business motivation and high-level scope.

This technical design details the architecture spanning the Node.js/Express backend, the React + Tailwind frontend, and Kubernetes operator integrations (KRO, Argo Events, Argo Workflows, Kpack).

## Goals / Non-Goals

**Goals:**
- Node.js backend integrating `@kubernetes/client-node`, `ldapjs`, GitLab REST API v4, and SSE log streaming.
- React + Tailwind CSS single page application featuring Admin Team CRUD, Scoped Repository Picker, Fleet Dashboard, 4-Step Pipeline Visualizer, Resource Gauges, and Dark-mode Terminal.
- KRO `ResourceGraphDefinition` (`GitLabTagTrigger`) generating an Argo Events `EventSource` and webhook Secret.
- Argo Events `Sensor` triggering Argo `Workflow` with Git tag sanitization (stripping `refs/tags/`).
- Argo Workflow synchronization semaphore backed by a ConfigMap with blocking `successCondition`/`failureCondition` monitoring Kpack `Image` readiness.
- Hardened Kpack build pod configurations preventing Exit Code 137 (OOMKilled).

**Non-Goals:**
- Deploying or hosting GitLab CE and LDAP server clusters (assumes pre-existing infrastructure).
- Implementing multi-tenant billing or cloud provider cost attribution.

## Decisions

### Decision 1: Direct LDAP `memberOf` Querying via `ldapjs` in Node.js
- **Choice**: Query the LDAP server directly from the Node.js backend using `ldapjs` upon GitLab OAuth token validation.
- **Rationale**: GitLab CE does not provide native LDAP group synchronization in the free Community Edition. By performing an LDAP bind and searching the user's `memberOf` attributes directly, the backend accurately determines team memberships and checks against the `onboarded_teams` database table without requiring enterprise GitLab licenses.
- **Alternatives Considered**:
  - *Scraping GitLab web UI for user groups*: Fragile, unauthenticated, and unsupported.
  - *Syncing LDAP to GitLab via third-party cron scripts*: Adds moving parts and does not solve real-time web app authorization.

### Decision 2: KRO `ResourceGraphDefinition` for `GitLabTagTrigger`
- **Choice**: Use `@kubernetes/client-node` in the backend to manage `GitLabTagTrigger` custom resources under `kro.run/v1alpha1`.
- **Rationale**: KRO reconciles high-level trigger specifications into lower-level Argo Events `EventSource` and Kubernetes `Secret` resources declaratively. Using CEL expressions inside the RGD eliminates imperative multi-resource creation in the Node.js API, guaranteeing atomicity and cascaded lifecycle deletion.
- **Alternatives Considered**:
  - *Imperative creation of EventSource and Secret via Kubernetes client*: Leaves dangling orphaned resources if deletion fails midway.

### Decision 3: Argo Events Sensor Tag Filtering and Tag Sanitization
- **Choice**: Use an Argo Events `Sensor` that filters GitLab webhook payloads on `body.ref` starting with `refs/tags/` and extracts the tag via regex or parameter template expressions (e.g. stripping `refs/tags/`).
- **Rationale**: Keeps the webhook contract clean and ensures downstream workflows and Kpack image tags receive clean semantic version strings (e.g. `v1.0.0` instead of `refs/tags/v1.0.0`).
- **Alternatives Considered**:
  - *Sanitizing inside the workflow bash step*: Can fail if the image tag is consumed directly as a workflow parameter by Kubernetes CRD step templates.

### Decision 4: Concurrency Synchronization and Non-Premature Workflow Completion
- **Choice**: Configure Argo Workflow `synchronization.semaphore` pointing to a ConfigMap key (`max-builds: "5"`) and define `successCondition` (`status.conditions.@filter(type=="Ready").0.status == True`) and `failureCondition` on the Kpack step.
- **Rationale**: Without explicit conditions, applying a Kpack `Image` resource succeeds immediately upon API submission, causing the Argo Workflow to terminate and release the semaphore while the build pod is still running. Specifying the condition keeps the step active until the Kpack build finishes, strictly respecting concurrency limits.
- **Alternatives Considered**:
  - *Custom polling container script*: Consumes extra pod resources and requires embedding `kubectl` with cluster-wide RBAC inside tenant pods.

### Decision 5: Kpack Build Memory Hardening Against OOMKilled (Exit Code 137)
- **Choice**: Configure Kpack `ClusterBuilder` and `Image` definitions with explicit pod memory limits (min 4Gi), `BP_JVM_VERSION`, and Node environment flags (`NODE_OPTIONS="--max-old-space-size=3072"`).
- **Rationale**: Cloud Native Buildpacks compile code in memory; default JVM and V8 heap limits frequently cause container processes to breach container cgroup limits, triggering Exit Code 137. Explicit heap sizing guarantees garbage collection occurs before cgroup eviction.

### Decision 6: Server-Sent Events (SSE) for Multi-InitContainer Log Streaming
- **Choice**: Implement an SSE endpoint (`/api/repos/:repoName/logs`) in Node.js that streams logs from Kpack build initContainers (`detect`, `build`, `export`) sequentially.
- **Rationale**: Kpack executes its build phases using sequential Kubernetes initContainers. WebSockets add unnecessary full-duplex protocol overhead for unidirectional log streaming. SSE handles browser reconnection automatically and streams standard chunked text natively into the dark-mode terminal.

## Risks / Trade-offs

- **[Risk] GitLab OAuth Token Expiration**: User sessions may outlive the short-lived GitLab OAuth access token.
  - *Mitigation*: Implement session-backed refresh token exchange middleware in Node.js to transparently refresh access tokens.
- **[Risk] Metrics Server Latency or Flakiness**: High load on the cluster API server can cause `/apis/metrics.k8s.io/v1beta1` timeouts.
  - *Mitigation*: Cache metric queries for 5 seconds in backend memory and gracefully fall back to displaying nominal limits when live metrics are temporarily unavailable.
- **[Risk] Multiple Concurrent Tag Pushes for the Same Repo**: Simultaneous tag pushes could cause race conditions on the single Kpack `Image` resource.
  - *Mitigation*: Use unique dynamic Image or Build custom resource names per tag build, or rely on Argo's semaphore queue to serialize builds per repository.

## Migration / Rollout Plan

1. **Database Initialization**: Run SQLite/PostgreSQL migrations to create the `onboarded_teams` table and seed platform admin credentials.
2. **Cluster Prerequisites**: Verify KRO (`kro.run`), Argo Events, Argo Workflows, and Kpack CRDs on Kubernetes.
3. **Core Manifests Scaffolding**: Deploy KRO `ResourceGraphDefinition`, Argo Events EventBus, semaphore ConfigMap, and Kpack `ClusterBuilder`.
4. **Backend Implementation**: Build authentication middleware (GitLab OAuth + `ldapjs`), repository picker routes, KRO client service, metrics aggregator, and SSE log streaming.
5. **Frontend Implementation**: Build React + Tailwind UI components (Admin Teams, Repo Picker, Fleet Dashboard, 4-Step Pipeline Status, Gauges, Dark Terminal).
6. **End-to-End Verification**: Validate complete workflow from admin onboarding, repository linking, tag push event simulation, to live log streaming and container image verification.

