import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import path from 'node:path';
import fs from 'node:fs';
import { createApp, AppDependencies } from '../src/backend/app.js';
import { SqliteDatabaseManager, PostgresDatabaseManager, DatabaseManager, IDatabaseManager } from '../src/backend/db.js';

describe('Platform Health, Readiness Probes & Lifecycle Hardening', () => {
  const testDbPath = path.join(process.cwd(), 'data', 'test-health-lifecycle.db');

  beforeEach(() => {
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch {}
    }
  });

  afterEach(() => {
    if (fs.existsSync(testDbPath)) {
      try {
        fs.unlinkSync(testDbPath);
      } catch {}
    }
  });

  const createDummyDeps = (db: IDatabaseManager): AppDependencies => {
    const mockGitlab = {
      authenticateUser: async () => null,
      getCurrentUser: async () => ({ id: 1, username: 'testuser', email: 'test@example.com', name: 'Test User' }),
      getUserGroups: async () => [],
      getGroupProjects: async () => [],
      validateGroupPath: async () => ({ id: 1, name: 'Core', path: 'platform/core', full_path: 'platform/core' }),
    } as any;

    const mockLdap = {
      authenticate: async () => ({ id: '1', username: 'testuser', email: 'test@example.com', name: 'Test', memberOf: [] }),
      getUserGroups: async () => [],
    } as any;

    const mockKro = {} as any;
    const mockMetrics = {
      getBuildResourceUsage: async () => ({ cpu: { usagePercent: 10, limitCores: '2', usedCores: '0.2' }, memory: { usagePercent: 20, limitBytes: 1024, usedBytes: 200 } }),
    } as any;
    const mockLogs = {
      streamKpackLogs: async () => {},
    } as any;

    return {
      dbManager: db,
      gitlabService: mockGitlab,
      ldapService: mockLdap,
      kroService: mockKro,
      metricsService: mockMetrics,
      logStreamingService: mockLogs,
    };
  };

  describe('SqliteDatabaseManager Health Check', () => {
    it('returns healthy status with measured latency on active database', async () => {
      const sqlite = new SqliteDatabaseManager(testDbPath);
      const health = await sqlite.checkHealth();

      expect(health.healthy).toBe(true);
      expect(typeof health.latencyMs).toBe('number');
      expect(health.latencyMs).toBeGreaterThanOrEqual(0);
      expect(health.error).toBeUndefined();

      sqlite.closeSync();
    });

    it('returns unhealthy status with error details when sqlite connection is closed', async () => {
      const sqlite = new SqliteDatabaseManager(testDbPath);
      sqlite.closeSync();

      const health = await sqlite.checkHealth();
      expect(health.healthy).toBe(false);
      expect(typeof health.latencyMs).toBe('number');
      expect(health.error).toBeDefined();
    });
  });

  describe('PostgresDatabaseManager Health Check', () => {
    it('returns healthy status when PostgreSQL pool query succeeds', async () => {
      const mockPool = {
        query: vi.fn().mockResolvedValue({ rows: [{ alive: 1 }] }),
        end: vi.fn().mockResolvedValue(undefined),
      };

      const pgManager = new PostgresDatabaseManager(mockPool as any);
      const health = await pgManager.checkHealth();

      expect(health.healthy).toBe(true);
      expect(typeof health.latencyMs).toBe('number');
      expect(mockPool.query).toHaveBeenCalledWith('SELECT 1 as alive');
    });

    it('returns unhealthy status when PostgreSQL pool query rejects', async () => {
      const mockPool = {
        query: vi.fn().mockRejectedValue(new Error('Connection terminated unexpectedly')),
        end: vi.fn().mockResolvedValue(undefined),
      };

      const pgManager = new PostgresDatabaseManager(mockPool as any);
      const health = await pgManager.checkHealth();

      expect(health.healthy).toBe(false);
      expect(health.error).toContain('Connection terminated unexpectedly');
    });
  });

  describe('HTTP Health & Readiness Probe Endpoints', () => {
    it('GET /api/health/live returns 200 confirming process liveness', async () => {
      const db = new DatabaseManager(testDbPath);
      const app = createApp(createDummyDeps(db));

      const res = await request(app).get('/api/health/live');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.check).toBe('liveness');
      expect(res.body.timestamp).toBeDefined();

      await db.close();
    });

    it('GET /api/health/ready returns 200 when database is healthy', async () => {
      const db = new DatabaseManager(testDbPath);
      const app = createApp(createDummyDeps(db));

      const res = await request(app).get('/api/health/ready');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.check).toBe('readiness');
      expect(res.body.database.healthy).toBe(true);
      expect(res.body.database.latencyMs).toBeGreaterThanOrEqual(0);

      await db.close();
    });

    it('GET /api/health/ready returns 503 when database is unhealthy', async () => {
      const failingDb: Partial<IDatabaseManager> = {
        checkHealth: async () => ({ healthy: false, latencyMs: 12.5, error: 'DB connection refused' }),
      };
      const app = createApp(createDummyDeps(failingDb as IDatabaseManager));

      const res = await request(app).get('/api/health/ready');
      expect(res.status).toBe(503);
      expect(res.body.status).toBe('unhealthy');
      expect(res.body.check).toBe('readiness');
      expect(res.body.database.healthy).toBe(false);
      expect(res.body.database.error).toBe('DB connection refused');
    });

    it('GET /api/health performs readiness check by default returning 200 with component details', async () => {
      const db = new DatabaseManager(testDbPath);
      const app = createApp(createDummyDeps(db));

      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.components.database.status).toBe('up');
      expect(res.body.components.database.latencyMs).toBeGreaterThanOrEqual(0);

      await db.close();
    });

    it('GET /api/health returns 503 with component database down when check fails', async () => {
      const failingDb: Partial<IDatabaseManager> = {
        checkHealth: async () => ({ healthy: false, latencyMs: 5.1, error: 'Database is locked' }),
      };
      const app = createApp(createDummyDeps(failingDb as IDatabaseManager));

      const res = await request(app).get('/api/health');
      expect(res.status).toBe(503);
      expect(res.body.status).toBe('unhealthy');
      expect(res.body.components.database.status).toBe('down');
      expect(res.body.components.database.error).toBe('Database is locked');
    });

    it('GET /api/health?probe=live returns 200 without failing even if database is down', async () => {
      const failingDb: Partial<IDatabaseManager> = {
        checkHealth: async () => ({ healthy: false, latencyMs: 0, error: 'Fatal DB crash' }),
      };
      const app = createApp(createDummyDeps(failingDb as IDatabaseManager));

      const res = await request(app).get('/api/health?probe=live');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });
});

