## 1. LDAP Socket Resilience & Deduplication

- [x] 1.1 Add settle guard and socket error listener in `src/backend/services/ldapService.ts` to reject on connection failure
- [x] 1.2 Deduplicate input LDAP group DNs in `src/backend/db.ts` `findActiveTeamsForUser`
- [x] 1.3 Add unit tests in `tests/auth.test.ts` and `tests/db.test.ts` verifying socket error rejection and deduplication

## 2. Query Parameter Validation & Bounding

- [x] 2.1 Add strict numeric validation for `teamId` in `src/backend/routes/repos.ts` returning 400 on non-numeric IDs
- [x] 2.2 Add safe numeric bounds and fallback for `page` and `limit` in `src/backend/routes/repos.ts` preventing `NaN`
- [x] 2.3 Add unit tests in `tests/repos.test.ts` verifying 400 on invalid `teamId` and safe pagination defaults on non-numeric input

## 3. Server Error Handling & Argo Sensor Alignment

- [x] 3.1 Attach port error listener in `src/backend/server.ts` to gracefully handle `EADDRINUSE`
- [x] 3.2 Align event source naming in `k8s/argo/events/gitlab-tag-sensor.yaml` with KRO trigger event sources
- [x] 3.3 Verify full test suite and compilation with `npx tsc --noEmit` and `npm test`
