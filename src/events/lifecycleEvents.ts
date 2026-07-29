import { TransactionLifecycleState } from '../lifecycle';

/** The kind of lifecycle event being emitted. */
export type LifecycleEventType = 'created' | 'transition' | 'completed' | 'failed';

/** Event payload emitted whenever a tracked transaction changes lifecycle state. */
export interface LifecycleEvent {
  type: LifecycleEventType;
  transactionId: string;
  previousState: TransactionLifecycleState | null;
  state: TransactionLifecycleState;
  timestamp: number;
  details?: Record<string, unknown>;
  error?: { name: string; message: string };
}

export type LifecycleEventListener = (event: LifecycleEvent) => void;

/** Optional filter applied when subscribing to lifecycle events. */
export interface LifecycleEventFilter {
  transactionId?: string;
  types?: LifecycleEventType[];
}

/**
 * Lightweight pub/sub for transaction lifecycle events, mirroring the
 * subscribe/dispatch pattern used by {@link EventDispatcher} for Soroban events.
 *
 * @example
 * ```typescript
 * const emitter = new LifecycleEventEmitter();
 * const id = emitter.subscribe((event) => console.log(event.type, event.state));
 * emitter.emit({ type: 'created', transactionId: 'tx1', previousState: null, state: TransactionLifecycleState.CREATED, timestamp: Date.now() });
 * emitter.unsubscribe(id);
 * ```
 */
export class LifecycleEventEmitter {
  private listeners = new Map<
    string,
    { listener: LifecycleEventListener; filter?: LifecycleEventFilter }
  >();
  private nextId = 0;

  subscribe(listener: LifecycleEventListener, filter?: LifecycleEventFilter): string {
    const id = `lifecycle-sub-${(++this.nextId).toString()}`;
    this.listeners.set(id, { listener, filter });
    return id;
  }

  unsubscribe(id: string): boolean {
    return this.listeners.delete(id);
  }

  emit(event: LifecycleEvent): number {
    let dispatched = 0;
    for (const { listener, filter } of this.listeners.values()) {
      if (!this.matchesFilter(event, filter)) continue;
      listener(event);
      dispatched++;
    }
    return dispatched;
  }

  getListenerCount(): number {
    return this.listeners.size;
  }

  private matchesFilter(event: LifecycleEvent, filter?: LifecycleEventFilter): boolean {
    if (!filter) return true;
    if (filter.transactionId && filter.transactionId !== event.transactionId) return false;
    if (filter.types?.length && !filter.types.includes(event.type)) return false;
    return true;
  }
}
