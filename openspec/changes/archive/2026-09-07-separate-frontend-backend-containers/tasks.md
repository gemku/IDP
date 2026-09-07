## 1. Container Image Packaging Separation

- [x] 1.1 Create `Dockerfile.backend` (and update root `Dockerfile`) dedicated to building and running the backend API with Node.js 24 Alpine, and verify build syntax
- [x] 1.2 Create `Dockerfile.frontend` and `docker/nginx.conf` for building the Vite React SPA and serving via NGINX Alpine on port 80 with SPA history routing fallback, and verify configuration
- [x] 1.3 Update `package.json` with scripts `docker:build:backend`, `docker:build:frontend`, and `docker:build` to build both container images

## 2. Kubernetes Manifests Decoupling

- [x] 2.1 Create `k8s/platform/04-backend-deployment.yaml` with PVC volume mounting, probes (`/api/health/ready`, `/api/health/live`), and non-root security context
- [x] 2.2 Create `k8s/platform/04-frontend-deployment.yaml` with stateless horizontal scaling (`replicas: 2`) and NGINX port 80 exposure
- [x] 2.3 Update `k8s/platform/05-service.yaml` to define distinct `platform-backend-svc` (port 3000) and `platform-frontend-svc` (port 80)
- [x] 2.4 Update `k8s/platform/06-ingress.yaml` to route `/api` to `platform-backend-svc` and `/` to `platform-frontend-svc`
- [x] 2.5 Update `k8s/scripts/deploy-platform.ps1` to apply both frontend and backend deployment manifests

## 3. Testing & Documentation

- [x] 3.1 Update `tests/kubernetesDeployment.test.ts` to assert `Dockerfile.backend`, `Dockerfile.frontend`, `04-backend-deployment.yaml`, `04-frontend-deployment.yaml`, dual services, and Ingress routing rules
- [x] 3.2 Update `README.md` to document the separate container images, Docker build commands, and decoupled Kubernetes architecture
- [x] 3.3 Run full test suite with `npm test` and verify zero regressions across all test suites

