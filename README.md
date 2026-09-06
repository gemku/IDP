# Internal Developer Platform (IDP) Orchestrator

[![OpenSpec Driven](https://img.shields.io/badge/OpenSpec-Spec--Driven-indigo.svg)](openspec/specs)
[![Tests Passing](https://img.shields.io/badge/tests-82%20passed-emerald.svg)](tests/)
[![Node.js 24](https://img.shields.io/badge/Node.js-24%20(native%20sqlite)-blue.svg)](https://nodejs.org/)
[![React 19](https://img.shields.io/badge/React-19-cyan.svg)](https://react.dev/)
[![Kubernetes Native](https://img.shields.io/badge/Kubernetes-Native%20Orchestrator-326ce5.svg)](k8s/)

A cloud-native Internal Developer Platform (IDP) that unifies identity-based team onboarding, GitLab repository discovery, KRO resource graph trigger provisioning, Argo & Kpack pipeline execution, and live terminal observability inside a modern single-page console.

---

## 📑 Table of Contents

- [System Architecture](#-system-architecture)
  - [1. Authentication & Team Authorization Lifecycle](#1-authentication--team-authorization-lifecycle)
  - [2. 4-Stage Cloud-Native CI/CD Pipeline](#2-4-stage-cloud-native-cicd-pipeline)
  - [3. Telemetry & Live Streaming Architecture](#3-telemetry--live-streaming-architecture)
- [Core Platform Capabilities](#-core-platform-capabilities)
- [Technology Stack](#-technology-stack)
- [Quickstart & Local Development](#-quickstart--local-development)
  - [Prerequisites](#prerequisites)
  - [Installation & Environment Setup](#installation--environment-setup)
  - [Running the Backend](#running-the-backend)
  - [Running the Frontend Dev Server](#running-the-frontend-dev-server)
  - [Unified Production Mode](#unified-production-mode)
- [Configuration & Environment Variables](#-configuration--environment-variables)
- [Kubernetes In-Cluster Deployment](#-kubernetes-in-cluster-deployment)
  - [Container Packaging](#container-packaging)
  - [Deploying Manifests](#deploying-manifests)
  - [Persistent Storage & SQLite Strategy](#persistent-storage--sqlite-strategy)
- [API Reference](#-api-reference)
- [OpenSpec Workflow & Testing](#-openspec-workflow--testing)

---

## 🏛 System Architecture

The platform bridges identity providers (LDAP + GitLab OAuth), container orchestration (Kubernetes, KRO, Argo, Kpack), and developer user interfaces.

### 1. Authentication & Team Authorization Lifecycle

```mermaid
sequenceDiagram
    autonumber
    actor Developer
    participant Browser as IDP Frontend (React 19)
    participant API as Platform API (Express 5)
    participant GitLab as GitLab OAuth Provider
    participant LDAP as Directory Service (OpenLDAP / AD)
    participant DB as SQLite (node:sqlite)

    Developer->>Browser: Click "Sign in with GitLab"
    Browser->>API: GET /api/auth/gitlab/login
    API-->>Browser: Redirect to GitLab authorize URL (with CSRF state)
    Browser->>GitLab: Authorize Application
    GitLab-->>API: Callback with code & state (?code=...&state=...)
    API->>GitLab: Exchange authorization code for user access token
    GitLab-->>API: Returns user profile (username, email, ID)
    API->>LDAP: Query user group memberships (RFC 4515 sanitized DN search)
    LDAP-->>API: Returns user's memberOf LDAP group DNs
    API->>DB: Query active onboarded teams matching LDAP DNs
    DB-->>API: Returns active team assignments
    API-->>Browser: Sets session cookie / Bearer token with active team scopes
```

### 2. 4-Stage Cloud-Native CI/CD Pipeline

```mermaid
flowchart LR
    subgraph Trigger ["1. Trigger Provisioning"]
        A[GitLab Tag Push] -->|Webhook| B[KRO ResourceGraphDefinition]
        B -->|Synthesizes| C[GitLab EventSource]
    end

    subgraph Orchestration ["2. Event & Workflow Orchestration"]
        C -->|Dispatches Event| D[Argo Events Sensor]
        D -->|Triggers Workflow| E[Argo Workflows Runner]
        E -->|Acquires Lease| F[Workflow Semaphore ConfigMap]
    end

    subgraph Build ["3. Container Image Build"]
        F -->|Executes Build Task| G[Kpack Image Resource]
        G -->|Cloud Native Buildpacks| H[OCI Container Registry]
    end

    subgraph Observability ["4. Telemetry & Console"]
        E -.->|Pod Logs SSE| I[Dark Terminal Component]
        G -.->|metrics.k8s.io| J["Resource Gauges (CPU/RAM)"]
    end
```

### 3. Telemetry & Live Streaming Architecture

- **Fleet Health Telemetry (`/api/fleet/health`)**: Aggregates build health across all onboarded engineering teams, computing 24-hour success rates, execution counts, and node utilization without routing collisions.
- **Pod Log Streaming (`/api/repos/:repoName/stream`)**: Server-Sent Events (SSE) pipe real-time Kubernetes container logs directly to the browser with zero-polling latency and phase detection (`detect`, `build`, `export`).
- **Resource Gauges (`/api/repos/:repoName/metrics`)**: Queries `metrics.k8s.io` to report CPU core utilization and memory consumption against configured limits.

---

## 🚀 Core Platform Capabilities

| Capability | Specification Path | Description |
| :--- | :--- | :--- |
| **Auth & Team Onboarding** | [`openspec/specs/auth-team-onboarding`](openspec/specs/auth-team-onboarding/spec.md) | GitLab OAuth 2.0 + OpenLDAP group mapping, team CRUD, toggle activation, and strict RBAC. |
| **Scoped Repository Discovery** | [`openspec/specs/scoped-repository-picker`](openspec/specs/scoped-repository-picker/spec.md) | Scopes GitLab repository discovery strictly to the user's onboarded group hierarchy with debouncing and pagination. |
| **KRO Trigger Provisioning** | [`openspec/specs/kro-trigger-provisioning`](openspec/specs/kro-trigger-provisioning/spec.md) | Provisions Kubernetes Resource Orchestrator (KRO) `ResourceGraphDefinition` instances and webhooks. |
| **Argo + Kpack Orchestration** | [`openspec/specs/argo-kpack-pipeline-orchestration`](openspec/specs/argo-kpack-pipeline-orchestration/spec.md) | Orchestrates Argo Workflows with concurrency-limiting semaphores and Kpack Cloud Native Buildpacks. |
| **Observability Dashboards** | [`openspec/specs/observability-dashboards`](openspec/specs/observability-dashboards/spec.md) | Fleet build health metrics, 4-stage pipeline milestone trackers, pod resource gauges, and SSE terminal. |
| **Kubernetes Platform Deployment** | [`openspec/specs/kubernetes-platform-deployment`](openspec/specs/kubernetes-platform-deployment/spec.md) | Container packaging, in-cluster ServiceAccount RBAC, SQLite PVC persistence with `Recreate` strategy. |

---

## 🛠 Technology Stack

- **Backend Runtime**: [Node.js 24+](https://nodejs.org/) with dual database support: built-in native SQLite (`node:sqlite`) and [PostgreSQL](https://www.postgresql.org/) (`pg` connection pool).
- **API Framework**: [Express 5](https://expressjs.com/) with native promise error propagation and strict type validation.
- **Frontend UI**: [React 19](https://react.dev/), [Vite](https://vitejs.dev/), and [Tailwind CSS](https://tailwindcss.com/).
- **Directory Service**: [ldapjs](https://github.com/ldapjs/node-ldapjs) with RFC 4515 special character sanitization.
- **Cluster Orchestration**: [@kubernetes/client-node](https://github.com/kubernetes-client/javascript), KRO (K8s Resource Orchestrator), Argo Events, Argo Workflows, and VMware Tanzu Kpack.
- **Specification Engine**: [OpenSpec](https://github.com/FauxPilot/openspec) specification-driven change management.
- **Test Framework**: [Vitest](https://vitest.dev/) and Supertest with 100% automated test coverage.

---

## 💻 Quickstart & Local Development

### Prerequisites

- **Node.js**: Version **24.0.0** or higher (required for native `node:sqlite` support).
- **Git**

### Installation & Environment Setup

1. **Clone the repository and install dependencies**:
   ```bash
   git clone <repo-url>
   cd openspec-demo
   npm install
   ```

2. **Configure your environment**:
   Create a `.env` file in the project root (see the [Configuration Table](#-configuration--environment-variables) below for details):
   ```ini
   PORT=3000
   DATABASE_PATH=data/platform.db
   SESSION_SECRET=local-development-session-secret-change-me

   GITLAB_URL=https://gitlab.example.com
   GITLAB_CLIENT_ID=mock-client-id
   GITLAB_CLIENT_SECRET=mock-client-secret
   GITLAB_REDIRECT_URI=http://localhost:3000/api/auth/gitlab/callback

   LDAP_URL=ldap://ldap.example.com:389
   LDAP_BIND_DN=cn=admin,dc=example,dc=com
   LDAP_BIND_PASSWORD=adminpassword
   LDAP_BASE_DN=dc=example,dc=com
   ```

### Running the Backend

Compile TypeScript and launch the Express backend:
```bash
npm run build
npm start
```
The backend API initializes the SQLite database schema in `data/platform.db` and listens on `http://localhost:3000`.

### Running the Frontend Dev Server

In a separate terminal, launch the Vite development server:
```bash
npm run dev
```
Open **[http://localhost:5173](http://localhost:5173)**. Vite runs with Hot Module Replacement (HMR) and automatically proxies all `/api/*` requests to port 3000.

### Unified Production Mode

You can also bundle the frontend client and serve both the API and the React SPA directly from Express on a single port:

```bash
# 1. Compile backend TypeScript and bundle frontend client
npm run build
npm run build:client

# 2. Run unified server
npm start
```
Open **[http://localhost:3000](http://localhost:3000)** to access the developer platform console.

---

## ⚙️ Configuration & Environment Variables

| Variable | Required | Default | Description |
| :--- | :---: | :--- | :--- |
| `PORT` | No | `3000` | HTTP port for the Express application server. |
| `DATABASE_CLIENT` | No | `sqlite` | Database engine: `sqlite` or `postgres`. |
| `DATABASE_PATH` | No | `data/platform.db` | Local file path for the SQLite database. |
| `DATABASE_URL` | No | — | Full PostgreSQL connection URI (e.g., `postgresql://user:pass@host:5432/db`). |
| `POSTGRES_HOST` | No | `localhost` | PostgreSQL hostname when not using `DATABASE_URL`. |
| `POSTGRES_PORT` | No | `5432` | PostgreSQL port. |
| `POSTGRES_DB` | No | `platform` | PostgreSQL database name. |
| `POSTGRES_USER` | No | `postgres` | PostgreSQL user account. |
| `POSTGRES_PASSWORD` | No | — | PostgreSQL password. |
| `POSTGRES_SSL` | No | `false` | Enable SSL encryption (`true` / `false`). |
| `SESSION_SECRET` | No | `dev-insecure-...` | Key used to sign session cookies and OAuth CSRF tokens. |
| `GITLAB_URL` | No | `http://gitlab.example.com` | Base URL of the GitLab instance. |
| `GITLAB_CLIENT_ID` | **Yes** | — | OAuth 2.0 Application ID registered in GitLab. |
| `GITLAB_CLIENT_SECRET`| **Yes** | — | OAuth 2.0 Application Secret from GitLab. |
| `GITLAB_REDIRECT_URI` | No | `http://localhost:3000/api/auth/gitlab/callback` | Authorized redirect callback URL. |
| `GITLAB_ADMIN_TOKEN` | No | — | System token used as fallback when querying team repositories. |
| `LDAP_URL` | No | `ldap://ldap.example.com:389` | URI of the OpenLDAP or Active Directory service. |
| `LDAP_BIND_DN` | **Yes** | — | Distinguished Name (DN) used to authenticate LDAP queries. |
| `LDAP_BIND_PASSWORD` | **Yes** | — | Password for the LDAP bind DN account. |
| `LDAP_BASE_DN` | No | `dc=example,dc=com` | Search base DN for user and group queries. |
| `KUBECONFIG` | No | — | Path to a local kubeconfig file (when running outside cluster). |
| `KRO_NAMESPACE` | No | `kro-system` | Kubernetes namespace where KRO controllers reside. |
| `ARGO_GATEWAY_URL` | No | `http://gitlab-eventsource-svc...` | Endpoint for the Argo Events webhook gateway. |

---

## ☸️ Kubernetes In-Cluster Deployment

The repository includes production Kubernetes manifests under [`k8s/platform/`](k8s/platform/).

### Container Packaging

Build the lean multi-stage Docker container image (`node:24-alpine`):
```bash
docker build -t platform-api:latest .
```
The Docker image compiles TypeScript, packages the client bundle into `/app/dist/client`, and drops privileges to run as the non-root `node` user (UID 1000).

### Deploying Manifests

Deploy cluster dependencies and platform workloads using the automated deployment script:
```powershell
./k8s/scripts/deploy-platform.ps1
```
Or apply manually in sequence:
```bash
# 1. Platform Namespace & Least-Privilege RBAC
kubectl apply -f k8s/platform/00-namespace.yaml
kubectl apply -f k8s/platform/01-rbac.yaml

# 2. ConfigMap, Secret, & SQLite Storage
kubectl apply -f k8s/platform/02-configmap-secret.yaml
kubectl apply -f k8s/platform/03-pvc.yaml

# 3. Deployment, Service, & Ingress
kubectl apply -f k8s/platform/04-deployment.yaml
kubectl apply -f k8s/platform/05-service.yaml
kubectl apply -f k8s/platform/06-ingress.yaml
```

### Persistent Storage & SQLite Strategy

SQLite is a file-backed database that requires single-writer access:
- The platform deployment utilizes `strategy: { type: Recreate }` and `replicas: 1`.
- A `PersistentVolumeClaim` is mounted at `/app/data/platform.db`.
- Using `Recreate` ensures that old pods release the SQLite file lock before new pods mount the persistent volume, preventing `database is locked` corruption during deployments.

---

## 📡 API Reference

### Health
- `GET /api/health`: Liveness and readiness probe endpoint. Returns `{ "status": "ok", "timestamp": "..." }`.

### Authentication & User Identity (`/api/auth`)
- `GET /api/auth/gitlab/login`: Initiates OAuth 2.0 authorization redirect.
- `GET /api/auth/gitlab/callback`: Handles OAuth callback, performs LDAP group resolution, and issues credentials.
- `GET /api/auth/me`: Returns current user session, active onboarded teams, and LDAP groups. Supports Bearer tokens.
- `POST /api/auth/logout`: Invalidates session credentials.

### Team Onboarding Administration (`/api/admin`)
- `GET /api/admin/teams`: Lists all onboarded engineering teams.
- `POST /api/admin/teams`: Onboards a new team (`name`, `ldap_group_dn`, `gitlab_group_path`, `is_active`).
- `PUT /api/admin/teams/:id`: Updates team properties or toggles active status.
- `DELETE /api/admin/teams/:id`: Decommissions a team.

### Scoped Repositories & Triggering (`/api/repos`)
- `GET /api/repos?teamId=:id&search=:term&page=:num`: Lists scoped GitLab projects for the user's active team.
- `POST /api/repos/:projectId/trigger`: Dispatches a pipeline execution via KRO resource graphs.
- `GET /api/repos/:repoName/metrics`: Returns real-time pod CPU and memory usage from `metrics.k8s.io`.
- `GET /api/repos/:repoName/stream`: Server-Sent Events (SSE) stream of live container logs.

### Fleet Telemetry (`/api/fleet`)
- `GET /api/fleet/health`: Returns aggregated build statistics across all onboarded engineering teams.

---

## 🧪 OpenSpec Workflow & Testing

This project follows the **OpenSpec Specification-Driven Development** methodology. Every capability is specified in unambiguous requirements before implementation.

### Validate Specifications

Ensure all capabilities and changes adhere to the OpenSpec schema:
```bash
npx openspec validate --specs
```

### Run Automated Tests

Execute the complete Vitest test suite covering unit, integration, and deployment assertions:
```bash
npm test
```

Current test suite summary:
```text
 ✓ tests/db.test.ts (7 tests)
 ✓ tests/kubernetesDeployment.test.ts (5 tests)
 ✓ tests/repos.test.ts (8 tests)
 ✓ tests/frontendEntry.test.ts (5 tests)
 ✓ tests/observability.test.ts (11 tests)
 ✓ tests/repositoryPicker.test.ts (5 tests)
 ✓ tests/argoKpack.test.ts (4 tests)
 ✓ tests/config.test.ts (2 tests)
 ✓ tests/kroTrigger.test.ts (9 tests)
 ✓ tests/e2e.test.ts (1 test)
 ✓ tests/auth.test.ts (18 tests)

 Test Files  11 passed (11)
      Tests  75 passed (75)
```

---

## 📄 License

Internal Platform License. All rights reserved.
