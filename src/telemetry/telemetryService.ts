import { TelemetryConfig, TelemetryEvent, DEFAULT_TELEMETRY_CONFIG, MetricsSnapshot } from './types';
import { MetricsCollector } from '../metrics';

export type TelemetryFlushHandler = (events: TelemetryEvent[], snapshot: MetricsSnapshot) => void | Promise<void>;

export class TelemetryService {
  private config: TelemetryConfig;
  private events: TelemetryEvent[] = [];
  private metrics: MetricsCollector = new MetricsCollector();
  private flushTimer: ReturnType<typeof setInterval> | null = null;
  private flushHandler: TelemetryFlushHandler | null = null;
  private eventCounter = 0;

  constructor(config?: Partial<TelemetryConfig>) {
    this.config = { ...DEFAULT_TELEMETRY_CONFIG, ...config };
    if (this.config.enabled) {
      this.startFlushTimer();
    }
  }

  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    if (enabled) {
      this.startFlushTimer();
    } else {
      this.stopFlushTimer();
    }
  }

  isEnabled(): boolean {
    return this.config.enabled;
  }

  onFlush(handler: TelemetryFlushHandler): void {
    this.flushHandler = handler;
  }

  track(type: string, data: Record<string, any> = {}): void {
    if (!this.config.enabled) return;

    this.eventCounter++;
    const event: TelemetryEvent = {
      id: `${Date.now()}-${this.eventCounter}-${Math.random().toString(36).substring(2, 15)}`,
      type,
      timestamp: Date.now(),
      data: this.config.anonymize ? this.anonymize(data) : data,
      anonymized: this.config.anonymize,
    };

    this.events.push(event);

    if (this.events.length >= this.config.bufferSize) {
      this.flush();
    }
  }

  metrics(): MetricsCollector {
    return this.metrics;
  }

  getConfig(): TelemetryConfig {
    return { ...this.config };
  }

  updateConfig(updates: Partial<TelemetryConfig>): void {
    const wasEnabled = this.config.enabled;
    this.config = { ...this.config, ...updates };

    if (!wasEnabled && this.config.enabled) {
      this.startFlushTimer();
    } else if (wasEnabled && !this.config.enabled) {
      this.stopFlushTimer();
      this.flush();
    }
  }

  flush(): void {
    if (this.events.length === 0) return;

    const events = this.events.splice(0);
    const snapshot = this.metrics.snapshot();

    if (this.flushHandler) {
      try {
        const result = this.flushHandler(events, snapshot);
        if (result instanceof Promise) {
          result.catch(() => {});
        }
      } catch {}
    }
  }

  async destroy(): Promise<void> {
    this.stopFlushTimer();
    this.flush();
    this.metrics.clear();
  }

  private startFlushTimer(): void {
    this.stopFlushTimer();
    this.flushTimer = setInterval(() => this.flush(), this.config.flushIntervalMs);
  }

  private stopFlushTimer(): void {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = null;
    }
  }

  private anonymize(data: Record<string, any>): Record<string, any> {
    const sensitiveKeys = ['address', 'publicKey', 'email', 'userId', 'account'];
    const result: Record<string, any> = {};
    for (const [key, value] of Object.entries(data)) {
      if (sensitiveKeys.some((k) => key.toLowerCase().includes(k.toLowerCase()))) {
        result[key] = '[REDACTED]';
      } else if (typeof value === 'object' && value !== null) {
        result[key] = this.anonymize(value);
      } else {
        result[key] = value;
      }
    }
    return result;
  }
}

export const telemetryService = new TelemetryService();

