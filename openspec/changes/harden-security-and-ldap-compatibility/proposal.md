## Why

A comprehensive security and operational audit revealed critical vulnerabilities and integration risks: LDAP search filter injection (CWE-90) in `LdapService`, cryptographically weak token generation (CWE-338) in `KroService`, and missing OAuth 2.0 CSRF state verification. Furthermore, case-sensitive matching of LDAP DNs in SQLite violates RFC 4514 and risks falsely locking out users, trigger names risk violating Kubernetes RFC 1123 naming rules, and the application lacks an executable server entrypoint (`server.ts`) and standard npm scripts.

## What Changes

- **Neutralize LDAP Filter Injection**: Implement RFC 4515 character escaping in `LdapService` to sanitize all user inputs in filter assertions.
- **Enforce Case-Insensitive LDAP DN Resolution**: Update SQLite schema and query logic in `DatabaseManager` to use `COLLATE NOCASE` on `ldap_group_dn`, ensuring compliant matching across case variations.
- **Cryptographically Secure Webhook Secret Tokens**: Replace pseudo-random `Math.random()` token generation in `KroService` with `node:crypto.randomBytes()`.
- **OAuth 2.0 State CSRF Defense**: Generate and validate secure state parameters across the GitLab OAuth login and callback flows.
- **Sanitize Kubernetes Metadata Names**: Normalize trigger names to guarantee RFC 1123 DNS subdomain compliance (trimming hyphens and capping length to 63 chars).
- **Executable Server Entrypoint & npm Scripts**: Add `src/backend/server.ts` with graceful shutdown handling and configure `test`, `build`, and `start` scripts in `package.json`.

## Capabilities

### New Capabilities
<!-- None -->

### Modified Capabilities
- uth-team-onboarding: Sanitize LDAP query filters against injection, enforce case-insensitive LDAP group DN matching via SQLite COLLATE NOCASE, and protect OAuth flow with state verification.
- kro-trigger-provisioning: Use cryptographically secure token generation for webhook secrets and enforce RFC 1123 DNS compliance on trigger resource names.

## Impact
- **Backend Services**: `src/backend/services/ldapService.ts`, `src/backend/services/kroService.ts`, `src/backend/db.ts`, `src/backend/routes/auth.ts`, `src/backend/routes/triggers.ts`.
- **Runtime Entrypoint**: `src/backend/server.ts` (new), `package.json` scripts.
