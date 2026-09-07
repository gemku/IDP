import { describe, it, expect } from 'vitest';
import { Logger, sanitizeMetadata } from '../src/backend/utils/logger.js';

describe('Structured Logger Utility', () => {
  it('emits valid JSON logs with mandatory envelope properties', () => {
    let captured = '';
    const mockStream = {
      write: (str: string) => {
        captured += str;
        return true;
      },
    };

    const logger = new Logger({
      level: 'info',
      format: 'json',
      service: 'test-service',
      outStream: mockStream,
    });

    logger.info('User onboarded successfully', { userId: 42, team: 'Core' });

    expect(captured).toContain('\n');
    const parsed = JSON.parse(captured.trim());
    expect(parsed.service).toBe('test-service');
    expect(parsed.level).toBe('info');
    expect(parsed.message).toBe('User onboarded successfully');
    expect(parsed.userId).toBe(42);
    expect(parsed.team).toBe('Core');
    expect(typeof parsed.timestamp).toBe('string');
    expect(new Date(parsed.timestamp).toString()).not.toBe('Invalid Date');
  });

  it('routes error level logs to errStream with error stack serialization', () => {
    let errCaptured = '';
    let outCaptured = '';
    const mockOut = { write: (str: string) => { outCaptured += str; return true; } };
    const mockErr = { write: (str: string) => { errCaptured += str; return true; } };

    const logger = new Logger({
      level: 'debug',
      format: 'json',
      outStream: mockOut,
      errStream: mockErr,
    });

    const error = new Error('Database connection failed');
    logger.error('Failed to connect to cluster database', { err: error, attempt: 3 });

    expect(outCaptured).toBe('');
    expect(errCaptured).not.toBe('');
    const parsed = JSON.parse(errCaptured.trim());
    expect(parsed.level).toBe('error');
    expect(parsed.message).toBe('Failed to connect to cluster database');
    expect(parsed.err.message).toBe('Database connection failed');
    expect(parsed.err.stack).toBeDefined();
    expect(parsed.attempt).toBe(3);
  });

  it('suppresses logs below the configured severity threshold', () => {
    let captured = '';
    const mockStream = { write: (str: string) => { captured += str; return true; } };

    const logger = new Logger({
      level: 'warn',
      format: 'json',
      outStream: mockStream,
    });

    logger.debug('Verbose tracing detail');
    logger.info('Standard operational progress');
    expect(captured).toBe('');

    logger.warn('Resource threshold warning');
    expect(captured).toContain('Resource threshold warning');
  });

  it('automatically redacts sensitive credentials and authentication tokens', () => {
    const raw = {
      user: 'alice',
      authorization: 'Bearer secret-gitlab-token-12345',
      cookie: 'connect.sid=s%3AsecretCookieSession',
      password: 'SuperSecretPassword!',
      nested: {
        token: 'glpat-token-999',
        normalField: 'visible-value',
      },
    };

    const sanitized = sanitizeMetadata(raw);
    expect(sanitized.user).toBe('alice');
    expect(sanitized.authorization).toBe('[REDACTED]');
    expect(sanitized.cookie).toBe('[REDACTED]');
    expect(sanitized.password).toBe('[REDACTED]');
    expect(sanitized.nested.token).toBe('[REDACTED]');
    expect(sanitized.nested.normalField).toBe('visible-value');
  });

  it('supports child loggers with inherited default metadata', () => {
    let captured = '';
    const mockStream = { write: (str: string) => { captured += str; return true; } };

    const parentLogger = new Logger({
      level: 'info',
      format: 'json',
      defaultMeta: { environment: 'test' },
      outStream: mockStream,
    });

    const childLogger = parentLogger.child({ module: 'kro-service', repoId: 101 });
    childLogger.info('KRO graph provisioned');

    const parsed = JSON.parse(captured.trim());
    expect(parsed.environment).toBe('test');
    expect(parsed.module).toBe('kro-service');
    expect(parsed.repoId).toBe(101);
    expect(parsed.message).toBe('KRO graph provisioned');
  });

  it('formats human-readable string lines in pretty mode', () => {
    let captured = '';
    const mockStream = { write: (str: string) => { captured += str; return true; } };

    const logger = new Logger({
      level: 'info',
      format: 'pretty',
      service: 'platform-backend',
      outStream: mockStream,
    });

    logger.info('Server boot sequence completed', { port: 3000 });
    expect(captured).toContain('[INFO]');
    expect(captured).toContain('(platform-backend)');
    expect(captured).toContain('Server boot sequence completed');
    expect(captured).toContain('"port":3000');
  });
});
