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
  const dbManager = new DatabaseManager(config.database);
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

  server.on('error', async (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.error(`Port ${config.server.port} is already in use. Please terminate existing processes or configure another port.`);
    } else {
      console.error(`HTTP Server encountered an error: ${err.message}`);
    }
    try {
      await dbManager.close();
    } catch (closeErr: any) {
      console.error(`Error closing database on server error: ${closeErr.message}`);
    }
    process.exit(1);
  });

  const gracefulShutdown = async (signal: string) => {
    console.log(`Received ${signal}, closing server gracefully...`);

    // Force close after 5 seconds if still pending
    const forceTimeout = setTimeout(() => {
      console.error('Forcefully terminating process after timeout.');
      process.exit(1);
    }, 5000);
    if (typeof forceTimeout.unref === 'function') {
      forceTimeout.unref();
    }

    server.close(async () => {
      console.log('HTTP server closed.');
      try {
        await dbManager.close();
        console.log('Database connection closed.');
      } catch (err: any) {
        console.error(`Error closing database during shutdown: ${err.message}`);
      }
      clearTimeout(forceTimeout);
      process.exit(0);
    });
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
