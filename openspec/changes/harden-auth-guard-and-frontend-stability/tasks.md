## 1. Bearer Token Resolution & Auth Guard Hardening

- [x] 1.1 Implement Bearer token context resolution middleware in `authGuard.ts` and wire into `createApp`
- [x] 1.2 Invalidate and delete `session.oauthState` immediately after successful verification in `auth.ts`
- [x] 1.3 Add unit tests in `tests/auth.test.ts` verifying Bearer token API access and state token invalidation

## 2. Request Payload Safety & Admin PUT Conflict Handling

- [x] 2.1 Protect `req.body` destructuring with fallback objects and optional chaining across `auth.ts`, `admin.ts`, and `triggers.ts`
- [x] 2.2 Wrap `dbManager.updateTeam` in `PUT /api/admin/teams/:id` with `try ... catch` returning `409 Conflict` on SQLite unique constraint violations
- [x] 2.3 Add unit tests verifying empty request bodies and duplicate team update conflicts

## 3. Observability & Metrics Robustness

- [x] 3.1 Add `X-Accel-Buffering: no` response header in `logStreamingService.ts` to prevent reverse-proxy buffering
- [x] 3.2 Add type coercion and fallback handling in `parseCpuQuantity` and `parseMemoryQuantity` in `metricsService.ts`
- [x] 3.3 Add unit tests in `tests/observability.test.ts` verifying numeric quantity parsing and SSE unbuffering headers

## 4. Frontend Component Reliability

- [x] 4.1 Update `DarkTerminal.tsx` with `useRef` to eliminate stale closure on `currentPhase` and add `.catch()` to clipboard copy
- [x] 4.2 Fix client-side pagination slicing in `RepositoryPicker.tsx` when operating in local fallback mode
- [x] 4.3 Add component unit tests in `tests/repositoryPicker.test.ts` verifying local page slicing
