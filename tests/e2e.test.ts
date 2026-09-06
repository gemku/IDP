import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/backend/app.js';
import { DatabaseManager } from '../src/backend/db.js';
import { MockLdapService } from '../src/backend/services/ldapService.js';
import { IGitLabService } from '../src/backend/services/gitlabService.js';
import { KroService, IKubernetesCustomApi } from '../src/backend/services/kroService.js';
import { MetricsService, IMetricsClient } from '../src/backend/services/metricsService.js';
import { LogStreamingService, MockLogSource } from '../src/backend/services/logStreamingService.js';
import fs from 'node:fs';
import path from 'node:path';

class E2EGitLabService implements IGitLabService {
  public registeredHooks: any[] = [];

  public getAuthorizationUrl() {
    return 'https://gitlab.example.com/oauth/authorize?client_id=e2e';
  }

  public async exchangeCodeForToken(code: string) {
    if (code === 'auth-code-alice') {
      return { access_token: 'alice-access-token' };
    }
    throw new Error('Invalid code');
  }

  public async getUserProfile(token: string) {
    return {
      id: 42,
      username: 'alice.developer',
      email: 'alice@company.com',
      name: 'Alice Developer',
    };
  }

  public async validateGroupPath(groupPath: string) {
    if (groupPath === 'engineering/platform') {
      return { id: 100, name: 'Platform Engineering', path: 'engineering/platform' };
    }
    throw new Error(`Group ${groupPath} not found`);
  }

  public async getGroupProjects(groupId: number | string, token: string) {
    return [
      {
        id: 501,
        name: 'payment-service',
        path: 'payment-service',
        path_with_namespace: 'engineering/platform/payment-service',
        web_url: 'https://gitlab.example.com/engineering/platform/payment-service',
        visibility: 'internal' as const,
      },
    ];
  }

  public async registerProjectWebhook(projectId: number, webhookUrl: string, secretToken: string) {
    const hook = { id: 888, projectId, webhookUrl, secretToken, tag_push_events: true };
    this.registeredHooks.push(hook);
    return hook;
  }
}

class E2EK8sApi implements IKubernetesCustomApi {
  public objects: Map<string, any> = new Map();

  public async createNamespacedCustomObject(g: string, v: string, ns: string, pl: string, body: any) {
    this.objects.set(`${ns}/${body.metadata.name}`, body);
    return { body };
  }

  public async getNamespacedCustomObject(g: string, v: string, ns: string, pl: string, name: string) {
    const obj = this.objects.get(`${ns}/${name}`);
    if (!obj) throw new Error('Not found');
    return { body: obj };
  }

  public async deleteNamespacedCustomObject(g: string, v: string, ns: string, pl: string, name: string) {
    this.objects.delete(`${ns}/${name}`);
    return { body: { status: 'Success' } };
  }

  public async listNamespacedCustomObject() {
    return { body: { items: Array.from(this.objects.values()) } };
  }
}

describe('End-to-End Platform Integration Flow', () => {
  const dbPath = path.join(process.cwd(), 'data', 'e2e-platform.db');
  let dbManager: DatabaseManager;
  let gitlabService: E2EGitLabService;
  let ldapService: MockLdapService;
  let k8sApi: E2EK8sApi;
  let kroService: KroService;
  let metricsService: MetricsService;
  let logStreamingService: LogStreamingService;
  let app: any;

  beforeEach(() => {
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    dbManager = new DatabaseManager(dbPath);
    gitlabService = new E2EGitLabService();
    ldapService = new MockLdapService();
    k8sApi = new E2EK8sApi();
    kroService = new KroService(k8sApi);

    const metricsClient: IMetricsClient = {
      getPodMetrics: async () => ({ containers: [{ usage: { cpu: '400m', memory: '1Gi' } }] }),
      getPodLimits: async () => ({ cpuLimit: '2', memLimit: '4Gi' }),
    };
    metricsService = new MetricsService(metricsClient);
    logStreamingService = new LogStreamingService(new MockLogSource());

    app = createApp({
      dbManager,
      gitlabService,
      ldapService,
      kroService,
      metricsService,
      logStreamingService,
    });
  });

  afterEach(() => {
    dbManager.close();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
  });

  it('executes full end-to-end user lifecycle across all 5 core platform capabilities', async () => {
    // 1. Admin UI onboards team with validated GitLab path
    const createTeamRes = await request(app).post('/api/admin/teams').send({
      name: 'Platform Engineering',
      ldap_group_dn: 'cn=platform-eng,ou=groups,dc=example,dc=com',
      gitlab_group_path: 'engineering/platform',
      is_active: true,
    });
    expect(createTeamRes.status).toBe(201);
    const team = createTeamRes.body.team;
    expect(team.name).toBe('Platform Engineering');

    // 2. User logs in via GitLab OAuth and resolves LDAP group membership
    ldapService.setUserGroups('alice.developer', ['cn=platform-eng,ou=groups,dc=example,dc=com']);
    const authRes = await request(app).post('/api/auth/gitlab/callback').send({
      code: 'auth-code-alice',
    });
    expect(authRes.status).toBe(200);
    expect(authRes.body.user.activeTeams).toHaveLength(1);
    expect(authRes.body.user.activeTeams[0].name).toBe('Platform Engineering');

    // 3. User browses scoped repositories
    // Attach user to request via preMiddleware
    const userApp = createApp(
      {
        dbManager,
        gitlabService,
        ldapService,
        kroService,
        metricsService,
        logStreamingService,
      },
      (req: any, res: any, next: any) => {
        req.mockUser = authRes.body.user;
        next();
      }
    );

    const repoRes = await request(userApp).get('/api/repos?search=payment');
    expect(repoRes.status).toBe(200);
    expect(repoRes.body.projects).toHaveLength(1);
    expect(repoRes.body.projects[0].name).toBe('payment-service');

    // 4. User provisions KRO trigger and registers GitLab project webhook
    const triggerRes = await request(userApp).post('/api/repos/501/trigger').send({
      repoUrl: 'https://gitlab.example.com/engineering/platform/payment-service.git',
      repoName: 'payment-service',
      targetNamespace: 'default',
    });
    expect(triggerRes.status).toBe(201);
    expect(triggerRes.body.trigger.kind).toBe('GitLabTagTrigger');
    expect(triggerRes.body.webhook.tag_push_events).toBe(true);

    // 5. Observability: Query pod resource utilization gauges
    const metricsRes = await request(userApp).get('/api/repos/payment-service/metrics');
    expect(metricsRes.status).toBe(200);
    expect(metricsRes.body.cpuPercent).toBe(20);
    expect(metricsRes.body.memoryPercent).toBe(25);

    // 6. Observability: Stream live Kpack build initContainer logs via SSE
    const logRes = await request(userApp).get('/api/repos/payment-service/logs');
    expect(logRes.status).toBe(200);
    expect(logRes.text).toContain('DETECTING');
    expect(logRes.text).toContain('BUILDING');
    expect(logRes.text).toContain('EXPORTING');
    expect(logRes.text).toContain('"status":"succeeded"');
  });
});
