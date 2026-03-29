import { EventFilter, SorobanEvent, WebSocketEventSubscription, WebSocketConfig } from './types';

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private subscriptions: Map<string, WebSocketEventSubscription> = new Map();
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private isConnecting = false;
  private isDestroyed = false;

  private readonly config: Required<WebSocketConfig>;
  private readonly rpcUrl: string;
  private readonly onEvent?: (event: SorobanEvent) => void;
  private readonly onConnectionChange?: (connected: boolean) => void;

  constructor(
    rpcUrl: string,
    config: WebSocketConfig = {},
    callbacks?: {
      onEvent?: (event: SorobanEvent) => void;
      onConnectionChange?: (connected: boolean) => void;
    }
  ) {
    this.rpcUrl = rpcUrl.replace(/^http/, 'ws');
    this.config = {
      reconnectAttempts: config.reconnectAttempts ?? 5,
      reconnectDelay: config.reconnectDelay ?? 1000,
      maxReconnectDelay: config.maxReconnectDelay ?? 30000,
      heartbeatInterval: config.heartbeatInterval ?? 30000,
    };
    this.onEvent = callbacks?.onEvent;
    this.onConnectionChange = callbacks?.onConnectionChange;
  }

  async connect(): Promise<void> {
    if (this.isConnecting || this.isDestroyed) return;
    
    this.isConnecting = true;
    
    try {
      this.ws = new WebSocket(this.rpcUrl);
      
      this.ws.onopen = () => {
        console.log('WebSocket connected');
        this.isConnecting = false;
        this.reconnectAttempts = 0;
        this.startHeartbeat();
        this.onConnectionChange?.(true);
        this.resubscribeAll();
      };

      this.ws.onmessage = (event) => {
        this.handleMessage(event.data);
      };

      this.ws.onclose = () => {
        console.log('WebSocket disconnected');
        this.isConnecting = false;
        this.stopHeartbeat();
        this.onConnectionChange?.(false);
        this.handleReconnect();
      };

      this.ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        this.isConnecting = false;
      };

    } catch (error) {
      this.isConnecting = false;
      throw error;
    }
  }

  disconnect(): void {
    this.isDestroyed = true;
    this.stopHeartbeat();
    this.clearReconnectTimer();
    
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  subscribe(filter: EventFilter, callback: (event: SorobanEvent) => void): string {
    const subscriptionId = this.generateSubscriptionId();
    const subscription: WebSocketEventSubscription = {
      id: subscriptionId,
      filter,
      callback,
      isActive: true,
    };

    this.subscriptions.set(subscriptionId, subscription);

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendSubscriptionMessage(subscription);
    }

    return subscriptionId;
  }

  unsubscribe(subscriptionId: string): void {
    const subscription = this.subscriptions.get(subscriptionId);
    if (subscription) {
      subscription.isActive = false;
      this.subscriptions.delete(subscriptionId);
      
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.sendUnsubscriptionMessage(subscriptionId);
      }
    }
  }

  private handleMessage(data: string): void {
    try {
      const message = JSON.parse(data);
      
      if (message.type === 'event') {
        const event = this.parseSorobanEvent(message.event);
        
        // Notify global callback
        this.onEvent?.(event);
        
        // Notify matching subscriptions
        for (const subscription of this.subscriptions.values()) {
          if (subscription.isActive && this.eventMatchesFilter(event, subscription.filter)) {
            subscription.callback(event);
          }
        }
      } else if (message.type === 'pong') {
        // Heartbeat response received
      }
    } catch (error) {
      console.error('Error handling WebSocket message:', error);
    }
  }

  private parseSorobanEvent(rawEvent: any): SorobanEvent {
    return {
      id: rawEvent.id || this.generateEventId(),
      type: rawEvent.type || 'contract',
      contractId: rawEvent.contractId,
      topic: rawEvent.topic,
      value: rawEvent.value,
      ledger: rawEvent.ledger || 0,
      timestamp: rawEvent.timestamp || Date.now(),
    };
  }

  private eventMatchesFilter(event: SorobanEvent, filter: EventFilter): boolean {
    if (filter.contractIds && event.contractId && !filter.contractIds.includes(event.contractId)) {
      return false;
    }
    
    if (filter.topics && event.topic && !filter.topics.includes(event.topic)) {
      return false;
    }
    
    if (filter.eventTypes && !filter.eventTypes.includes(event.type)) {
      return false;
    }
    
    return true;
  }

  private sendSubscriptionMessage(subscription: WebSocketEventSubscription): void {
    if (!this.ws) return;
    
    const message = {
      type: 'subscribe',
      id: subscription.id,
      filter: subscription.filter,
    };
    
    this.ws.send(JSON.stringify(message));
  }

  private sendUnsubscriptionMessage(subscriptionId: string): void {
    if (!this.ws) return;
    
    const message = {
      type: 'unsubscribe',
      id: subscriptionId,
    };
    
    this.ws.send(JSON.stringify(message));
  }

  private resubscribeAll(): void {
    for (const subscription of this.subscriptions.values()) {
      if (subscription.isActive) {
        this.sendSubscriptionMessage(subscription);
      }
    }
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    
    this.heartbeatTimer = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify({ type: 'ping' }));
      }
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private handleReconnect(): void {
    if (this.isDestroyed || this.reconnectAttempts >= this.config.reconnectAttempts) {
      return;
    }

    const delay = Math.min(
      this.config.reconnectDelay * Math.pow(2, this.reconnectAttempts),
      this.config.maxReconnectDelay
    );

    this.reconnectTimer = setTimeout(() => {
      this.reconnectAttempts++;
      console.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.config.reconnectAttempts})`);
      this.connect();
    }, delay);
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  private generateSubscriptionId(): string {
    return `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateEventId(): string {
    return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN;
  }

  getSubscriptionCount(): number {
    return this.subscriptions.size;
  }
}
