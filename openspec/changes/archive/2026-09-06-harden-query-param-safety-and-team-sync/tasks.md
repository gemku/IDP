## 1. Backend Query Safety & Dynamic Refresh

- [x] 1.1 Implement `getStringParam` helper and apply it to query parameters in `src/backend/routes/repos.ts`
- [x] 1.2 Apply `getStringParam` to query parameters in `src/backend/routes/triggers.ts` and `src/backend/routes/observability.ts`
- [x] 1.3 Dynamically refresh `activeTeams` against `dbManager.findActiveTeamsForUser` in `GET /api/auth/me` in `src/backend/routes/auth.ts`
- [x] 1.4 Add try/catch error handling to `PATCH /api/admin/teams/:id/toggle` in `src/backend/routes/admin.ts`

## 2. Frontend Pagination Reset

- [x] 2.1 Add `useEffect` in `src/frontend/components/RepositoryPicker.tsx` to reset `currentPage` to 1 on `teamId` change

## 3. Test Coverage & Verification

- [x] 3.1 Add test verifying repeated query parameters (`?search=foo&search=bar`) do not crash `GET /api/repos`
- [x] 3.2 Add test verifying repeated query parameters (`?repoName=foo&repoName=bar`) do not crash `GET /api/repos/:projectId/trigger`
- [x] 3.3 Add test verifying `GET /api/auth/me` reflects dynamic team deactivation in `tests/auth.test.ts`
- [x] 3.4 Run `npx tsc --noEmit` and `npm test` to verify all tests pass
