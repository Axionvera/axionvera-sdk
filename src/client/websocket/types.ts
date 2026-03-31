export interface EventFilter {
  contractIds?: string[];
  topics?: string[];
  eventTypes?: ('contract' | 'ledger')[];
}

export interface SorobanEvent {
  id: string;
  type: 'contract' | 'ledger';
  contractId?: string;
  topic?: string;
  value: any;
  ledger: number;
  timestamp: number;
}

export interface WebSocketEventSubscription {
  id: string;
  filter: EventFilter;
  callback: (event: SorobanEvent) => void;
  isActive: boolean;
}

export interface WebSocketConfig {
  reconnectAttempts?: number;
  reconnectDelay?: number;
  maxReconnectDelay?: number;
  heartbeatInterval?: number;
}
