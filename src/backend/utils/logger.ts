export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
export type LogFormat = 'json' | 'pretty';

export interface LogRecord {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  [key: string]: any;
}

export interface LoggerOptions {
  level?: LogLevel;
  format?: LogFormat;
  service?: string;
  defaultMeta?: Record<string, any>;
  outStream?: { write: (str: string) => any };
  errStream?: { write: (str: string) => any };
}

const LEVEL_SEVERITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const SENSITIVE_KEYS = new Set([
  'authorization',
  'cookie',
  'set-cookie',
  'password',
  'token',
  'secret',
  'clientsecret',
  'bindpassword',
  'sessionsecret',
]);

export function sanitizeMetadata(obj: any, depth = 0): any {
  if (depth > 5 || obj === null || obj === undefined) return obj;

  if (obj instanceof Error) {
    return {
      message: obj.message,
      name: obj.name,
      stack: obj.stack,
      ...(obj as any),
    };
  }

  if (Array.isArray(obj)) {
    return obj.map((item) => sanitizeMetadata(item, depth + 1));
  }

  if (typeof obj === 'object') {
    const cleaned: Record<string, any> = {};
    for (const [k, v] of Object.entries(obj)) {
      if (SENSITIVE_KEYS.has(k.toLowerCase())) {
        cleaned[k] = '[REDACTED]';
      } else if (typeof v === 'object' && v !== null) {
        cleaned[k] = sanitizeMetadata(v, depth + 1);
      } else {
        cleaned[k] = v;
      }
    }
    return cleaned;
  }

  return obj;
}

export class Logger {
  public level: LogLevel;
  public format: LogFormat;
  public service: string;
  private defaultMeta: Record<string, any>;
  private outStream: { write: (str: string) => any };
  private errStream: { write: (str: string) => any };

  constructor(options: LoggerOptions = {}) {
    this.level = options.level || (process.env.LOG_LEVEL as LogLevel) || 'info';
    this.format = options.format || (process.env.LOG_FORMAT as LogFormat) || 'json';
    this.service = options.service || 'platform-backend';
    this.defaultMeta = options.defaultMeta || {};
    this.outStream = options.outStream || process.stdout;
    this.errStream = options.errStream || process.stderr;
  }

  public shouldLog(level: LogLevel): boolean {
    const minSeverity = LEVEL_SEVERITY[this.level] ?? LEVEL_SEVERITY.info;
    const currentSeverity = LEVEL_SEVERITY[level] ?? LEVEL_SEVERITY.info;
    return currentSeverity >= minSeverity;
  }

  public log(level: LogLevel, message: string, meta: Record<string, any> = {}): void {
    if (!this.shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    const sanitized = sanitizeMetadata({ ...this.defaultMeta, ...meta });

    if (this.format === 'json') {
      const record: LogRecord = {
        timestamp,
        level,
        service: this.service,
        message,
        ...sanitized,
      };
      const line = JSON.stringify(record) + '\n';
      if (level === 'error') {
        this.errStream.write(line);
      } else {
        this.outStream.write(line);
      }
    } else {
      // Human-readable pretty format for local dev
      const prefix = `[${timestamp}] [${level.toUpperCase()}] (${this.service})`;
      const metaKeys = Object.keys(sanitized);
      const metaStr = metaKeys.length > 0 ? ' ' + JSON.stringify(sanitized) : '';
      const line = `${prefix} ${message}${metaStr}\n`;
      if (level === 'error') {
        this.errStream.write(line);
      } else {
        this.outStream.write(line);
      }
    }
  }

  public debug(message: string, meta?: Record<string, any>): void {
    this.log('debug', message, meta);
  }

  public info(message: string, meta?: Record<string, any>): void {
    this.log('info', message, meta);
  }

  public warn(message: string, meta?: Record<string, any>): void {
    this.log('warn', message, meta);
  }

  public error(message: string, meta?: Record<string, any>): void {
    this.log('error', message, meta);
  }

  public child(meta: Record<string, any>): Logger {
    return new Logger({
      level: this.level,
      format: this.format,
      service: this.service,
      defaultMeta: { ...this.defaultMeta, ...meta },
      outStream: this.outStream,
      errStream: this.errStream,
    });
  }
}

export const defaultLogger = new Logger();
