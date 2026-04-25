export type LogLevel = 'none' | 'error' | 'warn' | 'info' | 'debug';

import { CloudWatchLogger, CloudWatchConfig, LogEntry } from './logging/cloudwatch';

const LOG_LEVEL_PRIORITY: Record<LogLevel, number> = {
  none: 0,
  error: 1,
  warn: 2,
  info: 3,
  debug: 4,
};

/**
 * Internal logger utility for the Axionvera SDK.
 * Supports different log levels, automatic redaction of sensitive data, and optional CloudWatch integration.
 */
export class Logger {
  private level: LogLevel;
  private cloudWatchLogger: CloudWatchLogger | null = null;

  constructor(level: LogLevel = 'none', cloudWatchConfig?: CloudWatchConfig) {
    this.level = level;
    
    // Initialize CloudWatch logger if config is provided
    if (cloudWatchConfig) {
      this.cloudWatchLogger = new CloudWatchLogger(cloudWatchConfig);
    }
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVEL_PRIORITY[level] <= LOG_LEVEL_PRIORITY[this.level] && this.level !== 'none';
  }

  /**
   * Recursively redacts sensitive information from messages and objects.
   * Also truncates large XDR strings to prevent log bloat.
   */
  private redact(message: any): any {
    const sensitiveKeys = [
      'authorization', 'api-key', 'apikey',
      'secret', 'secretkey', 'secret_key', 'secretaccesskey',
      'passphrase', 'networkpassphrase',
      'password',
      'token',
      'x-api-key',
      'privatekey', 'private_key',
    ];

    /** Maximum length before an XDR-like base64 string is truncated in logs. */
    const XDR_TRUNCATE_LENGTH = 200;

    if (typeof message === 'string') {
      let redacted = message
        .replace(/Bearer\s+[a-zA-Z0-9\-\._~+/]+=*/gi, 'Bearer [REDACTED]')
        .replace(/(api[_-]?key|secret[_-]?key|password|token|private[_-]?key)["']?\s*[:=]\s*["']?([a-zA-Z0-9\-_.]+)["']?/gi, '$1: [REDACTED]');

      // Truncate suspiciously large base64/XDR blobs to avoid log bloat
      if (redacted.length > XDR_TRUNCATE_LENGTH && /^[A-Za-z0-9+/=]+$/.test(redacted.trim())) {
        redacted = `${redacted.slice(0, XDR_TRUNCATE_LENGTH)}…[TRUNCATED]`;
      }

      return redacted;
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

  private async sendToCloudWatch(level: 'DEBUG' | 'INFO' | 'WARN' | 'ERROR', message: string, metadata?: any): Promise<void> {
    if (this.cloudWatchLogger) {
      try {
        const logEntry: LogEntry = {
          timestamp: Date.now(),
          message,
          level,
          metadata,
        };
        
        await this.cloudWatchLogger.log(logEntry);
      } catch (error) {
        // Fail silently to avoid interfering with main logging
        console.error('Failed to send log to CloudWatch:', error);
      }
    }
  }

  private logWithCloudWatch(consoleLevel: 'error' | 'warn' | 'info' | 'debug', logLevel: 'ERROR' | 'WARN' | 'INFO' | 'DEBUG', message: string, ...args: any[]): void {
    if (this.shouldLog(logLevel.toLowerCase() as LogLevel)) {
      const redactedMessage = this.redact(message);
      const redactedArgs = args.map((a) => this.redact(a));
      
      console[consoleLevel](`[Axionvera][${logLevel}] ${redactedMessage}`, ...redactedArgs);
      
      // Send to CloudWatch asynchronously
      this.sendToCloudWatch(logLevel, message, args.length > 0 ? args : undefined).catch(() => {});
    }
  }

  error(message: string, ...args: any[]): void {
    this.logWithCloudWatch('error', 'ERROR', message, ...args);
  }

  warn(message: string, ...args: any[]): void {
    this.logWithCloudWatch('warn', 'WARN', message, ...args);
  }

  info(message: string, ...args: any[]): void {
    this.logWithCloudWatch('info', 'INFO', message, ...args);
  }

  debug(message: string, ...args: any[]): void {
    this.logWithCloudWatch('debug', 'DEBUG', message, ...args);
  }

  /**
   * When logLevel is 'debug', parses a transaction XDR and logs a structured
   * JSON breakdown (sourceAccount, fee, operations) instead of the raw base64
   * blob. Wrapped in try/catch so a parse failure never blocks execution.
   *
   * @param label            - Human-readable label for the XDR (e.g. "deposit tx")
   * @param xdrString        - Base64-encoded transaction envelope XDR
   * @param networkPassphrase - The network passphrase used to build the transaction
   */
  debugXdr(label: string, xdrString: string, networkPassphrase?: string): void {
    if (!this.shouldLog('debug')) return;

    try {
      // Dynamic require keeps stellar-sdk out of the logger's static dependency graph.
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { TransactionBuilder } = require('@stellar/stellar-sdk');

      const candidates: string[] = networkPassphrase
        ? [networkPassphrase]
        : [
            'Test SDF Network ; September 2015',
            'Public Global Stellar Network ; September 2015',
            'Standalone Network ; February 2017',
          ];

      let tx: any;
      for (const passphrase of candidates) {
        try {
          tx = TransactionBuilder.fromXDR(xdrString, passphrase);
          break;
        } catch {
          // try next passphrase
        }
      }

      if (!tx) {
        this.debug(`[XDR: ${label}] Unable to parse — unknown network passphrase`);
        return;
      }

      const breakdown = {
        sourceAccount: tx.source,
        fee: tx.fee,
        operations: (tx.operations as any[]).map((op: any) => ({
          type: op.type,
          ...(op.contractId !== undefined && { contractId: op.contractId }),
          ...(op.func !== undefined && { func: String(op.func) }),
        })),
      };

      this.debug(`[XDR: ${label}]`, breakdown);
    } catch {
      // Never block main execution thread if XDR parsing fails.
    }
  }

  /**
   * Get CloudWatch logger statistics
   */
  getCloudWatchStats() {
    if (!this.cloudWatchLogger) {
      return {
        enabled: false,
        message: 'CloudWatch logging not configured'
      };
    }

    return {
      enabled: true,
      queueSize: this.cloudWatchLogger.getQueueSize(),
      isReady: this.cloudWatchLogger.isReady(),
    };
  }

  /**
   * Cleanup CloudWatch resources
   */
  async destroy(): Promise<void> {
    if (this.cloudWatchLogger) {
      await this.cloudWatchLogger.destroy();
      this.cloudWatchLogger = null;
    }
  }
}