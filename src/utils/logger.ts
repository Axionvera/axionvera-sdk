export type LogLevel = 'none' | 'error' | 'warn' | 'info' | 'debug';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  none: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

/**
 * Internal logger utility for the Axionvera SDK.
 * Supports different log levels and automatic redaction of sensitive data.
 */
export class Logger {
  private level: LogLevel;

  constructor(level: LogLevel = 'none') {
    this.level = level;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] <= LOG_LEVEL_PRIORITY[this.level] && this.level !== 'none';
  }

  /**
   * Recursively redacts sensitive information from messages and objects.
   */
  private redact(message: any): any {
    const sensitiveKeys = ['authorization', 'api-key', 'apikey', 'secret', 'password', 'token', 'x-api-key', 'privatekey', 'private_key'];

    if (typeof message === 'string') {
      return message
        .replace(/Bearer\s+[a-zA-Z0-9\-\._~+/]+=*/gi, 'Bearer [REDACTED]')
        .replace(/(api[_-]?key|secret[_-]?key|password|token|private[_-]?key)["']?\s*[:=]\s*["']?([a-zA-Z0-9\-_.]+)["']?/gi, '$1: [REDACTED]');
    }

    if (typeof message === 'object' && message !== null) {
      if (message instanceof Error) {
        const redacted: any = {
          name: message.name,
          message: this.redact(message.message),
          stack: message.stack ? this.redact(message.stack) : undefined,
        };

        // Ensure any custom enumerable properties on the Error object are also redacted
        for (const key in message) {
          if (Object.prototype.hasOwnProperty.call(message, key) && !['name', 'message', 'stack'].includes(key)) {
            if (sensitiveKeys.includes(key.toLowerCase())) {
              redacted[key] = '[REDACTED]';
            } else if (typeof (message as any)[key] === 'object' && (message as any)[key] !== null) {
              redacted[key] = this.redact((message as any)[key]);
            } else {
              redacted[key] = (message as any)[key];
            }
          }
        }
        return redacted;
      }

      const redacted: any = Array.isArray(message) ? [] : {};

      for (const key in message) {
        if (Object.prototype.hasOwnProperty.call(message, key)) {
          if (sensitiveKeys.includes(key.toLowerCase())) {
            redacted[key] = '[REDACTED]';
          } else if (typeof message[key] === 'object' && message[key] !== null) {
            redacted[key] = this.redact(message[key]);
          } else {
            redacted[key] = message[key];
          }
        }
      }
      return redacted;
    }

    return message;
  }

  error(message: string, ...args: any[]): void {
    if (this.shouldLog('error')) {
      console.error(`[Axionvera][ERROR] ${this.redact(message)}`, ...args.map((a) => this.redact(a)));
    }
  }

  warn(message: string, ...args: any[]): void {
    if (this.shouldLog('warn')) {
      console.warn(`[Axionvera][WARN] ${this.redact(message)}`, ...args.map((a) => this.redact(a)));
    }
  }

  info(message: string, ...args: any[]): void {
    if (this.shouldLog('info')) {
      console.info(`[Axionvera][INFO] ${this.redact(message)}`, ...args.map((a) => this.redact(a)));
    }
  }

  debug(message: string, ...args: any[]): void {
    if (this.shouldLog('debug')) {
      console.debug(`[Axionvera][DEBUG] ${this.redact(message)}`, ...args.map((a) => this.redact(a)));
    }
  }
}