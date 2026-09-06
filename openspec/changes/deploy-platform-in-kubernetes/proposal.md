## Why

The Internal Developer Platform (IDP) currently runs as a local Node.js process. To run reliably inside Kubernetes alongside KRO, Argo Events, Argo Workflows, and Kpack, the application needs to be containerized with an optimized multi-stage build, provisioned with in-cluster RBAC credentials, backed by persistent SQLite storage, and wired with health monitoring probes and Kubernetes deployment manifests.

## What Changes

- **Containerization**: Add a multi-stage `Dockerfile` and `.dockerignore` targeting Node.js 24 Alpine, compiling TypeScript and running as a non-root user (`node`).
- **Kubernetes Packaging**:
  - Namespace `platform-system` for platform isolation.
  - RBAC `ServiceAccount`, `ClusterRole`, and `ClusterRoleBinding` granting in-cluster privileges for `kro.run` (`gitlabtagtriggers`), `metrics.k8s.io` (`pods`), and pod logging.
  - `ConfigMap` and `Secret` for in-cluster environment variables and credentials.
  - `PersistentVolumeClaim` (1Gi, `ReadWriteOnce`) mounted to `/app/data` to persist SQLite tables across pod restarts.
  - Single-writer `Deployment` (`replicas: 1`, `strategy: Recreate`) with readiness and liveness probes against `/api/health`.
  - Cluster `Service` and `Ingress` manifests.
- **Deployment Automation**: Extend `k8s/scripts/deploy-platform.ps1` to apply the platform application manifests following cluster dependencies.

## Capabilities

### New Capabilities
- `kubernetes-platform-deployment`: Defines container packaging, in-cluster RBAC, persistent volume storage, health probes, and Kubernetes orchestration manifests for running the platform inside Kubernetes.

### Modified Capabilities

## Impact

- `Dockerfile`: Multi-stage build definition.
- `.dockerignore`: Build context exclusions.
- `k8s/platform/`: New Kubernetes manifests (`00-namespace.yaml`, `01-rbac.yaml`, `02-configmap-secret.yaml`, `03-pvc.yaml`, `04-deployment.yaml`, `05-service.yaml`, `06-ingress.yaml`).
- `k8s/scripts/deploy-platform.ps1`: Extended with Step 5 for platform app deployment.
