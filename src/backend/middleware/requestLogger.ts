import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { Logger, defaultLogger } from '../utils/logger.js';

export interface RequestLoggerOptions {
  logger?: Logger;
}

export function createRequestLoggerMiddleware(options: RequestLoggerOptions = {}) {
  const logger = options.logger || defaultLogger;

  return (req: Request, res: Response, next: NextFunction) => {
    const rawRequestId = req.headers['x-request-id'];
    const requestId =
      typeof rawRequestId === 'string' && rawRequestId.trim()
        ? rawRequestId.trim()
        : crypto.randomUUID();

    res.setHeader('X-Request-Id', requestId);
    (req as any).requestId = requestId;

    const startTime = process.hrtime.bigint();

    res.on('finish', () => {
      const endTime = process.hrtime.bigint();
      const durationMs = Number(endTime - startTime) / 1_000_000;

      // Filter routine 200 OK /api/health/live probes from info logging to prevent log pollution
      const isRoutineLiveProbe =
        (req.path === '/api/health/live' || req.originalUrl === '/api/health/live') &&
        res.statusCode === 200;

      if (isRoutineLiveProbe && !logger.shouldLog('debug')) {
        return;
      }

      const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
      const user =
        (req as any).user?.gitlabUser?.username ||
        (req as any).mockUser?.gitlabUser?.username;

      logger.log(
        level,
        `HTTP ${req.method} ${req.originalUrl || req.path} ${res.statusCode} in ${durationMs.toFixed(2)}ms`,
        {
          method: req.method,
          path: req.originalUrl || req.path,
          statusCode: res.statusCode,
          durationMs: Math.round(durationMs * 100) / 100,
          requestId,
          ip: req.ip || req.socket?.remoteAddress,
          userAgent: req.headers['user-agent'],
          ...(user ? { user } : {}),
        }
      );
    });

    next();
  };
}
