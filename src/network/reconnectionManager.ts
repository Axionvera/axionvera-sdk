import { ReconnectionConfig, DEFAULT_RECONNECTION_CONFIG } from '../events';

export type ConnectionState = 'connected' | 'connecting' | 'disconnected' | 'reconnecting';

export type ConnectionCallback = (state: ConnectionState, attempt?: number) => void;

export class ReconnectionManager {
  private state: ConnectionState = 'disconnected';
  private attempts = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private listeners: Set<ConnectionCallback> = new Set();
  private config: ReconnectionConfig;

  constructor(config?: Partial<ReconnectionConfig>) {
    this.config = { ...DEFAULT_RECONNECTION_CONFIG, ...config };
  }

  getState(): ConnectionState {
    return this.state;
  }

  isConnected(): boolean {
    return this.state === 'connected';
  }

  onStateChange(callback: ConnectionCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  markConnected(): void {
    this.attempts = 0;
    this.clearTimer();
    this.transition('connected');
  }

  markDisconnected(): void {
    this.clearTimer();
    this.transition('disconnected');
  }

  scheduleReconnect(connectFn: () => Promise<void>): void {
    if (this.attempts >= this.config.maxAttempts) {
      this.transition('disconnected');
      return;
    }

    this.transition('reconnecting', this.attempts + 1);

    const delay = Math.min(
      this.config.baseDelay * Math.pow(2, this.attempts),
      this.config.maxDelay
    );

    this.timer = setTimeout(async () => {
      this.attempts++;
      try {
        await connectFn();
      } catch {
        this.scheduleReconnect(connectFn);
      }
    }, delay);
  }

  reset(): void {
    this.attempts = 0;
    this.clearTimer();
    this.transition('disconnected');
  }

  private transition(state: ConnectionState, attempt?: number): void {
    this.state = state;
    for (const listener of this.listeners) {
      try {
        listener(state, attempt);
      } catch {}
    }
  }

  private clearTimer(): void {
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
