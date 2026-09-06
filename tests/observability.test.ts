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
import { createObservabilityRouter, createFleetRouter } from '../src/backend/routes/observability.js';

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

  it('parses Kubernetes CPU and Memory quantities with numeric and edge case inputs safely', () => {
    expect(parseCpuQuantity(2)).toBe(2);
    expect(parseCpuQuantity(0)).toBe(0);
    expect(parseCpuQuantity(undefined)).toBe(0);
    expect(parseCpuQuantity('')).toBe(0);

    expect(parseMemoryQuantity(1048576)).toBe(1048576);
    expect(parseMemoryQuantity(0)).toBe(0);
    expect(parseMemoryQuantity(undefined)).toBe(0);
    expect(parseMemoryQuantity('')).toBe(0);
    expect(parseMemoryQuantity('1Ti')).toBe(1024 * 1024 * 1024 * 1024);
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

  it('gracefully falls back to pod limits and zero usage when getPodMetrics rejects', async () => {
    const failingClient: IMetricsClient = {
      getPodMetrics: async () => {
        throw new Error('metrics.k8s.io 404 Not Found');
      },
      getPodLimits: async () => ({
        cpuLimit: '4',
        memLimit: '8Gi',
      }),
    };
    const service = new MetricsService(failingClient);

    const usage = await service.getBuildResourceUsage('default', 'offline-pod');

    expect(usage.podName).toBe('offline-pod');
    expect(usage.cpuUsedCores).toBe(0);
    expect(usage.cpuLimitCores).toBe(4);
    expect(usage.cpuPercent).toBe(0);
    expect(usage.memoryUsedBytes).toBe(0);
    expect(usage.memoryLimitBytes).toBe(8 * 1024 * 1024 * 1024);
    expect(usage.memoryPercent).toBe(0);
  });

  it('gracefully falls back to default limits when both metrics and limits reject', async () => {
    const completelyFailingClient: IMetricsClient = {
      getPodMetrics: async () => {
        throw new Error('K8s connection error');
      },
      getPodLimits: async () => {
        throw new Error('K8s connection error');
      },
    };
    const service = new MetricsService(completelyFailingClient);

    const usage = await service.getBuildResourceUsage('default', 'offline-pod');

    expect(usage.cpuUsedCores).toBe(0);
    expect(usage.cpuLimitCores).toBe(2);
    expect(usage.cpuPercent).toBe(0);
    expect(usage.memoryUsedBytes).toBe(0);
    expect(usage.memoryLimitBytes).toBe(4 * 1024 * 1024 * 1024);
    expect(usage.memoryPercent).toBe(0);
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
    expect(res.headers['x-accel-buffering']).toBe('no');

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
    app.use('/api/fleet', createFleetRouter());

    const statusRes = await request(app).get('/api/repos/payment-service/pipeline-status');
    expect(statusRes.status).toBe(200);
    expect(statusRes.body.steps).toHaveLength(4);
    expect(statusRes.body.steps[0].id).toBe('kro');
    expect(statusRes.body.steps[1].id).toBe('eventsource');
    expect(statusRes.body.steps[2].id).toBe('workflow');
    expect(statusRes.body.steps[3].id).toBe('kpack');

    const fleetRes = await request(app).get('/api/fleet/health');
    expect(fleetRes.status).toBe(200);
    expect(fleetRes.body.fleetHealth).toBe('healthy');
    expect(fleetRes.body.teamsActivity).toBeInstanceOf(Array);
  });

  it('aborts log streaming cleanly when client disconnects', async () => {
    const mockLogSource = new MockLogSource();
    const logService = new LogStreamingService(mockLogSource);

    const EventEmitter = (await import('node:events')).EventEmitter;
    const fakeRes: any = new EventEmitter();
    fakeRes.setHeader = () => {};
    fakeRes.write = () => true;
    fakeRes.end = () => {};
    fakeRes.writableEnded = false;

    // Trigger close immediately after start
    const streamPromise = logService.streamKpackLogs('default', 'test-repo', fakeRes, 50);
    fakeRes.emit('close');

    await expect(streamPromise).resolves.toBeUndefined();
  });
});

