## Context

Currently, the platform packages both the React SPA and the Node.js Express backend into a single container image. In Kubernetes, a single `platform-api` pod runs Express, which hosts the API endpoints and serves static frontend assets via `express.static`.

See `proposal.md` and delta specs for motivation and requirements.

## Goals / Non-Goals

**Goals:**
- Provide separate, dedicated Dockerfiles for the backend (`Dockerfile.backend` / `Dockerfile`) and the frontend (`Dockerfile.frontend`).
- Produce a lightweight frontend container image using `nginx:alpine` with SPA client-side history routing fallback (`try_files $uri $uri/ /index.html`).
- Decouple Kubernetes manifests into distinct backend and frontend deployments and services.
- Configure Ingress to route `/api` traffic to the backend service and all other UI traffic `/` to the frontend service under the same host (`platform.example.com`).
- Enable independent horizontal scaling for the stateless frontend deployment (`replicas >= 2`).
- Maintain backward-compatibility for local development (`npm run dev` with Vite proxy and standalone unified `npm start`).

**Non-Goals:**
- Splitting the repository into separate git repos (monorepo structure remains intact).
- Rewriting the React application or altering API route contracts.

## Decisions

### Decision 1: Frontend Container Runtime (NGINX Alpine vs Node/Express)
- **Choice**: Multi-stage build with `node:24-alpine` building Vite client assets, followed by `nginx:alpine` serving static assets on port 80 with a custom `nginx.conf`.
- **Rationale**: NGINX is purpose-built for static file serving, has a minimal memory footprint (~10-20MB vs ~150-250MB for Node.js), handles high-concurrency static requests with zero event-loop blocking, and supports optimized gzip/caching headers out-of-the-box.
- **Alternatives Considered**:
  - Running a second Node.js `serve` container: Higher memory footprint and unnecessary Node runtime overhead for static files.

### Decision 2: Kubernetes Manifest Separation
- **Choice**:
  - `k8s/platform/04-backend-deployment.yaml`: Workload `platform-backend`, image `platform-backend:latest`, mounts `/app/data` PVC (for SQLite) or injects PostgreSQL envs, probes `/api/health/ready` and `/api/health/live`.
  - `k8s/platform/04-frontend-deployment.yaml`: Workload `platform-frontend`, image `platform-frontend:latest`, replicas: 2, port 80, readiness/liveness on `/`.
  - `k8s/platform/05-service.yaml`: Declares `platform-backend-svc` (port 3000) and `platform-frontend-svc` (port 80).
  - `k8s/platform/06-ingress.yaml`: Defines `path: /api` (Prefix) -> `platform-backend-svc:3000` and `path: /` (Prefix) -> `platform-frontend-svc:80`.
- **Rationale**: Keeps both services under the same external hostname (`platform.example.com`), completely avoiding CORS headers, third-party cookie restrictions, and complicated domain management.

### Decision 3: Local Dev and Standalone Fallback
- **Choice**: Keep `express.static` conditional fallback in `src/backend/app.ts` if `dist/client` exists, and keep Vite's proxy in `vite.config.mts`.
- **Rationale**: Ensures developers running `npm start` or `npm run dev` locally have zero friction, while production deployments in Kubernetes take full advantage of decoupled containers.

## Risks / Trade-offs

- **[Risk] Ingress path precedence collision**: An ingress rule for `/` could intercept `/api` if path rules are misconfigured.
  - **Mitigation**: Place `/api` path before `/` in the Ingress rule list and use `pathType: Prefix`.
- **[Risk] Client-side routing 404s**: Navigating directly to SPA client routes (e.g. `/repos`) in NGINX returning 404.
  - **Mitigation**: Configure NGINX with `try_files $uri $uri/ /index.html;` to delegate routing to React Router / SPA state.
- **[Risk] Docker build context and script complexity**:
  - **Mitigation**: Provide standardized npm scripts: `docker:build:backend`, `docker:build:frontend`, and `docker:build`.

## Migration Plan

1. Create `Dockerfile.backend` (and update root `Dockerfile` to default to backend).
2. Create `Dockerfile.frontend` and `nginx.conf` for the frontend SPA.
3. Update `package.json` with Docker build commands.
4. Split deployment manifests into `04-backend-deployment.yaml` and `04-frontend-deployment.yaml`.
5. Update `05-service.yaml` and `06-ingress.yaml`.
6. Update deployment automation script `deploy-platform.ps1`.
7. Update test suite in `tests/kubernetesDeployment.test.ts` to assert both container images and deployment manifests.

