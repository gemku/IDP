import 'dotenv/config';
import { loadConfig } from './config.js';
import { DatabaseManager } from './db.js';
import { GitLabService } from './services/gitlabService.js';
import { LdapService, MockLdapService } from './services/ldapService.js';
import { KroService } from './services/kroService.js';
import { MetricsService, IMetricsClient } from './services/metricsService.js';
import { LogStreamingService, MockLogSource } from './services/logStreamingService.js';
import { createApp } from './app.js';

class DefaultMetricsClient implements IMetricsClient {
  public async getPodMetrics(namespace: string, podName: string) {
    return { containers: [] };
  }
  public async getPodLimits(namespace: string, podName: string) {
    return { cpuLimit: '2', memLimit: '4Gi' };
  }
}

export function startServer() {
  const config = loadConfig();
  const dbManager = new DatabaseManager(config.server.databasePath);
  const gitlabService = new GitLabService(config.gitlab);
  const ldapService = process.env.NODE_ENV === 'test'
    ? new MockLdapService()
    : new LdapService(config.ldap);
  const kroService = new KroService(undefined, config.kubernetes);
  const metricsService = new MetricsService(new DefaultMetricsClient());
  const logStreamingService = new LogStreamingService(new MockLogSource());

  const app = createApp({
    config,
    dbManager,
    gitlabService,
    ldapService,
    kroService,
    metricsService,
    logStreamingService,
  });

  const server = app.listen(config.server.port, () => {
    console.log(`Internal Developer Platform listening on port ${config.server.port}`);
  });

  const gracefulShutdown = (signal: string) => {
    console.log(`Received ${signal}, closing server gracefully...`);
    server.close(() => {
      console.log('HTTP server closed.');
      dbManager.close();
      console.log('Database connection closed.');
      process.exit(0);
    });

    // Force close after 5 seconds if still pending
    setTimeout(() => {
      console.error('Forcefully terminating process after timeout.');
      process.exit(1);
    }, 5000);
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  return { app, server, dbManager };
}

// Start immediately if executed as main module
if (process.env.NODE_ENV !== 'test') {
  try {
    startServer();
  } catch (err: any) {
    console.error('Failed to start server:', err.message);
    process.exit(1);
  }
}
