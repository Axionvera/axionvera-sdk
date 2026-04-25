import { rpc, xdr } from '@stellar/stellar-sdk';
import type { StellarClient } from '../client/stellarClient';

export type ContractEvent = Omit<rpc.Api.EventResponse, 'contractId'> & {
  contractId?: string;
  topicNames: string[];
  eventName?: string;
};

export type ContractEventCallback = (event: ContractEvent) => void;

function topicToName(topic: xdr.ScVal): string | undefined {
  try {
    const kind = topic.switch().value;

    if (kind === xdr.ScValType.scvSymbol().value) {
      return topic.sym().toString();
    }

    if (kind === xdr.ScValType.scvString().value) {
      return topic.str().toString();
    }
  } catch {
    return undefined;
  }

  return undefined;
}

function normalizeEvent(event: rpc.Api.EventResponse): ContractEvent {
  const topicNames = (event.topic ?? [])
    .map((topic) => topicToName(topic))
    .filter((value): value is string => Boolean(value));

  return {
    ...event,
    contractId: event.contractId ? event.contractId.toString() : undefined,
    topicNames,
    eventName: topicNames[0],
  };
}

/**
 * Browser-friendly pub/sub bridge for polling Soroban contract events.
 */
export class ContractEventEmitter {
  private readonly client: StellarClient;
  private readonly contractId: string;
  private readonly topics: string[];
  private readonly pollingIntervalMs: number;
  private readonly onClose?: () => void;
  private readonly listeners = new Map<string, Set<ContractEventCallback>>();
  private interval: ReturnType<typeof setInterval> | null = null;
  private lastLedger: number | undefined;
  private lastCursor: string | undefined;
  private isPolling = false;
  private isClosed = false;

  constructor(
    client: StellarClient,
    contractId: string,
    topics: string[] = [],
    pollingIntervalMs = 5000,
    onClose?: () => void
  ) {
    this.client = client;
    this.contractId = contractId;
    this.topics = topics;
    this.pollingIntervalMs = pollingIntervalMs;
    this.onClose = onClose;
  }

  on(eventName: string, callback: ContractEventCallback): this {
    if (this.isClosed) {
      return this;
    }

    if (!this.listeners.has(eventName)) {
      this.listeners.set(eventName, new Set());
    }

    this.listeners.get(eventName)!.add(callback);
    this.start();
    return this;
  }

  addListener(eventName: string, callback: ContractEventCallback): this {
    return this.on(eventName, callback);
  }

  once(eventName: string, callback: ContractEventCallback): this {
    const wrapped: ContractEventCallback = (event) => {
      this.off(eventName, wrapped);
      callback(event);
    };

    return this.on(eventName, wrapped);
  }

  off(eventName: string, callback: ContractEventCallback): this {
    const listeners = this.listeners.get(eventName);
    if (listeners) {
      listeners.delete(callback);
      if (listeners.size === 0) {
        this.listeners.delete(eventName);
      }
    }

    if (this.listeners.size === 0) {
      this.close();
    }

    return this;
  }

  removeListener(eventName: string, callback: ContractEventCallback): this {
    return this.off(eventName, callback);
  }

  emit(eventName: string, event: ContractEvent): boolean {
    const listeners = [
      ...(this.listeners.get(eventName) ?? []),
      ...(this.listeners.get('event') ?? []),
      ...(this.listeners.get('*') ?? []),
    ];

    if (listeners.length === 0) {
      return false;
    }

    for (const listener of listeners) {
      try {
        listener(event);
      } catch (error) {
        this.client.logger.warn('Contract event listener failed', error);
      }
    }

    return true;
  }

  removeAllListeners(eventName?: string): this {
    if (eventName) {
      this.listeners.delete(eventName);
    } else {
      this.listeners.clear();
    }

    if (this.listeners.size === 0) {
      this.close();
    }

    return this;
  }

  listenerCount(eventName?: string): number {
    if (eventName) {
      return this.listeners.get(eventName)?.size ?? 0;
    }

    let total = 0;
    for (const listeners of this.listeners.values()) {
      total += listeners.size;
    }
    return total;
  }

  start(): void {
    if (this.isClosed || this.interval) {
      return;
    }

    this.interval = setInterval(() => {
      void this.poll();
    }, this.pollingIntervalMs);
  }

  stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  close(): void {
    if (this.isClosed) {
      return;
    }

    this.isClosed = true;
    this.stop();
    this.listeners.clear();
    this.onClose?.();
  }

  unsubscribe(): void {
    this.close();
  }

  private matchesTopics(event: ContractEvent): boolean {
    if (this.topics.length === 0) {
      return true;
    }

    const names = event.topicNames.length > 0
      ? event.topicNames
      : event.eventName
        ? [event.eventName]
        : [];

    return names.some((name) => this.topics.includes(name));
  }

  private async poll(): Promise<void> {
    if (this.isPolling || this.isClosed) {
      return;
    }

    this.isPolling = true;

    try {
      if (this.lastLedger === undefined && !this.lastCursor) {
        const latestLedger = await this.client.rpc.getLatestLedger();
        this.lastLedger = latestLedger.sequence;
      }

      const response = this.lastCursor
        ? await this.client.rpc.getEvents({
            cursor: this.lastCursor,
            filters: [{ type: 'contract', contractIds: [this.contractId] }],
          })
        : await this.client.rpc.getEvents({
            startLedger: this.lastLedger ?? 0,
            filters: [{ type: 'contract', contractIds: [this.contractId] }],
          });

      this.lastCursor = response.cursor;

      for (const event of response.events) {
        this.lastLedger = Math.max(this.lastLedger ?? event.ledger, event.ledger);

        const normalized = normalizeEvent(event);
        if (!this.matchesTopics(normalized)) {
          continue;
        }

        this.emit('event', normalized);
        this.emit('*', normalized);

        if (normalized.eventName) {
          this.emit(normalized.eventName, normalized);
          this.emit(`event:${normalized.eventName}`, normalized);
        }
      }
    } catch (error) {
      this.client.logger.error('ContractEventEmitter polling error', error);
    } finally {
      this.isPolling = false;
    }
  }
}
