## Why

During a full codebase audit following initial implementation, multiple issues were uncovered: TypeScript compilation fails with 84 errors due to missing JSX and DOM configurations in `tsconfig.json`, un-narrowed environment types in `config.ts`, Express 5 `string | string[]` route param mismatches, and `@kubernetes/client-node` v2.0 CustomObjectsApi signature shifts. Additionally, runtime and operational vulnerabilities were identified: SSE log streaming lacks socket disconnect listeners causing leaks, route collisions exist between fleet and repository endpoints, numeric ID parsing lacks NaN checks, and Argo Events tag sensors erroneously trigger builds upon tag deletion.

## What Changes

- **Fix TypeScript Configuration & Compilation**: Add `"jsx": "react-jsx"` and `"DOM"`, `"DOM.Iterable"` to `tsconfig.json`, properly narrow config environment variables in `src/backend/config.ts`, and type-cast Express 5 route params in admin, trigger, and observability routes.
- **Update Kubernetes Client-Node Custom API Adapter**: Implement an adapter for @kubernetes/client-node v2.0+ CustomObjectsApi to accommodate both positional and request object formats in KroService.
- **Harden SSE Log Streaming**: Add es.on('close') abort handling in LogStreamingService to immediately terminate background loops and timeouts when clients disconnect.
- **Resolve Route Collision & Separate Fleet APIs**: Unify fleet health under /api/fleet and keep /api/repos strictly for repository-scoped actions to prevent route collisions with repositories named 'fleet'.
- **Sanitize Numeric IDs**: Add explicit isNaN validation for route parameters across admin and trigger endpoints with clean 400 Bad Request responses.
- **Filter Tag Deletion in Argo Sensor**: Update gitlab-tag-sensor.yaml to ensure tag deletion pushes (fter: "0000000000000000000000000000000000000000") do not trigger pipeline builds.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- rgo-kpack-pipeline-orchestration: Filter out tag deletion webhooks in Argo Events Sensor so only tag creations trigger Kpack builds.
- observability-dashboards: Add socket disconnect abort handling for SSE build log streaming and separate fleet health endpoints from repository-scoped routes.
- uth-team-onboarding: Add input sanitation and NaN validation for team and user IDs in admin routes.
- kro-trigger-provisioning: Add numeric validation for project IDs and support @kubernetes/client-node v2.0 API structures in KroService.

## Impact
- **Configuration**: 	sconfig.json updated with JSX and DOM types.
- **Backend**: src/backend/config.ts, src/backend/app.ts, src/backend/routes/admin.ts, src/backend/routes/triggers.ts, src/backend/routes/observability.ts, src/backend/services/logStreamingService.ts, src/backend/services/kroService.ts.
- **Frontend**: Seamless compilation for React components without build or type check errors.
- **K8s Manifests**: k8s/argo/events/gitlab-tag-sensor.yaml.
