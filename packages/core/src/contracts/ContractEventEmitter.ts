import { StellarClient } from '../client/stellarClient';
import { rpc } from '@stellar/stellar-sdk';

export interface ContractEvent extends rpc.Api.EventResponse {}
export type EventCallback = (event: ContractEvent) => void;

/**
 * Event emitter for contract-specific events using a polling mechanism.
 * 
 * This class is designed to handle Soroban contract events by polling the RPC server
 * at regular intervals. It is particularly useful for environments where WebSockets
 * are not available or stable.
 * 
 * IMPORTANT: Always call removeAllListeners() or stop() when the emitter is no longer
 * needed to prevent memory leaks and orphaned intervals.
 */
export class ContractEventEmitter {
  private listeners: Map<string, Set<EventCallback>> = new Map();
  private interval: NodeJS.Timeout | null = null;
  private lastLedger: number | undefined;
  private isPolling: boolean = false;
  private readonly client: StellarClient;
  private readonly contractId: string;
  private readonly pollingInterval: number;

  /**
   * Creates a new ContractEventEmitter.
   * @param client - The StellarClient instance
   * @param contractId - The contract ID to monitor
   * @param pollingInterval - Polling interval in milliseconds (default: 5000)
   */
  constructor(client: StellarClient, contractId: string, pollingInterval: number = 5000) {
    this.client = client;
    this.contractId = contractId;
    this.pollingInterval = pollingInterval;
  }

  /**
   * Subscribes to events with a specific topic.
   * @param topic - The event topic to listen for (XDR string representation)
   * @param callback - The function to call when an event is received
   */
  public on(topic: string, callback: EventCallback): void {
    if (!this.listeners.has(topic)) {
      this.listeners.set(topic, new Set());
    }
    this.listeners.get(topic)!.add(callback);
    
    if (!this.interval) {
      this.start();
    }
  }

  /**
   * Unsubscribes from events with a specific topic.
   * @param topic - The event topic
   * @param callback - The callback to remove
   */
  public off(topic: string, callback: EventCallback): void {
    const topicListeners = this.listeners.get(topic);
    if (topicListeners) {
      topicListeners.delete(callback);
      if (topicListeners.size === 0) {
        this.listeners.delete(topic);
      }
    }

    if (this.listeners.size === 0) {
      this.stop();
    }
  }

  /**
   * Removes all listeners and stops polling.
   * This is critical for preventing memory leaks in React components.
   */
  public removeAllListeners(): void {
    this.listeners.clear();
    this.stop();
  }

  /**
   * Starts the polling process manually.
   * Automatically called by on() if not already running.
   */
  public start(): void {
    if (this.interval) return;
    this.interval = setInterval(() => this.poll(), this.pollingInterval);
  }

  /**
   * Stops the polling process manually.
   */
  public stop(): void {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private async poll(): Promise<void> {
    if (this.isPolling) return;
    this.isPolling = true;

    try {
      // If we don't have a starting ledger, get the latest one
      if (this.lastLedger === undefined) {
        const latestLedger = await this.client.rpc.getLatestLedger();
        this.lastLedger = latestLedger.sequence;
        this.isPolling = false;
        return;
      }

      const response = await this.client.rpc.getEvents({
        startLedger: this.lastLedger,
        filters: [
          {
            contractIds: [this.contractId],
            type: 'contract'
          }
        ]
      });

      if (response.events && response.events.length > 0) {
        for (const event of response.events) {
          // Process topics
          const eventTopics = event.topic || [];
          
          for (const topicXdr of eventTopics) {
            const topicKey = topicXdr.toXDR("base64");
            const listeners = this.listeners.get(topicKey);
            if (listeners) {
              listeners.forEach(cb => cb(event));
            }
          }

          // Wildcard listeners
          const wildcardListeners = this.listeners.get('*');
          if (wildcardListeners) {
            wildcardListeners.forEach(cb => cb(event));
          }

          this.lastLedger = Math.max(this.lastLedger, event.ledger);
        }
      }
    } catch (error) {
      // Log error but don't stop polling
      console.error('ContractEventEmitter polling error:', error);
    } finally {
      this.isPolling = false;
    }
  }
}
