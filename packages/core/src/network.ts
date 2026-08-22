import type { AxionveraNetwork } from './types';

export interface NetworkConfig {
  network: AxionveraNetwork;
  rpcUrl: string;
  horizonUrl?: string;
  networkPassphrase: string;
}

export interface ResolveNetworkConfigInput {
  network?: AxionveraNetwork;
  rpcUrl?: string;
  horizonUrl?: string;
  networkPassphrase?: string;
}

const DEFAULT_NETWORKS: Record<'testnet' | 'mainnet' | 'futurenet', NetworkConfig> = {
  testnet: {
    network: 'testnet',
    rpcUrl: 'https://soroban-testnet.stellar.org',
    horizonUrl: 'https://horizon-testnet.stellar.org',
    networkPassphrase: 'Test SDF Network ; September 2015'
  },
  mainnet: {
    network: 'mainnet',
    rpcUrl: 'https://soroban-rpc.mainnet.stellar.gateway.fm',
    horizonUrl: 'https://horizon.stellar.org',
    networkPassphrase: 'Public Global Stellar Network ; September 2015'
  },
  futurenet: {
    network: 'futurenet',
    rpcUrl: 'https://rpc-futurenet.stellar.org',
    horizonUrl: 'https://horizon-futurenet.stellar.org',
    networkPassphrase: 'Test SDF Future Network ; October 2022'
  }
};

export function resolveNetworkConfig(input: ResolveNetworkConfigInput = {}): NetworkConfig {
  const network = input.network ?? 'testnet';
  const base = network in DEFAULT_NETWORKS
    ? DEFAULT_NETWORKS[network as 'testnet' | 'mainnet' | 'futurenet']
    : DEFAULT_NETWORKS.testnet;

  const resolved: NetworkConfig = {
    network,
    rpcUrl: input.rpcUrl ?? base.rpcUrl,
    networkPassphrase: input.networkPassphrase ?? base.networkPassphrase
  };

  const horizonUrl = input.horizonUrl ?? base.horizonUrl;
  if (horizonUrl) {
    resolved.horizonUrl = horizonUrl;
  }

  return resolved;
}
