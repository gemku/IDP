## Why

Currently, the frontend React SPA and backend Node.js API are built and packaged into a single monolithic container image, with Express statically serving the client SPA bundle in production. This couples frontend deployments, scaling, and caching to backend state and database lifecycle, prevents independent horizontal scaling of stateless static assets, and complicates CDN or dedicated reverse proxy caching. Decoupling the frontend and backend into separate container images and Kubernetes workloads allows independent release cadences, optimized runtime footprints (NGINX Alpine for the SPA and Node.js 24 Alpine for the API), and granular resource allocation in Kubernetes.

## What Changes

- **Separate Container Packaging**:
  - `Dockerfile.backend` (or default `Dockerfile`): Targets Node.js 24 Alpine, compiles backend TypeScript, installs production dependencies, exposes port 3000, and runs `dist/backend/server.js`.
  - `Dockerfile.frontend`: Multi-stage build that compiles the Vite React SPA (`npm run build:client`) and copies the output to a lightweight unprivileged `nginx:alpine` runner on port 80 (or 8080) with SPA client-side routing fallback (`try_files $uri $uri/ /index.html`).
- **Decoupled Kubernetes Workloads**:
  - `k8s/platform/04-backend-deployment.yaml`: Runs the backend API pod with PVC mount (for SQLite) or PostgreSQL configuration, with readiness and liveness probes on `/api/health/ready` and `/api/health/live`.
  - `k8s/platform/04-frontend-deployment.yaml`: Runs the stateless frontend web pod, scalable horizontally across multiple replicas.
  - `k8s/platform/05-service.yaml`: Defines distinct `platform-backend-svc` (port 3000) and `platform-frontend-svc` (port 80).
  - `k8s/platform/06-ingress.yaml`: Configures path-based routing directing `/api` and `/api/*` to `platform-backend-svc` and `/` to `platform-frontend-svc`.
- **Packaging & Build Scripts**:
  - Adds dedicated Docker build scripts in `package.json` (`docker:build:backend`, `docker:build:frontend`, `docker:build`).
  - Updates Kubernetes deployment automation script `deploy-platform.ps1` to deploy both frontend and backend workloads.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- `kubernetes-platform-deployment`: Updates container image packaging and workload deployment requirements to specify distinct frontend and backend container images, separate Kubernetes Deployments/Services, and unified Ingress routing.

## Impact

- **Container Images**: Two images produced (`platform-backend:latest` and `platform-frontend:latest`).
- **Kubernetes Manifests**: Replaces monolithic deployment with dedicated frontend and backend deployments, services, and updated ingress paths.
- **Frontend Serving**: Production frontend served via NGINX with client-side history API fallback, while local dev mode (`npm run dev` with Vite proxy) and Express unified mode remain backward-compatible.
- **Automated Tests**: Updates [tests/kubernetesDeployment.test.ts](file:///c:/Users/Fitsum.Taye/Documents/learnings/AI/openspec-demo/tests/kubernetesDeployment.test.ts) to validate both Dockerfiles and separated Kubernetes deployment manifests.

