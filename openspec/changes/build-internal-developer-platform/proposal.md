## Why

Internal engineering teams need a secure, automated, self-service platform to onboard developers, manage team repositories, configure tag-driven build pipelines, and observe live build execution without direct cluster access. By combining Node.js, React, GitLab CE OAuth, LDAP directory querying via `ldapjs`, KRO (Kube Resource Orchestrator), Argo Events, Argo Workflows, and Kpack Cloud Native Buildpacks, this platform establishes an enterprise-grade Internal Developer Platform (IDP) with strict RBAC, automated pipeline provisioning, synchronized build queues, and real-time build log streaming.

## What Changes

- **Authentication & Team Onboarding**:
  - Implement GitLab CE OAuth 2.0 Authorization Code flow for user authentication.
  - Implement direct LDAP `memberOf` group querying using `ldapjs` in the Node.js backend to bypass GitLab CE's lack of native LDAP group sync.
  - Store and manage active teams in an `onboarded_teams` database table (`id`, `name`, `ldap_group_dn`, `gitlab_group_path`, `is_active`) and block non-onboarded users with a 403 Access Denied page.
  - Deliver an Admin UI for team CRUD, active toggling, and real-time GitLab group path verification via GitLab REST API.

- **Scoped Repository Picker**:
  - Restrict repository browsing to the user's active onboarded team group path using `GET /api/v4/groups/:id/projects?include_subgroups=true&membership=true`.
  - Deliver a React + Tailwind CSS repository picker featuring debounced search filtering, pagination, and visibility badges.

- **KRO Trigger Provisioning**:
  - Use `@kubernetes/client-node` in the backend to create KRO custom resources (`GitLabTagTrigger` under `kro.run/v1alpha1`) when repositories are connected.
  - Define the KRO `ResourceGraphDefinition` that expands `GitLabTagTrigger` into an Argo Events `EventSource` (configured for `tagPushEvent`) and a secure webhook token Secret.
  - Automatically create GitLab project webhooks pointing to the Argo Events gateway with `tag_push_events: true` and the shared secret token.

- **Build Pipeline Orchestration (Argo + Kpack)**:
  - Configure an Argo Events `Sensor` to intercept tag push events, sanitize the tag reference (stripping `refs/tags/`), and submit an Argo `Workflow`.
  - Enforce concurrency limits using an Argo Workflow `synchronization.semaphore` backed by a ConfigMap.
  - Define the workflow step that creates/updates a Kpack `Image` (`kpack.io/v1alpha2`) and configure `successCondition` (`status.conditions.@filter(type=="Ready").0.status == True`) and `failureCondition` to prevent early workflow completion while holding the semaphore.
  - Configure Kpack build resource allocations (memory limits, JVM/Node memory env flags, Git credential secrets) to eliminate Exit Code 137 (OOMKilled) errors.

- **Observability & Monitoring Dashboards**:
  - Build an Aggregated Fleet Dashboard displaying overall pipeline health and active builds across all onboarded teams.
  - Build an Individual Repository Dashboard displaying the 4-step pipeline status (`KRO` -> `EventSource` -> `Workflow` -> `Kpack`).
  - Render real-time CPU and memory utilization gauges using data queried from `metrics.k8s.io/v1beta1` against pod limits.
  - Deliver a dark-mode terminal component consuming an SSE endpoint (`/api/repos/:repoName/logs`) tailing live Kpack build initContainer logs (`detect`, `build`, `export`).

## Capabilities

### New Capabilities
- `auth-team-onboarding`: GitLab CE OAuth 2.0 authentication, backend `ldapjs` `memberOf` group resolution, `onboarded_teams` database store, 403 access control, and Admin team management UI with GitLab path validation.
- `scoped-repository-picker`: Scoped GitLab group repository querying with React + Tailwind debounced search, pagination, and visibility badges.
- `kro-trigger-provisioning`: `@kubernetes/client-node` management of `GitLabTagTrigger` custom resources, KRO `ResourceGraphDefinition` expanding EventSources and Secrets, and automated GitLab webhook registration.
- `argo-kpack-pipeline-orchestration`: Argo Events Sensor tag event parsing, Argo Workflow semaphore synchronization, blocking `successCondition`/`failureCondition` on Kpack `Image` resources, and OOM-hardened build environments.
- `observability-dashboards`: Aggregated fleet dashboard, 4-step pipeline status tracker, real-time resource utilization gauges (`metrics.k8s.io`), and live SSE terminal log streaming for Kpack initContainers (`detect`, `build`, `export`).

### Modified Capabilities
<!-- None: Greenfield platform implementation. -->

## Impact

- **Backend**: New Node.js/Express service with `@kubernetes/client-node`, `ldapjs`, `axios` (GitLab API), PostgreSQL/SQLite client, and SSE streaming.
- **Frontend**: New React + Tailwind CSS SPA with Admin Team Management, Scoped Repo Picker, Fleet Dashboard, 4-Step Pipeline Visualizer, Resource Gauges, and SSE Dark Terminal.
- **Kubernetes**: Custom KRO `ResourceGraphDefinition` for `GitLabTagTrigger`, Argo Events EventBus/EventSource/Sensor, Argo WorkflowTemplates with semaphore ConfigMaps, and Kpack `ClusterBuilder`/`Image` resources.
- **External Dependencies**: GitLab CE (OAuth 2.0 provider, REST API, Webhooks) and LDAP Directory server.

