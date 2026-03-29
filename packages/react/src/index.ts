import { useEffect, useState, useCallback } from 'react';
import { StellarClient, EventFilter, SorobanEvent, CloudWatchConfig, WebSocketConfig } from '@axionvera/core';

/**
 * Hook for managing StellarClient instance
 */
export function useStellarClient(options?: {
  network?: string;
  rpcUrl?: string;
  logLevel?: 'none' | 'error' | 'warn' | 'info' | 'debug';
  cloudWatchConfig?: CloudWatchConfig;
  webSocketConfig?: WebSocketConfig;
}) {
  const [client, setClient] = useState<StellarClient | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    try {
      const stellarClient = new StellarClient(options);
      setClient(stellarClient);
      setError(null);
    } catch (err) {
      setError(err as Error);
    } finally {
      setIsLoading(false);
    }

    return () => {
      client?.cleanup();
    };
  }, []);

  return { client, isLoading, error };
}

/**
 * Hook for subscribing to real-time events
 */
export function useEventSubscription(
  client: StellarClient | null,
  filter: EventFilter,
  callback: (event: SorobanEvent) => void
) {
  const [subscriptionId, setSubscriptionId] = useState<string | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const subscribe = useCallback(async () => {
    if (!client) return;

    try {
      const id = await client.subscribeToEvents(filter, callback);
      setSubscriptionId(id);
      setIsSubscribed(true);
      setError(null);
    } catch (err) {
      setError(err as Error);
    }
  }, [client, filter, callback]);

  const unsubscribe = useCallback(() => {
    if (client && subscriptionId) {
      client.unsubscribeFromEvents(subscriptionId);
      setSubscriptionId(null);
      setIsSubscribed(false);
    }
  }, [client, subscriptionId]);

  useEffect(() => {
    subscribe();
    return unsubscribe;
  }, [subscribe, unsubscribe]);

  return { isSubscribed, subscriptionId, error, subscribe, unsubscribe };
}

/**
 * Hook for monitoring queue status
 */
export function useQueueStatus(client: StellarClient | null) {
  const [status, setStatus] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);

  const refreshStatus = useCallback(async () => {
    if (!client) return;
    
    setIsLoading(true);
    try {
      const queueStatus = client.getQueueStatus();
      setStatus(queueStatus);
    } catch (err) {
      console.error('Failed to get queue status:', err);
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  useEffect(() => {
    refreshStatus();
  }, [refreshStatus]);

  return { status, isLoading, refreshStatus };
}

export { StellarClient, EventFilter, SorobanEvent, CloudWatchConfig, WebSocketConfig } from '@axionvera/core';
