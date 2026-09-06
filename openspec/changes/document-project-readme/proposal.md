## Why

The Internal Developer Platform (IDP) has grown from initial specifications into a complete, full-stack cloud-native orchestration system comprising authentication, repository discovery, KRO resource graph trigger provisioning, Argo & Kpack CI/CD pipelines, live observability dashboards & streaming terminals, Kubernetes manifests, and a unified React SPA. However, the repository lacks a comprehensive `README.md` to guide new developers, operators, and platform evaluators on architecture, local development, Kubernetes deployment, and API usage.

## What Changes

- Create a comprehensive root `README.md` covering:
  - **Platform Architecture & Core Capabilities**: Visual breakdown of the 6 foundational systems (Authentication & RBAC, Scoped Repository Discovery, KRO Trigger Provisioning, Argo + Kpack Pipeline Orchestration, Observability Dashboards, and Kubernetes Deployment).
  - **Tech Stack Overview**: Node.js 24 native SQLite (`node:sqlite`), Express 5, React 19, Vite, Tailwind CSS, Kubernetes Client, Vitest, OpenSpec.
  - **Quickstart & Local Development**: Prerequisites, installation, running the backend (`npm start`), running the frontend dev server (`npm run dev`), running both together.
  - **Configuration & Environment Variables**: Complete `.env` reference table for GitLab, LDAP, KRO, and database settings.
  - **Kubernetes In-Cluster Deployment**: Deploying dependencies (Argo, Kpack, KRO) and deploying platform manifests (`k8s/platform/`) with persistent volumes and RBAC.
  - **API Reference**: Overview of `/api/auth`, `/api/admin`, `/api/repos`, `/api/fleet`, and `/api/health`.
  - **OpenSpec Workflow & Testing**: How to validate specs, run unit/integration tests (`npm test`), and apply changes.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
None. (This change is purely documentation and has declared `skip_specs: true` in `.openspec.yaml`).

## Impact

- `README.md`: New comprehensive documentation at project root.
- Developer experience: Clear onboarding guide for contributors and operators.

