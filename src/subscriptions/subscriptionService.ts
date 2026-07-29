import { EventFilter, SorobanEvent, SubscriptionOptions } from '../events';
import { EventDispatcher } from '../events';
import { ReconnectionManager } from '../network';
import { WebSocketManager } from '../client';

export interface SubscriptionHandle {
  id: string;
  unsubscribe: () => void;
  eventCount: () => number;
}

export class SubscriptionService {
  private dispatcher = new EventDispatcher();
  private wsManager: WebSocketManager;
  private reconnection: ReconnectionManager;
  private cleanupTimers: Map<string, ReturnType<typeof setTimeout>> = new Map();

  constructor(rpcUrl: string) {
    this.reconnection = new ReconnectionManager();
    this.wsManager = new WebSocketManager(rpcUrl, {}, {
      onEvent: (event) => this.dispatcher.dispatch(event),
      onConnectionChange: (connected) => {
        if (connected) {
          this.reconnection.markConnected();
        } else {
          this.reconnection.markDisconnected();
          this.reconnection.scheduleReconnect(() => this.wsManager.connect());
        }
      },
    });
  }

  async start(): Promise<void> {
    await this.wsManager.connect();
  }

  subscribe(
    filter: EventFilter,
    callback: (event: SorobanEvent) => void,
    options?: SubscriptionOptions
  ): SubscriptionHandle {
    const id = this.dispatcher.subscribe(filter, callback);

    if (options?.maxEvents || options?.timeout) {
      this.scheduleCleanup(id, options);
    }

    return {
      id,
      unsubscribe: () => this.dispatcher.unsubscribe(id),
      eventCount: () => this.dispatcher.getEventCount(id),
    };
  }

  subscribeOnce(
    filter: EventFilter,
    callback: (event: SorobanEvent) => void
  ): SubscriptionHandle {
    let fired = false;
    const wrapped: (event: SorobanEvent) => void = (event) => {
      if (fired) return;
      fired = true;
      handle.unsubscribe();
      callback(event);
    };

    const handle = this.subscribe(filter, wrapped);
    return handle;
  }

  stop(): void {
    this.wsManager.disconnect();
    this.reconnection.reset();
    for (const timer of this.cleanupTimers.values()) {
      clearTimeout(timer);
    }
    this.cleanupTimers.clear();
  }

  isConnected(): boolean {
    return this.wsManager.isConnected();
  }

  onConnectionChange(callback: (state: string) => void): () => void {
    return this.reconnection.onStateChange((state) => callback(state));
  }

  private scheduleCleanup(id: string, options: SubscriptionOptions): void {
    if (options.timeout) {
      const timer = setTimeout(() => {
        this.dispatcher.unsubscribe(id);
        this.cleanupTimers.delete(id);
      }, options.timeout);
      this.cleanupTimers.set(id, timer);
    }
  }
}
