import { describe, it, expect } from 'vitest';
import express, { Express } from 'express';
import request from 'supertest';
import {
  MetricsService,
  parseCpuQuantity,
  parseMemoryQuantity,
  IMetricsClient,
} from '../src/backend/services/metricsService.js';
import {
  LogStreamingService,
  MockLogSource,
} from '../src/backend/services/logStreamingService.js';
import { createObservabilityRouter } from '../src/backend/routes/observability.js';

class MockMetricsClient implements IMetricsClient {
  public async getPodMetrics(namespace: string, podName: string) {
    return {
      containers: [
        {
          name: 'step-build',
          usage: {
            cpu: '500m',
            memory: '1024Mi',
          },
        },
      ],
    };
  }

  public async getPodLimits(namespace: string, podName: string) {
    return {
      cpuLimit: '2',
      memLimit: '4Gi',
    };
  }
}

describe('Observability Services and Endpoints', () => {
  it('parses Kubernetes CPU quantities with core and millicore formats', () => {
    expect(parseCpuQuantity('500m')).toBe(0.5);
    expect(parseCpuQuantity('2500m')).toBe(2.5);
    expect(parseCpuQuantity('2')).toBe(2);
    expect(parseCpuQuantity('1.5')).toBe(1.5);
  });

  it('parses Kubernetes Memory quantities with Ki, Mi, Gi formats', () => {
    expect(parseMemoryQuantity('1024Mi')).toBe(1024 * 1024 * 1024);
    expect(parseMemoryQuantity('4Gi')).toBe(4 * 1024 * 1024 * 1024);
    expect(parseMemoryQuantity('512Ki')).toBe(512 * 1024);
  });

  it('calculates accurate CPU and Memory utilization percentages against pod limits', async () => {
    const mockClient = new MockMetricsClient();
    const service = new MetricsService(mockClient);

    const usage = await service.getBuildResourceUsage('default', 'test-build-pod');

    expect(usage.cpuLimitCores).toBe(2);
    expect(usage.cpuUsedCores).toBe(0.5);
    expect(usage.cpuPercent).toBe(25); // 0.5 / 2 = 25%

    expect(usage.memoryLimitBytes).toBe(4 * 1024 * 1024 * 1024);
    expect(usage.memoryUsedBytes).toBe(1024 * 1024 * 1024);
    expect(usage.memoryPercent).toBe(25); // 1Gi / 4Gi = 25%
  });

  it('streams sequential Kpack initContainer logs (detect, build, export) via SSE', async () => {
    const mockLogSource = new MockLogSource();
    const logService = new LogStreamingService(mockLogSource);
    const metricsService = new MetricsService(new MockMetricsClient());

    const app = express();
    app.use((req, res, next) => {
      (req as any).mockUser = {
        gitlabUser: { username: 'alice' },
        activeTeams: [{ id: 1, name: 'Platform' }],
      };
      next();
    });

    app.use('/api/repos', createObservabilityRouter(logService, metricsService));

    const res = await request(app).get('/api/repos/payment-service/logs');
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/event-stream');

    const body = res.text;
    expect(body).toContain('event: start');
    expect(body).toContain('event: phase');
    expect(body).toContain('"phase":"detect"');
    expect(body).toContain('"phase":"build"');
    expect(body).toContain('"phase":"export"');
    expect(body).toContain('event: complete');
    expect(body).toContain('"status":"succeeded"');
  });

  it('returns fleet health and 4-step pipeline status metrics', async () => {
    const mockLogSource = new MockLogSource();
    const logService = new LogStreamingService(mockLogSource);
    const metricsService = new MetricsService(new MockMetricsClient());

    const app = express();
    app.use((req, res, next) => {
      (req as any).mockUser = {
        gitlabUser: { username: 'alice' },
        activeTeams: [{ id: 1, name: 'Platform' }],
      };
      next();
    });

    app.use('/api/repos', createObservabilityRouter(logService, metricsService));

    const statusRes = await request(app).get('/api/repos/payment-service/pipeline-status');
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.steps).toHaveLength(4);
    expect(statusRes.body.steps[0].id).toBe('kro');
    expect(statusRes.body.steps[1].id).toBe('eventsource');
    expect(statusRes.body.steps[2].id).toBe('workflow');
    expect(statusRes.body.steps[3].id).toBe('kpack');
  });
});

