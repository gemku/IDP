## 1. Security Hardening

- [x] 1.1 Implement RFC 4515 LDAP filter escaping in `src/backend/services/ldapService.ts` and add unit tests covering injection payloads
- [x] 1.2 Replace `Math.random()` with `node:crypto` `randomBytes` in `src/backend/services/kroService.ts`
- [x] 1.3 Implement OAuth 2.0 CSRF state parameter generation and validation in `src/backend/routes/auth.ts`

## 2. LDAP Compatibility & Database Hardening

- [x] 2.1 Update `DatabaseManager` in `src/backend/db.ts` to use `COLLATE NOCASE` for case-insensitive LDAP DN matching
- [x] 2.2 Add unit tests in `tests/db.test.ts` verifying case-insensitive LDAP DN resolution

## 3. Reliability & Operational Readiness

- [x] 3.1 Implement RFC 1123 DNS name sanitization for trigger resources in `src/backend/routes/triggers.ts`
- [x] 3.2 Create executable server entrypoint `src/backend/server.ts` with graceful shutdown handling
- [x] 3.3 Configure `test`, `build`, and `start` scripts in `package.json`

## 4. Verification & Validation

- [x] 4.1 Run full TypeScript compilation check (`npx tsc --noEmit`) and Vitest test suite (`npx vitest run`)
- [x] 4.2 Run `openspec validate harden-security-and-ldap-compatibility --strict` and verify change integrity
