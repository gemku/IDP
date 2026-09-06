import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import { DatabaseManager } from '../src/backend/db.js';
import { MockLdapService, LdapService, escapeLdapFilter } from '../src/backend/services/ldapService.js';
import { IGitLabService } from '../src/backend/services/gitlabService.js';
import { createAuthRouter } from '../src/backend/routes/auth.js';
import { createAdminRouter } from '../src/backend/routes/admin.js';
import { requireAuth, requireOnboardedTeam, createBearerAuthMiddleware } from '../src/backend/middleware/authGuard.js';
import fs from 'node:fs';
import path from 'node:path';

class MockGitLabService implements IGitLabService {
  public validCodes = new Map<string, string>([['valid-code-123', 'mock-access-token-xyz']]);
  public validGroups = new Set<string>(['engineering/platform', 'engineering/core']);

  public getAuthorizationUrl(state?: string): string {
    return `https://gitlab.example.com/oauth/authorize?client_id=test&state=${state || ''}`;
  }

  public async exchangeCodeForToken(code: string): Promise<{ access_token: string }> {
    if (this.validCodes.has(code)) {
      return { access_token: this.validCodes.get(code)! };
    }
    throw new Error('Invalid authorization code');
  }

  public async getUserProfile(accessToken: string) {
    if (accessToken === 'mock-access-token-xyz') {
      return {
        id: 42,
        username: 'alice.developer',
        email: 'alice@company.com',
        name: 'Alice Developer',
      };
    }
    throw new Error('Invalid token');
  }

  public async validateGroupPath(groupPath: string) {
    if (this.validGroups.has(groupPath)) {
      return { id: 101, name: groupPath, path: groupPath };
    }
    throw new Error(`Group not found in GitLab: ${groupPath}`);
  }

  public async getGroupProjects(groupId: number | string, token: string) {
    return [
      {
        id: 501,
        name: 'payment-service',
        path: 'payment-service',
        path_with_namespace: `${groupId}/payment-service`,
        web_url: `https://gitlab.example.com/${groupId}/payment-service`,
        visibility: 'internal' as const,
      },
    ];
  }

  public async registerProjectWebhook(projectId: number, webhookUrl: string, secretToken: string) {
    return { id: 999, project_id: projectId, url: webhookUrl };
  }
}

describe('Authentication, LDAP Group Resolution & Team Authorization', () => {
  const testDbPath = path.join(process.cwd(), 'data', 'test-auth.db');
  let dbManager: DatabaseManager;
  let mockGitLab: MockGitLabService;
  let mockLdap: MockLdapService;
  let app: Express;

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
    dbManager = new DatabaseManager(testDbPath);
    mockGitLab = new MockGitLabService();
    mockLdap = new MockLdapService();

    app = express();
    app.use(express.json());
    app.use(createBearerAuthMiddleware(mockGitLab, mockLdap, dbManager));

    const authRouter = createAuthRouter(mockGitLab, mockLdap, dbManager);
    const adminRouter = createAdminRouter(dbManager, mockGitLab);

    app.use('/api/auth', authRouter);
    app.use('/api/admin', adminRouter);

    // Protected route
    app.get('/api/protected/dashboard', requireOnboardedTeam, (req, res) => {
      res.json({ message: 'Welcome to the platform dashboard!', user: (req as any).user });
    });
  });

  afterEach(() => {
    dbManager.close();
    if (fs.existsSync(testDbPath)) fs.unlinkSync(testDbPath);
  });

  it('generates the correct GitLab OAuth login redirect URL', async () => {
    const res = await request(app).get('/api/auth/gitlab/login?format=json');
    expect(res.status).toBe(200);
    expect(res.body.url).toContain('https://gitlab.example.com/oauth/authorize');
  });

  it('rejects missing or invalid OAuth authorization codes', async () => {
    const resNoCode = await request(app).post('/api/auth/gitlab/callback').send({});
    expect(resNoCode.status).toBe(400);

    const resInvalidCode = await request(app).post('/api/auth/gitlab/callback').send({ code: 'invalid-code' });
    expect(resInvalidCode.status).toBe(500);
    expect(resInvalidCode.body.error).toBe('Authentication failed');
  });

  it('authenticates user and resolves active team via LDAP groups', async () => {
    // 1. Onboard the team
    dbManager.createTeam({
      name: 'Platform Team',
      ldap_group_dn: 'cn=platform-eng,ou=groups,dc=example,dc=com',
      gitlab_group_path: 'engineering/platform',
      is_active: true,
    });

    // 2. Set LDAP groups for user
    mockLdap.setUserGroups('alice.developer', [
      'cn=platform-eng,ou=groups,dc=example,dc=com',
      'cn=all-employees,ou=groups,dc=example,dc=com',
    ]);

    // 3. Perform OAuth callback
    const res = await request(app).post('/api/auth/gitlab/callback').send({ code: 'valid-code-123' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.gitlabUser.username).toBe('alice.developer');
    expect(res.body.user.activeTeams).toHaveLength(1);
    expect(res.body.user.activeTeams[0].name).toBe('Platform Team');
  });

  it('rejects OAuth callback if state parameter does not match session state (CSRF protection)', async () => {
    const sessionApp = express();
    sessionApp.use(express.json());
    sessionApp.use((req, res, next) => {
      (req as any).session = { oauthState: 'expected-csrf-token-123' };
      next();
    });
    sessionApp.use('/api/auth', createAuthRouter(mockGitLab as any, mockLdap, dbManager));

    const res = await request(sessionApp)
      .post('/api/auth/gitlab/callback')
      .send({ code: 'valid-code-123', state: 'wrong-state' });

    expect(res.status).toBe(403);
    expect(res.body.error).toContain('OAuth state parameter verification failed');
  });

  it('returns 403 Access Denied when user LDAP groups do not match any active onboarded team', async () => {
    // Onboard team with different LDAP group
    dbManager.createTeam({
      name: 'Security Ops',
      ldap_group_dn: 'cn=sec-ops,ou=groups,dc=example,dc=com',
      gitlab_group_path: 'engineering/core',
      is_active: true,
    });

    // User is only in non-onboarded group
    mockLdap.setUserGroups('alice.developer', ['cn=contractors,ou=groups,dc=example,dc=com']);

    const res = await request(app).post('/api/auth/gitlab/callback').send({ code: 'valid-code-123' });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Access Denied');
  });

  it('blocks access to protected endpoints with 403 when user is not onboarded', async () => {
    // Unauthenticated request
    const res401 = await request(app).get('/api/protected/dashboard');
    expect(res401.status).toBe(401);

    // Mock un-onboarded user request
    const customApp = express();
    customApp.use((req, res, next) => {
      (req as any).mockUser = {
        gitlabUser: { username: 'bob' },
        ldapGroups: ['cn=interns'],
        activeTeams: [],
      };
      next();
    });
    customApp.get('/api/protected/dashboard', requireOnboardedTeam, (req, res) => {
      res.json({ ok: true });
    });

    const res403 = await request(customApp).get('/api/protected/dashboard');
    expect(res430(res403.status)).toBe(403);
  });

  it('rejects unauthenticated requests to /api/admin endpoints with 401', async () => {
    const resGet = await request(app).get('/api/admin/teams');
    expect(resGet.status).toBe(401);
    expect(resGet.body.error).toContain('Authentication required');

    const resPost = await request(app).post('/api/admin/teams').send({
      name: 'Unauthorized Team',
      ldap_group_dn: 'cn=test,dc=example,dc=com',
      gitlab_group_path: 'engineering/platform',
    });
    expect(resPost.status).toBe(401);
  });

  it('returns 503 Directory Service Unavailable when LDAP lookup fails during OAuth callback', async () => {
    vi.spyOn(mockLdap, 'getUserGroups').mockRejectedValueOnce(new Error('LDAP connection timeout'));

    const res = await request(app).post('/api/auth/gitlab/callback').send({ code: 'valid-code-123' });

    expect(res.status).toBe(503);
    expect(res.body.error).toBe('Directory Service Unavailable');
    expect(res.body.message).toContain('LDAP connection timeout');
  });

  it('handles Admin team management CRUD, active toggle, and GitLab validation', async () => {
    const authHeader = { Authorization: 'Bearer mock-access-token-xyz' };

    // 1. Invalid GitLab path rejected with 422
    const resInvalid = await request(app)
      .post('/api/admin/teams')
      .set(authHeader)
      .send({
        name: 'Bad Team',
        ldap_group_dn: 'cn=bad,dc=example,dc=com',
        gitlab_group_path: 'non-existent/group',
      });
    expect(resInvalid.status).toBe(422);

    // 2. Valid GitLab path accepted with 201
    const resValid = await request(app)
      .post('/api/admin/teams')
      .set(authHeader)
      .send({
        name: 'Core Platform',
        ldap_group_dn: 'cn=core-eng,ou=groups,dc=example,dc=com',
        gitlab_group_path: 'engineering/platform',
        is_active: true,
      });
    expect(resValid.status).toBe(201);
    expect(resValid.body.team.name).toBe('Core Platform');

    const teamId = resValid.body.team.id;

    // 3. Toggle active status
    const resToggle = await request(app)
      .patch(`/api/admin/teams/${teamId}/toggle`)
      .set(authHeader);
    expect(resToggle.status).toBe(200);
    expect(resToggle.body.team.is_active).toBe(0);

    // 4. Delete team
    const resDelete = await request(app)
      .delete(`/api/admin/teams/${teamId}`)
      .set(authHeader);
    expect(resDelete.status).toBe(200);
    expect(resDelete.body.success).toBe(true);

    // 5. Reject invalid non-numeric ID
    const resInvalidId = await request(app)
      .get('/api/admin/teams/invalid-id')
      .set(authHeader);
    expect(resInvalidId.status).toBe(400);
    expect(resInvalidId.body.error).toContain('numeric identifier');
  });

  it('escapes special characters per RFC 4515 to prevent LDAP injection', () => {
    expect(escapeLdapFilter('alice')).toBe('alice');
    expect(escapeLdapFilter('admin*')).toBe('admin\\2a');
    expect(escapeLdapFilter('user(name)')).toBe('user\\28name\\29');
    expect(escapeLdapFilter('c:\\test')).toBe('c:\\5ctest');
    expect(escapeLdapFilter('null\0byte')).toBe('null\\00byte');
    expect(escapeLdapFilter('admin*)(uid=*))(|(uid=*')).toBe('admin\\2a\\29\\28uid=\\2a\\29\\29\\28|\\28uid=\\2a');
  });

  it('authenticates API request using Bearer token without pre-existing cookie session', async () => {
    dbManager.createTeam({
      name: 'Platform Team',
      ldap_group_dn: 'cn=platform-eng,ou=groups,dc=example,dc=com',
      gitlab_group_path: 'engineering/platform',
      is_active: true,
    });

    mockLdap.setUserGroups('alice.developer', ['cn=platform-eng,ou=groups,dc=example,dc=com']);

    // Direct request with Authorization header only
    const res = await request(app)
      .get('/api/protected/dashboard')
      .set('Authorization', 'Bearer mock-access-token-xyz');

    expect(res.status).toBe(200);
    expect(res.body.user.gitlabUser.username).toBe('alice.developer');
    expect(res.body.user.activeTeams[0].name).toBe('Platform Team');
  });

  it('consumes and deletes OAuth state token after verification to prevent replay', async () => {
    const sessionStore: Record<string, any> = { oauthState: 'one-time-state-token' };
    const sessionApp = express();
    sessionApp.use(express.json());
    sessionApp.use((req, res, next) => {
      (req as any).session = sessionStore;
      next();
    });
    sessionApp.use('/api/auth', createAuthRouter(mockGitLab, mockLdap, dbManager));

    dbManager.createTeam({
      name: 'Platform Team',
      ldap_group_dn: 'cn=platform-eng,ou=groups,dc=example,dc=com',
      gitlab_group_path: 'engineering/platform',
      is_active: true,
    });
    mockLdap.setUserGroups('alice.developer', ['cn=platform-eng,ou=groups,dc=example,dc=com']);

    // First attempt succeeds and deletes oauthState
    const res1 = await request(sessionApp)
      .post('/api/auth/gitlab/callback')
      .send({ code: 'valid-code-123', state: 'one-time-state-token' });
    expect(res1.status).toBe(200);
    expect(sessionStore.oauthState).toBeUndefined();

    // Replay attempt with same state fails
    sessionStore.oauthState = 'new-state-token';
    const res2 = await request(sessionApp)
      .post('/api/auth/gitlab/callback')
      .send({ code: 'valid-code-123', state: 'one-time-state-token' });
    expect(res2.status).toBe(403);
  });

  it('safely handles missing or empty body on auth callback and admin endpoints', async () => {
    // 1. Callback without body (e.g. GET with missing code)
    const resCallback = await request(app).get('/api/auth/gitlab/callback');
    expect(resCallback.status).toBe(400);
    expect(resCallback.body.error).toContain('Missing OAuth authorization code');

    // 2. Admin POST with empty body
    const resAdminEmpty = await request(app)
      .post('/api/admin/teams')
      .set('Authorization', 'Bearer mock-access-token-xyz')
      .send();
    expect(resAdminEmpty.status).toBe(400);
  });

  it('returns 409 Conflict when PUT /api/admin/teams/:id updates to an existing duplicate name or LDAP DN', async () => {
    const team1 = dbManager.createTeam({
      name: 'Alpha Team',
      ldap_group_dn: 'cn=alpha,dc=example,dc=com',
      gitlab_group_path: 'engineering/platform',
      is_active: true,
    });

    const team2 = dbManager.createTeam({
      name: 'Beta Team',
      ldap_group_dn: 'cn=beta,dc=example,dc=com',
      gitlab_group_path: 'engineering/core',
      is_active: true,
    });

    // Attempt to rename team2 to team1's name
    const resConflict = await request(app)
      .put(`/api/admin/teams/${team2.id}`)
      .set('Authorization', 'Bearer mock-access-token-xyz')
      .send({ name: 'Alpha Team' });

    expect(resConflict.status).toBe(409);
    expect(resConflict.body.error).toContain('Failed to update team');
  });

  it('rejects with connection error when LdapService encounters a socket connection error', async () => {
    const realLdapService = new LdapService({
      url: 'ldap://127.0.0.1:59999',
      bindDn: 'cn=admin,dc=example,dc=com',
      bindPassword: 'secret',
      baseDn: 'dc=example,dc=com',
    });

    await expect(realLdapService.getUserGroups('alice')).rejects.toThrow(/LDAP Connection Error|LDAP Bind Failure/);
  });
});

function res430(status: number) {
  return status;
}

