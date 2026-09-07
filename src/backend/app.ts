import express, { Express, RequestHandler } from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { IDatabaseManager } from './db.js';
import { IGitLabService } from './services/gitlabService.js';
import { ILdapService } from './services/ldapService.js';
import { KroService } from './services/kroService.js';
import { MetricsService } from './services/metricsService.js';
import { LogStreamingService } from './services/logStreamingService.js';
import { createAuthRouter } from './routes/auth.js';
import { createAdminRouter } from './routes/admin.js';
import { createReposRouter } from './routes/repos.js';
import { createTriggersRouter } from './routes/triggers.js';
import { createObservabilityRouter, createFleetRouter } from './routes/observability.js';
import { createBearerAuthMiddleware } from './middleware/authGuard.js';
import { createRequestLoggerMiddleware } from './middleware/requestLogger.js';
import { Logger, defaultLogger } from './utils/logger.js';
import { AppConfig } from './config.js';

export interface AppDependencies {
  config?: AppConfig;
  dbManager: IDatabaseManager;
  gitlabService: IGitLabService;
  ldapService: ILdapService;
  kroService: KroService;
  metricsService: MetricsService;
  logStreamingService: LogStreamingService;
  logger?: Logger;
}

export function createApp(deps: AppDependencies, preMiddleware?: RequestHandler): Express {
  const app = express();
  const logger = deps.logger || (deps.config ? new Logger(deps.config.logging) : defaultLogger);

  app.use(createRequestLoggerMiddleware({ logger }));
  app.use(cors());
  app.use(express.json());

  // Attach Bearer token authentication resolution
  app.use(createBearerAuthMiddleware(deps.gitlabService, deps.ldapService, deps.dbManager));

  if (preMiddleware) {
    app.use(preMiddleware);
  }

  // Mount API routers
  app.use('/api/auth', createAuthRouter(deps.gitlabService, deps.ldapService, deps.dbManager));
  app.use('/api/admin', createAdminRouter(deps.dbManager, deps.gitlabService));
  app.use('/api/repos', createReposRouter(deps.gitlabService));
  app.use('/api/repos', createTriggersRouter(deps.kroService, deps.gitlabService));
  app.use('/api/repos', createObservabilityRouter(deps.logStreamingService, deps.metricsService));
  app.use('/api/fleet', createFleetRouter());

  // Health & Lifecycle Probes
  // Liveness probe: verifies process is alive and responsive
  app.get('/api/health/live', (req, res) => {
    res.status(200).json({ status: 'ok', check: 'liveness', timestamp: new Date().toISOString() });
  });

  // Readiness probe: verifies database connectivity and platform readiness
  app.get('/api/health/ready', async (req, res) => {
    try {
      const dbHealth = await deps.dbManager.checkHealth();
      if (dbHealth.healthy) {
        res.status(200).json({
          status: 'ok',
          check: 'readiness',
          database: { healthy: true, latencyMs: dbHealth.latencyMs },
          timestamp: new Date().toISOString(),
        });
      } else {
        res.status(503).json({
          status: 'unhealthy',
          check: 'readiness',
          database: { healthy: false, latencyMs: dbHealth.latencyMs, error: dbHealth.error },
          timestamp: new Date().toISOString(),
        });
      }
    } catch (err: any) {
      res.status(503).json({
        status: 'unhealthy',
        check: 'readiness',
        database: { healthy: false, error: err.message || 'Health probe failed' },
        timestamp: new Date().toISOString(),
      });
    }
  });

  // Root health endpoint: deep readiness by default, supports ?probe=live
  app.get('/api/health', async (req, res) => {
    if (req.query.probe === 'live' || req.query.type === 'live') {
      res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
      return;
    }

    try {
      const dbHealth = await deps.dbManager.checkHealth();
      if (dbHealth.healthy) {
        res.status(200).json({
          status: 'ok',
          timestamp: new Date().toISOString(),
          components: {
            database: {
              status: 'up',
              latencyMs: dbHealth.latencyMs,
            },
          },
        });
      } else {
        res.status(503).json({
          status: 'unhealthy',
          timestamp: new Date().toISOString(),
          components: {
            database: {
              status: 'down',
              latencyMs: dbHealth.latencyMs,
              error: dbHealth.error,
            },
          },
        });
      }
    } catch (err: any) {
      res.status(503).json({
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        components: {
          database: {
            status: 'down',
            error: err.message || 'Health probe check failed',
          },
        },
      });
    }
  });

  // Serve static client assets in production if built
  const clientDist = path.resolve(process.cwd(), 'dist', 'client');
  if (fs.existsSync(clientDist)) {
    app.use(express.static(clientDist));
    app.use((req, res, next) => {
      if (req.method === 'GET' && !req.path.startsWith('/api')) {
        return res.sendFile(path.join(clientDist, 'index.html'));
      }
      next();
    });
  }

  // Global error-handling middleware
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (res.headersSent) {
      return next(err);
    }
    if (err instanceof SyntaxError && (err as any).status === 400 && 'body' in err) {
      res.status(400).json({ error: 'Invalid JSON payload' });
      return;
    }
    const statusCode = typeof err.status === 'number' && err.status >= 400 && err.status < 600 ? err.status : 500;
    res.status(statusCode).json({ error: err.message || 'Internal server error' });
  });

  return app;
}

