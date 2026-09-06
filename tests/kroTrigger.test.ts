import { describe, it, expect, beforeEach, vi } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import { KroService, IKubernetesCustomApi } from '../src/backend/services/kroService.js';
import { IGitLabService } from '../src/backend/services/gitlabService.js';
import { createTriggersRouter } from '../src/backend/routes/triggers.js';
import fs from 'node:fs';
import path from 'node:path';

class MockKubernetesCustomApi implements IKubernetesCustomApi {
  public storedObjects: Map<string, any> = new Map();

  public async createNamespacedCustomObject(
    group: string,
    version: string,
    namespace: string,
    plural: string,
    body: any
  ) {
    const key = `${namespace}/${body.metadata.name}`;
    this.storedObjects.set(key, body);
    return { body };
  }

  public async getNamespacedCustomObject(
    group: string,
    version: string,
    namespace: string,
    plural: string,
    name: string
  ) {
    const key = `${namespace}/${name}`;
    if (!this.storedObjects.has(key)) {
      throw new Error(`NotFound: ${name}`);
    }
    return { body: this.storedObjects.get(key) };
  }

  public async deleteNamespacedCustomObject(
    group: string,
    version: string,
    namespace: string,
    plural: string,
    name: string
  ) {
    const key = `${namespace}/${name}`;
    this.storedObjects.delete(key);
    return { body: { status: 'Success' } };
  }

  public async listNamespacedCustomObject(
    group: string,
    version: string,
    namespace: string,
    plural: string
  ) {
    const items = Array.from(this.storedObjects.values()).filter((obj) => obj.metadata.namespace === namespace);
    return { body: { items } };
  }
}

class MockGitLabWebhookService implements Partial<IGitLabService> {
  public registeredHooks: any[] = [];

  public async registerProjectWebhook(projectId: number, webhookUrl: string, secretToken: string) {
    const hook = { id: 777, projectId, webhookUrl, secretToken, tag_push_events: true };
    this.registeredHooks.push(hook);
    return hook;
  }

  public async getGroupProjects(groupPath: string, token: string) {
    if (groupPath === 'engineering/platform') {
      return [
        {
          id: 123,
          name: 'auth-service',
          path: 'auth-service',
          path_with_namespace: 'engineering/platform/auth-service',
          web_url: 'https://gitlab.example.com/engineering/platform/auth-service',
          visibility: 'internal' as const,
        },
      ];
    }
    return [];
  }
}

describe('KRO Trigger Provisioning & GitLab Webhook Registration', () => {
  let mockK8sApi: MockKubernetesCustomApi;
  let kroService: KroService;
  let mockGitLab: MockGitLabWebhookService;
  let app: Express;

  beforeEach(() => {
    mockK8sApi = new MockKubernetesCustomApi();
    kroService = new KroService(mockK8sApi);
    mockGitLab = new MockGitLabWebhookService();

    app = express();
    app.use(express.json());

    // Inject active user
    app.use((req, res, next) => {
      (req as any).mockUser = {
        gitlabUser: { username: 'alice' },
        activeTeams: [{ id: 1, name: 'Platform', gitlab_group_path: 'engineering/platform' }],
      };
      next();
    });

    const triggersRouter = createTriggersRouter(kroService, mockGitLab as IGitLabService);
    app.use('/api/repos', triggersRouter);
  });

  it('validates that KRO ResourceGraphDefinition manifest exists and defines GitLabTagTrigger', () => {
    const rgdPath = path.join(process.cwd(), 'k8s', 'kro', 'gitlab-tag-trigger-rgd.yaml');
    expect(fs.existsSync(rgdPath)).toBe(true);
    const content = fs.readFileSync(rgdPath, 'utf8');
    expect(content).toContain('kind: ResourceGraphDefinition');
    expect(content).toContain('name: gitlabtagtriggers.kro.run');
    expect(content).toContain('kind: EventSource');
    expect(content).toContain('kind: Secret');
  });

  it('provisions a KRO GitLabTagTrigger custom resource via KroService', async () => {
    const trigger = await kroService.createTagTrigger('default', {
      name: 'auth-service-trigger',
      repoUrl: 'https://gitlab.example.com/platform/auth-service.git',
      projectId: 123,
      tagPattern: 'refs/tags/v*',
      secretToken: 'custom-secret-token',
    });

    expect(trigger.apiVersion).toBe('kro.run/v1alpha1');
    expect(trigger.kind).toBe('GitLabTagTrigger');
    expect(trigger.spec.projectId).toBe(123);
    expect(trigger.spec.secretToken).toBe('custom-secret-token');

    const fetched = await kroService.getTagTrigger('default', 'auth-service-trigger');
    expect(fetched).toEqual(trigger);

    await kroService.deleteTagTrigger('default', 'auth-service-trigger');
    await expect(kroService.getTagTrigger('default', 'auth-service-trigger')).rejects.toThrow();
  });

  it('orchestrates trigger creation and automatic GitLab webhook registration via API route', async () => {
    const res = await request(app).post('/api/repos/123/trigger').send({
      repoUrl: 'https://gitlab.example.com/platform/auth-service.git',
      repoName: 'auth-service',
      targetNamespace: 'tenant-team-a',
    });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.trigger.metadata.name).toBe('auth-service-trigger');
    expect(res.body.webhook.tag_push_events).toBe(true);
    expect(mockGitLab.registeredHooks).toHaveLength(1);
    expect(mockGitLab.registeredHooks[0].webhookUrl).toContain('tenant-team-a');
  });

  it('rejects trigger provision requests with non-numeric project IDs', async () => {
    const res = await request(app).post('/api/repos/not-a-number/trigger').send({
      repoUrl: 'https://gitlab.example.com/platform/auth-service.git',
      repoName: 'auth-service',
    });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('numeric identifier');
  });

  it('rejects trigger creation with 403 Forbidden when project is outside user active teams', async () => {
    const res = await request(app).post('/api/repos/999/trigger').send({
      repoUrl: 'https://gitlab.example.com/other-team/secret-service.git',
      repoName: 'secret-service',
      targetNamespace: 'tenant-team-a',
    });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
    expect(res.body.message).toContain('Project 999 does not belong to any of your active onboarded teams');
  });

  it('rejects trigger deletion with 403 Forbidden when project is outside user active teams', async () => {
    const res = await request(app).delete('/api/repos/999/trigger?repoName=secret-service');

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Forbidden');
    expect(res.body.message).toContain('Project 999 does not belong to any of your active onboarded teams');
  });

  it('requires non-empty repoName query parameter on trigger GET and DELETE routes', async () => {
    // GET without repoName
    const getRes = await request(app).get('/api/repos/123/trigger');
    expect(getRes.status).toBe(400);
    expect(getRes.body.error).toContain('repoName');

    // DELETE without repoName
    const deleteRes = await request(app).delete('/api/repos/123/trigger');
    expect(deleteRes.status).toBe(400);
    expect(deleteRes.body.error).toContain('repoName');
  });
});

