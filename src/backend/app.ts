import express, { Express, RequestHandler } from 'express';
import cors from 'cors';
import { DatabaseManager } from './db.js';
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
import { AppConfig } from './config.js';

export interface AppDependencies {
  config?: AppConfig;
  dbManager: DatabaseManager;
  gitlabService: IGitLabService;
  ldapService: ILdapService;
  kroService: KroService;
  metricsService: MetricsService;
  logStreamingService: LogStreamingService;
}

export function createApp(deps: AppDependencies, preMiddleware?: RequestHandler): Express {
  const app = express();

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

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  return app;
}

