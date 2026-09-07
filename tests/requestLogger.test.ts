import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { Logger } from '../src/backend/utils/logger.js';
import { createRequestLoggerMiddleware } from '../src/backend/middleware/requestLogger.js';

describe('Express Structured Request Logging Middleware', () => {
  it('emits structured JSON log and assigns X-Request-Id on completed HTTP requests', async () => {
    const logLines: string[] = [];
    const mockStream = {
      write: (str: string) => {
        logLines.push(str);
        return true;
      },
    };

    const logger = new Logger({
      level: 'info',
      format: 'json',
      service: 'platform-backend',
      outStream: mockStream,
    });

    const app = express();
    app.use(createRequestLoggerMiddleware({ logger }));
    app.get('/api/test-endpoint', (req, res) => {
      res.status(200).json({ success: true });
    });

    const res = await request(app).get('/api/test-endpoint');
    expect(res.status).toBe(200);
    expect(res.headers['x-request-id']).toBeDefined();

    expect(logLines.length).toBe(1);
    const parsed = JSON.parse(logLines[0].trim());
    expect(parsed.service).toBe('platform-backend');
    expect(parsed.level).toBe('info');
    expect(parsed.method).toBe('GET');
    expect(parsed.path).toBe('/api/test-endpoint');
    expect(parsed.statusCode).toBe(200);
    expect(parsed.requestId).toBe(res.headers['x-request-id']);
    expect(typeof parsed.durationMs).toBe('number');
  });

  it('preserves client-provided X-Request-Id correlation header', async () => {
    const logLines: string[] = [];
    const mockStream = {
      write: (str: string) => {
        logLines.push(str);
        return true;
      },
    };

    const logger = new Logger({
      level: 'info',
      format: 'json',
      outStream: mockStream,
    });

    const app = express();
    app.use(createRequestLoggerMiddleware({ logger }));
    app.get('/api/repos', (req, res) => {
      res.status(200).json([]);
    });

    const clientCorrelationId = 'client-trace-abc-123';
    const res = await request(app)
      .get('/api/repos')
      .set('x-request-id', clientCorrelationId);

    expect(res.headers['x-request-id']).toBe(clientCorrelationId);
    expect(logLines.length).toBe(1);
    const parsed = JSON.parse(logLines[0].trim());
    expect(parsed.requestId).toBe(clientCorrelationId);
  });

  it('filters routine 200 OK /api/health/live probes at info level but records them at debug level', async () => {
    const logLines: string[] = [];
    const mockStream = {
      write: (str: string) => {
        logLines.push(str);
        return true;
      },
    };

    const infoLogger = new Logger({
      level: 'info',
      format: 'json',
      outStream: mockStream,
    });

    const app = express();
    app.use(createRequestLoggerMiddleware({ logger: infoLogger }));
    app.get('/api/health/live', (req, res) => {
      res.status(200).json({ status: 'ok' });
    });

    // 1. Info level should suppress routine /api/health/live 200 probe
    await request(app).get('/api/health/live');
    expect(logLines.length).toBe(0);

    // 2. Debug level should log /api/health/live
    const debugLogger = new Logger({
      level: 'debug',
      format: 'json',
      outStream: mockStream,
    });

    const debugApp = express();
    debugApp.use(createRequestLoggerMiddleware({ logger: debugLogger }));
    debugApp.get('/api/health/live', (req, res) => {
      res.status(200).json({ status: 'ok' });
    });

    await request(debugApp).get('/api/health/live');
    expect(logLines.length).toBe(1);
    const parsed = JSON.parse(logLines[0].trim());
    expect(parsed.path).toBe('/api/health/live');
  });

  it('records 5xx server errors with error log level', async () => {
    const errLines: string[] = [];
    const mockErrStream = {
      write: (str: string) => {
        errLines.push(str);
        return true;
      },
    };

    const logger = new Logger({
      level: 'info',
      format: 'json',
      errStream: mockErrStream,
    });

    const app = express();
    app.use(createRequestLoggerMiddleware({ logger }));
    app.get('/api/failing', (req, res) => {
      res.status(503).json({ error: 'Service Unavailable' });
    });

    const res = await request(app).get('/api/failing');
    expect(res.status).toBe(503);
    expect(errLines.length).toBe(1);
    const parsed = JSON.parse(errLines[0].trim());
    expect(parsed.level).toBe('error');
    expect(parsed.statusCode).toBe(503);
  });
});
