## Context

See proposal.md - Why.
The platform requires Node.js 24+ for native `node:sqlite`. When running inside Kubernetes:
- The app must discover in-cluster Kubernetes configuration via `KUBERNETES_SERVICE_HOST` and authenticate using a dedicated `ServiceAccount`.
- SQLite requires single-writer access, requiring `replicas: 1` and `strategy: Recreate` with a PersistentVolumeClaim.
- Pods must pass liveness and readiness checks against `/api/health`.

## Goals / Non-Goals

**Goals:**
- Provide a lean, multi-stage `Dockerfile` and `.dockerignore` based on `node:24-alpine`.
- Define complete Kubernetes manifests in `k8s/platform/`: Namespace, RBAC, ConfigMap, Secret, PersistentVolumeClaim, Deployment, Service, and Ingress.
- Ensure SQLite storage persists in `/app/data` across pod restarts.
- Extend `k8s/scripts/deploy-platform.ps1` to deploy platform manifests after dependencies.

**Non-Goals:**
- Migrating the database engine from SQLite to an external database (PostgreSQL/MySQL).
- Multi-replica horizontal pod autoscaling (not supported by SQLite).

## Decisions

### 1. Multi-Stage Dockerfile with Node 24 Alpine
- **Choice**: Multi-stage build (`builder` compiles TypeScript, `runner` runs `dist/backend/server.js`).
- **Rationale**: Keeps production container image small (< 180MB) without shipping `devDependencies` or source files.
- **Alternatives Considered**: Single-stage build — rejected due to image bloat.

### 2. SQLite Persistence via PersistentVolumeClaim with Recreate Strategy
- **Choice**: `PersistentVolumeClaim` mounted at `/app/data`, `replicas: 1`, and `strategy: { type: Recreate }`.
- **Rationale**: Prevents two pods from mounting the same volume simultaneously during rolling updates, avoiding SQLite `database is locked` errors.
- **Alternatives Considered**: `RollingUpdate` — rejected because SQLite does not support concurrent multi-instance writers.

### 3. Dedicated ServiceAccount & RBAC
- **Choice**: Create `platform-api-sa` bound to `platform-api-role` with least-privilege permissions for `kro.run`, `metrics.k8s.io`, and `pods/log`.
- **Rationale**: Prevents granting cluster-admin privileges while enabling `KroService`, `MetricsService`, and `LogStreamingService` to work in-cluster.

## Risks / Trade-offs

- [Single Replica Downtime during Redeployment] → `Recreate` strategy causes brief downtime (10-20 seconds) while the old pod terminates and the new pod claims the volume. Acceptable for internal developer platform workloads.
