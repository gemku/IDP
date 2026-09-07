import 'dotenv/config';
import { loadConfig } from './config.js';
import { DatabaseManager } from './db.js';
import { GitLabService } from './services/gitlabService.js';
import { LdapService, MockLdapService } from './services/ldapService.js';
import { KroService } from './services/kroService.js';
import { MetricsService, IMetricsClient } from './services/metricsService.js';
import { LogStreamingService, MockLogSource } from './services/logStreamingService.js';
import { Logger } from './utils/logger.js';
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
  const logger = new Logger(config.logging);
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
    logger,
  });

  const server = app.listen(config.server.port, () => {
    logger.info(`Internal Developer Platform listening on port ${config.server.port}`, {
      port: config.server.port,
      logLevel: config.logging.level,
      logFormat: config.logging.format,
    });
  });

  server.on('error', async (err: any) => {
    if (err.code === 'EADDRINUSE') {
      logger.error(`Port ${config.server.port} is already in use. Please terminate existing processes or configure another port.`, {
        port: config.server.port,
        err,
      });
    } else {
      logger.error(`HTTP Server encountered an error: ${err.message}`, { err });
    }
    try {
      await dbManager.close();
    } catch (closeErr: any) {
      logger.error(`Error closing database on server error: ${closeErr.message}`, { err: closeErr });
    }
    process.exit(1);
  });

  const gracefulShutdown = async (signal: string) => {
    logger.info(`Received ${signal}, closing server gracefully...`, { signal });

    // Force close after 5 seconds if still pending
    const forceTimeout = setTimeout(() => {
      logger.error('Forcefully terminating process after timeout.', { signal });
      process.exit(1);
    }, 5000);
    if (typeof forceTimeout.unref === 'function') {
      forceTimeout.unref();
    }

    server.close(async () => {
      logger.info('HTTP server closed.', { signal });
      try {
        await dbManager.close();
        logger.info('Database connection closed.', { signal });
      } catch (err: any) {
        logger.error(`Error closing database during shutdown: ${err.message}`, { signal, err });
      }
      clearTimeout(forceTimeout);
      process.exit(0);
    });
  };

  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  return { app, server, dbManager, logger };
}

// Start immediately if executed as main module
if (process.env.NODE_ENV !== 'test') {
  try {
    startServer();
  } catch (err: any) {
    const fallbackLogger = new Logger();
    fallbackLogger.error(`Failed to start server: ${err.message}`, { err });
    process.exit(1);
  }
}
