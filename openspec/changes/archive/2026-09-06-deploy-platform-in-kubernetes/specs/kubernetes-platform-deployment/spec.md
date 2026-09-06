## Purpose

Provides container packaging, in-cluster RBAC permissions, persistent storage, health probes, and Kubernetes orchestration manifests for running the platform application inside Kubernetes.

## ADDED Requirements

### Requirement: Container Image Packaging
The platform SHALL provide a multi-stage `Dockerfile` and `.dockerignore` targeting Node.js 24 Alpine, compiling TypeScript source into `dist/`, pruning development dependencies, exposing port 3000, and running as a non-root `node` user (`UID: 1000`).

#### Scenario: Building multi-stage container image
- **WHEN** a container builder builds the Dockerfile
- **THEN** the builder compiles TypeScript in the build stage, copies output to the runner stage with production dependencies, and produces a minimal production image

#### Scenario: Non-root container security execution
- **WHEN** the container starts in a Kubernetes pod
- **THEN** the process executes under non-root user privileges with access to writeable volume mounts

### Requirement: In-Cluster RBAC Provisioning
The platform SHALL define a `ServiceAccount`, `ClusterRole`, and `ClusterRoleBinding` in Kubernetes granting permissions to manage `kro.run/v1alpha1` `GitLabTagTrigger` custom resources, query `metrics.k8s.io` pod metrics, and tail pod logs via core API.

#### Scenario: Custom resource management authorization
- **WHEN** the in-cluster platform creates, inspects, or deletes a `GitLabTagTrigger` custom resource
- **THEN** Kubernetes RBAC authorizes the request through the bound `platform-api-sa` service account

#### Scenario: Cluster metrics and log tailing authorization
- **WHEN** the platform queries pod resource metrics or streams initContainer logs
- **THEN** the pod's service account credentials satisfy RBAC rules for `metrics.k8s.io` and `pods/log`

### Requirement: Persistent Storage and Workload Deployment
The platform SHALL provide a `PersistentVolumeClaim` (1Gi, `ReadWriteOnce`) mounted at `/app/data` to persist SQLite data, a `Deployment` configured with `replicas: 1` and `strategy: { type: Recreate }`, liveness and readiness probes against `/api/health`, and a cluster `Service` and `Ingress`.

#### Scenario: SQLite data persistence across pod restarts
- **WHEN** the platform pod restarts or is rescheduled
- **THEN** the SQLite database mounted on the persistent volume retains all onboarded teams and configuration

#### Scenario: Liveness and readiness health monitoring
- **WHEN** the Kubernetes kubelet probes the running container
- **THEN** `GET /api/health` returns HTTP 200 with status ok, satisfying readiness and liveness checks

#### Scenario: Cluster service and ingress routing
- **WHEN** external traffic reaches the platform domain
- **THEN** the Ingress and Service route HTTP traffic to container port 3000
