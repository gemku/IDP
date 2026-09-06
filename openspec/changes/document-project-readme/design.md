## Context

See proposal.md - Why.
The repository contains a complete Internal Developer Platform (IDP) with 6 core capabilities, 11 test suites (75 passing tests), backend Express API, React 19 SPA frontend, and full Kubernetes deployment manifests. There is currently no root `README.md`.

## Goals / Non-Goals

**Goals:**
- Create a comprehensive, clear, and production-grade `README.md` at the project root.
- Document system architecture with Mermaid visual diagrams (auth flow, 4-stage pipeline orchestration).
- Provide copy-pasteable local development instructions for both backend and frontend.
- Document the full `.env` configuration table (GitLab, LDAP, SQLite, KRO, K8s).
- Provide complete Kubernetes deployment guide (Argo, Kpack, KRO, and platform manifests).
- Summarize API endpoints and the OpenSpec specification-driven development workflow.

**Non-Goals:**
- Setting up external documentation generators (e.g. Docusaurus, VitePress, or MkDocs).
- Modifying any application source code or tests.

## Decisions

### 1. Root README.md with Embedded Mermaid Diagrams
- **Choice**: Structure the documentation directly in `README.md` using standard GitHub-flavored Markdown and Mermaid diagrams.
- **Rationale**: Immediate readability on GitHub and Git repository browsers without requiring a separate documentation web server or build step.
- **Alternatives Considered**: Multi-file `/docs` directory — rejected as initial entry point should be immediately visible at the repo root.

### 2. Comprehensive Sections Targeting Both Developers and Operators
- **Choice**: Structure content into 8 logical sections:
  1. System Overview & Key Features
  2. Architecture & Pipeline Lifecycle (Mermaid diagrams)
  3. Technology Stack
  4. Quickstart & Local Development
  5. Configuration & Environment Variables
  6. Kubernetes Deployment Guide
  7. API Reference
  8. OpenSpec Workflow & Testing
- **Rationale**: Serves onboarding developers, DevOps engineers running it in Kubernetes, and platform evaluators.

## Risks / Trade-offs

- [Documentation Drift] → Mitigated by referencing exact `package.json` scripts (`npm run dev`, `npm run build:client`, `npm start`, `npm test`), `.env.example`, and manifest paths in `k8s/platform/`.

