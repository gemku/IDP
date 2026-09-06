## 1. Database and Environment Configuration

- [x] 1.1 Create database schema migration for the `onboarded_teams` table (`id`, `name`, `ldap_group_dn`, `gitlab_group_path`, `is_active`, `created_at`, `updated_at`) and verify table creation with test queries.
- [x] 1.2 Setup backend environment configuration module to validate GitLab OAuth credentials, LDAP connection parameters, and Kubernetes cluster configuration, and verify configuration unit tests pass.

## 2. Backend Authentication and Team Authorization

- [x] 2.1 Implement GitLab CE OAuth 2.0 Authorization Code exchange routes (`/api/auth/gitlab/login`, `/api/auth/gitlab/callback`) and verify token exchange unit tests.
- [x] 2.2 Implement direct LDAP client service using `ldapjs` to bind and query authenticated user `memberOf` attributes and verify group resolution against mock LDAP tests.
- [x] 2.3 Implement team authorization guard middleware checking user LDAP groups against active `onboarded_teams` and verify 403 Forbidden rejection for unauthorized users.
- [x] 2.4 Implement Admin team management REST API endpoints (CRUD `/api/admin/teams`, toggle status, and validate GitLab group paths via `GET /api/v4/groups/:id`) and verify endpoint integration tests.

## 3. Scoped Repository Picker

- [x] 3.1 Implement scoped GitLab projects API endpoint (`GET /api/repos`) querying `GET /api/v4/groups/:id/projects?include_subgroups=true&membership=true` for the user's active team and verify response filtering tests.
- [x] 3.2 Build React + Tailwind CSS repository picker component with debounced search filtering, pagination controls, and visibility badges, and verify UI component rendering tests.

## 4. Kubernetes and KRO Trigger Provisioning

- [x] 4.1 Define KRO `ResourceGraphDefinition` for `GitLabTagTrigger` in `k8s/kro/gitlab-tag-trigger-rgd.yaml` expanding into an Argo Events `EventSource` and webhook Secret, and verify CEL expressions.
- [x] 4.2 Implement Kubernetes client service in Node.js using `@kubernetes/client-node` to apply, inspect, and delete `GitLabTagTrigger` custom resources, and verify CR operations against a mock/live API server.
- [x] 4.3 Implement automated GitLab webhook registration service calling `POST /api/v4/projects/:id/hooks` with `tag_push_events: true` and shared secret token, and verify webhook creation tests.

## 5. Argo Events, Workflows, and Kpack Build Pipeline

- [x] 5.1 Define Argo Events `Sensor` manifest filtering GitLab tag push events, sanitizing tag strings (stripping `refs/tags/`), and submitting parameterized Argo Workflows, and verify manifest syntax.
- [x] 5.2 Create Argo Workflow semaphore `ConfigMap` (`max-builds: "5"`) and configure workflow `synchronization.semaphore` to enforce concurrency limits, and verify manifest syntax.
- [x] 5.3 Configure the workflow step applying the Kpack `Image` resource (`kpack.io/v1alpha2`) with `successCondition` (`status.conditions.@filter(type=="Ready").0.status == True`) and `failureCondition` to prevent early completion, and verify template execution.
- [x] 5.4 Configure Kpack `ClusterBuilder` and `Image` resources with explicit memory limits, `NODE_OPTIONS`, `BP_JVM_VERSION`, and Git credentials to prevent Exit Code 137 (OOMKilled), and verify resource specs.

## 6. Observability and Monitoring Dashboards

- [x] 6.1 Implement Kubernetes metrics service querying `metrics.k8s.io/v1beta1` for pod CPU/memory utilization against resource limits and verify metric percentage calculations.
- [x] 6.2 Implement SSE endpoint (`/api/repos/:repoName/logs`) tailing live Kpack build initContainer logs (`detect`, `build`, `export`) using `@kubernetes/client-node` and verify SSE streaming tests.
- [x] 6.3 Build React Aggregated Fleet Dashboard displaying overall pipeline health, active build counts, and success/failure metrics across teams, and verify component tests.
- [x] 6.4 Build React Individual Repository Dashboard displaying 4-step pipeline status (`KRO` -> `EventSource` -> `Workflow` -> `Kpack`) and real-time CPU/memory radial gauges, and verify visual state transitions.
- [x] 6.5 Build React dark-mode terminal component consuming the SSE log stream with ANSI color parsing and autoscroll, and verify terminal rendering tests.

## 7. End-to-End Integration and Verification

- [x] 7.1 Deploy all Kubernetes manifests (`k8s/kro/`, `k8s/argo/`, `k8s/kpack/`) and verify operator controller reconciliations.
- [x] 7.2 Run end-to-end integration test simulating team onboarding, repository selection, tag push webhook emission, live log streaming, and successful Kpack image creation.
- [x] 7.3 Run `openspec validate build-internal-developer-platform --strict` to verify all OpenSpec artifacts comply with schema standards.

