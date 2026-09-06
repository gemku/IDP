## 1. Backend Service & Route Hardening

- [x] 1.1 Update `GitLabService.getGroupProjects` to make `token?: string` optional and fallback to `adminToken`, removing dummy token workaround in `repos.ts`
- [x] 1.2 Add Express JSON error handling middleware in `src/backend/app.ts` to respond with JSON on malformed request bodies
- [x] 1.3 Add whitespace trimming and non-empty validation in `src/backend/routes/admin.ts` on team POST and PUT
- [x] 1.4 Add unit tests in `tests/repos.test.ts` and `tests/auth.test.ts` for admin token fallback, whitespace rejection, and malformed JSON errors

## 2. Frontend Component Telemetry & Fallbacks

- [x] 2.1 Add custom SSE `event: error` listener in `src/frontend/components/DarkTerminal.tsx` to render server error payloads
- [x] 2.2 Add defensive array fallbacks for `res?.projects` and `res?.total` in `src/frontend/components/RepositoryPicker.tsx`
- [x] 2.3 Add unit tests in `tests/repositoryPicker.test.ts` verifying defensive handling of missing project response data

## 3. Verification & Archival

- [x] 3.1 Verify full test suite and compilation with `npx tsc --noEmit` and `npm test`
