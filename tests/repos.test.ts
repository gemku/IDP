import { describe, it, expect, beforeEach } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import { createReposRouter } from '../src/backend/routes/repos.js';
import { IGitLabService } from '../src/backend/services/gitlabService.js';
import { GitLabProject, OnboardedTeam } from '../src/types/models.js';

class MockGitLabReposService implements Partial<IGitLabService> {
  public projects: GitLabProject[] = [
    {
      id: 1,
      name: 'auth-service',
      path: 'auth-service',
      path_with_namespace: 'engineering/platform/auth-service',
      web_url: 'https://gitlab.example.com/engineering/platform/auth-service',
      visibility: 'internal',
    },
    {
      id: 2,
      name: 'billing-api',
      path: 'billing-api',
      path_with_namespace: 'engineering/platform/billing-api',
      web_url: 'https://gitlab.example.com/engineering/platform/billing-api',
      visibility: 'private',
    },
    {
      id: 3,
      name: 'public-docs',
      path: 'public-docs',
      path_with_namespace: 'engineering/platform/public-docs',
      web_url: 'https://gitlab.example.com/engineering/platform/public-docs',
      visibility: 'public',
    },
  ];

  public async getGroupProjects(groupId: number | string, token: string): Promise<GitLabProject[]> {
    if (groupId === 'engineering/platform') {
      return this.projects;
    }
    return [];
  }
}

describe('Scoped Repository Picker API', () => {
  let app: Express;
  let mockGitLab: MockGitLabReposService;

  const mockTeam: OnboardedTeam = {
    id: 10,
    name: 'Platform Engineering',
    ldap_group_dn: 'cn=platform-eng,ou=groups,dc=example,dc=com',
    gitlab_group_path: 'engineering/platform',
    is_active: 1,
    created_at: '2026-01-01',
    updated_at: '2026-01-01',
  };

  beforeEach(() => {
    mockGitLab = new MockGitLabReposService();
    app = express();
    app.use(express.json());

    // Inject mock authenticated user session
    app.use((req, res, next) => {
      (req as any).mockUser = {
        gitlabUser: { id: 1, username: 'alice', email: 'alice@example.com', name: 'Alice' },
        ldapGroups: ['cn=platform-eng,ou=groups,dc=example,dc=com'],
        activeTeams: [mockTeam],
      };
      next();
    });

    const reposRouter = createReposRouter(mockGitLab as IGitLabService);
    app.use('/api/repos', reposRouter);
  });

  it('fetches scoped repositories for the authenticated user active team', async () => {
    const res = await request(app).get('/api/repos');
    expect(res.status).toBe(200);
    expect(res.body.team.name).toBe('Platform Engineering');
    expect(res.body.projects).toHaveLength(3);
    expect(res.body.pagination.total).toBe(3);
  });

  it('filters repositories by debounced search keyword', async () => {
    const res = await request(app).get('/api/repos?search=billing');
    expect(res.status).toBe(200);
    expect(res.body.projects).toHaveLength(1);
    expect(res.body.projects[0].name).toBe('billing-api');
    expect(res.body.projects[0].visibility).toBe('private');
  });

  it('paginates repository results correctly', async () => {
    const res = await request(app).get('/api/repos?limit=2&page=1');
    expect(res.status).toBe(200);
    expect(res.body.projects).toHaveLength(2);
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.limit).toBe(2);
    expect(res.body.pagination.totalPages).toBe(2);

    const resPage2 = await request(app).get('/api/repos?limit=2&page=2');
    expect(resPage2.status).toBe(200);
    expect(resPage2.body.projects).toHaveLength(1);
    expect(resPage2.body.projects[0].name).toBe('public-docs');
  });

  it('returns 403 when requesting a team ID not belonging to the user active teams', async () => {
    const res = await request(app).get('/api/repos?teamId=999');
    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
  });

  it('rejects non-numeric teamId with 400 Bad Request', async () => {
    const res = await request(app).get('/api/repos?teamId=invalid-id');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('numeric identifier');
  });

  it('safely handles non-numeric or negative pagination parameters without NaN', async () => {
    const res = await request(app).get('/api/repos?page=abc&limit=xyz');
    expect(res.status).toBe(200);
    expect(res.body.pagination.page).toBe(1);
    expect(res.body.pagination.limit).toBe(10);
    expect(Number.isNaN(res.body.pagination.page)).toBe(false);
    expect(Number.isNaN(res.body.pagination.limit)).toBe(false);
    expect(res.body.projects).toHaveLength(3);
  });

  it('allows token to be undefined and calls getGroupProjects cleanly without dummy-token', async () => {
    let capturedToken: string | undefined = 'initial';
    const trackingGitLab: Partial<IGitLabService> = {
      async getGroupProjects(groupId: number | string, token?: string) {
        capturedToken = token;
        return [];
      },
    };

    const testApp = express();
    testApp.use((req, res, next) => {
      (req as any).mockUser = {
        gitlabUser: { id: 1, username: 'alice' },
        activeTeams: [mockTeam],
      };
      next();
    });
    testApp.use('/api/repos', createReposRouter(trackingGitLab as IGitLabService));

    const res = await request(testApp).get('/api/repos');
    expect(res.status).toBe(200);
    expect(capturedToken).toBeUndefined();
  });
});

