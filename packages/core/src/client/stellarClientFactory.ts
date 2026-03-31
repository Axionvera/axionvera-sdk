
import { StellarClient, StellarClientOptions } from './stellarClient';

const clientCache = new Map<string, StellarClient>();

function getCacheKey(options: StellarClientOptions): string {
  return `${options.network || 'custom'}:${options.rpcUrl}`;
}

export function createStellarRpcClient(options: StellarClientOptions): StellarClient {
  const cacheKey = getCacheKey(options);
  if (clientCache.has(cacheKey)) {
    return clientCache.get(cacheKey)!;
  }

  const client = new StellarClient(options);
  clientCache.set(cacheKey, client);
  return client;
}

export function getDefaultClient(): StellarClient {
  return createStellarRpcClient({ network: 'testnet' });
}
