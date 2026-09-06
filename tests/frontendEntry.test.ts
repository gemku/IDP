import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import request from 'supertest';
import { createApp, AppDependencies } from '../src/backend/app.js';
import { DatabaseManager } from '../src/backend/db.js';

describe('Frontend Unified Application Entry & Static Serving', () => {
  it('validates index.html exists with required mount root and Tailwind script', () => {
    const indexPath = path.resolve(process.cwd(), 'index.html');
    expect(fs.existsSync(indexPath)).toBe(true);

    const content = fs.readFileSync(indexPath, 'utf-8');
    expect(content).toContain('id="root"');
    expect(content).toContain('/src/frontend/main.tsx');
    expect(content).toContain('tailwindcss');
  });

  it('validates vite.config.mts configures proxy and client build output', () => {
    const viteConfigPath = path.resolve(process.cwd(), 'vite.config.mts');
    expect(fs.existsSync(viteConfigPath)).toBe(true);

    const content = fs.readFileSync(viteConfigPath, 'utf-8');
    expect(content).toContain('5173');
    expect(content).toContain('/api');
    expect(content).toContain('http://localhost:3000');
    expect(content).toContain('dist/client');
  });

  it('validates package.json includes dev and build:client scripts', () => {
    const pkgPath = path.resolve(process.cwd(), 'package.json');
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));

    expect(pkg.scripts.dev).toBe('vite');
    expect(pkg.scripts['build:client']).toBe('vite build');
  });

  it('validates compiled client assets exist in dist/client', () => {
    const clientDist = path.resolve(process.cwd(), 'dist', 'client');
    const clientIndex = path.join(clientDist, 'index.html');

    expect(fs.existsSync(clientIndex)).toBe(true);
    const content = fs.readFileSync(clientIndex, 'utf-8');
    expect(content).toContain('id="root"');
  });

  it('serves static client SPA shell via Express app while preserving API routes', async () => {
    const dbPath = path.join(process.cwd(), 'data', 'test-frontend.db');
    if (fs.existsSync(dbPath)) {
      try {
        fs.unlinkSync(dbPath);
      } catch {}
    }
    const dbManager = new DatabaseManager(dbPath);

    const mockGitlabService = {
      authenticateUser: async () => null,
      getCurrentUser: async () => ({ id: 1, username: 'testuser', email: 'test@example.com', name: 'Test User' }),
      getUserGroups: async () => [],
      getGroupProjects: async () => [],
      getProjectById: async () => null,
      validateMembership: async () => true,
    } as any;

    const mockLdapService = {
      authenticate: async () => true,
      getUserGroups: async () => [],
      close: async () => {},
    } as any;

    const mockKroService = {
      createRepositoryGraph: async () => ({ status: 'created' }),
    } as any;

    const mockMetricsService = {
      getPodResourceUsage: async () => null,
    } as any;

    const mockLogStreamingService = {
      streamPodLogs: async () => {},
    } as any;

    const deps: AppDependencies = {
      dbManager,
      gitlabService: mockGitlabService,
      ldapService: mockLdapService,
      kroService: mockKroService,
      metricsService: mockMetricsService,
      logStreamingService: mockLogStreamingService,
    };

    const app = createApp(deps);

    // 1. API route works
    const healthRes = await request(app).get('/api/health');
    expect(healthRes.status).toBe(200);
    expect(healthRes.body.status).toBe('ok');

    // 2. Client root SPA route serves index.html
    const rootRes = await request(app).get('/');
    expect(rootRes.status).toBe(200);
    expect(rootRes.text).toContain('id="root"');

    // 3. Non-api SPA routes fallback to index.html
    const spaRes = await request(app).get('/repositories');
    expect(spaRes.status).toBe(200);
    expect(spaRes.text).toContain('id="root"');

    // Clean up
    dbManager.close();
    if (fs.existsSync(dbPath)) {
      try {
        fs.unlinkSync(dbPath);
      } catch {}
    }
  });
});
