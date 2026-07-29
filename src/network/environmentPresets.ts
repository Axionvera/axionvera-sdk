import { Networks } from '@stellar/stellar-sdk';
import type { EnvironmentConfig, EnvironmentTier } from '../types';
import { getDefaultRpcUrl, getNetworkPassphrase } from '../utils';
import type { AxionveraNetwork } from '../utils';

/**
 * Maps an environment tier to the default AxionveraNetwork.
 */
const TIER_TO_NETWORK: Record<EnvironmentTier, AxionveraNetwork> = {
  local: 'local',
  testnet: 'testnet',
  futurenet: 'futurenet',
  mainnet: 'mainnet',
};

/**
 * Default RPC URLs for each tier.
 */
const DEFAULT_RPC_URLS: Record<EnvironmentTier, string> = {
  local: 'http://localhost:8000/soroban/rpc',
  testnet: 'https://soroban-testnet.stellar.org',
  futurenet: 'https://rpc-futurenet.stellar.org',
  mainnet: 'https://soroban-mainnet.stellar.org',
};

/**
 * Default Horizon URLs for each tier.
 */
const DEFAULT_HORIZON_URLS: Record<EnvironmentTier, string> = {
  local: 'http://localhost:8000',
  testnet: 'https://horizon-testnet.stellar.org',
  futurenet: 'https://horizon-futurenet.stellar.org',
  mainnet: 'https://horizon.stellar.org',
};

/**
 * Default Faucet URLs (test environments only).
 */
const DEFAULT_FAUCET_URLS: Partial<Record<EnvironmentTier, string>> = {
  local: 'http://localhost:8000/friendbot',
  testnet: 'https://friendbot.stellar.org',
  futurenet: 'https://friendbot-futurenet.stellar.org',
};

/**
 * Default descriptions for each tier.
 */
const TIER_DESCRIPTIONS: Record<EnvironmentTier, string> = {
  local: 'Local development network (standalone Stellar node)',
  testnet: 'Stellar Testnet — public shared test network',
  futurenet: 'Stellar Futurenet — preview of upcoming protocol changes',
  mainnet: 'Stellar Mainnet — production network',
};

/**
 * Builds a complete EnvironmentConfig from an EnvironmentTier,
 * applying all sensible defaults.
 */
export function buildEnvironmentConfig(tier: EnvironmentTier, overrides?: {
  id?: string;
  name?: string;
  rpcUrl?: string;
  networkPassphrase?: string;
  horizonUrl?: string;
  faucetUrl?: string;
  allowHttp?: boolean;
  description?: string;
  metadata?: Record<string, string>;
}): EnvironmentConfig {
  const network = TIER_TO_NETWORK[tier];

  return {
    id: overrides?.id ?? tier,
    name: overrides?.name ?? tier.charAt(0).toUpperCase() + tier.slice(1),
    tier,
    network,
    rpcUrl: overrides?.rpcUrl ?? DEFAULT_RPC_URLS[tier],
    networkPassphrase: overrides?.networkPassphrase ?? getNetworkPassphrase(network),
    horizonUrl: overrides?.horizonUrl ?? DEFAULT_HORIZON_URLS[tier],
    faucetUrl: overrides?.faucetUrl ?? DEFAULT_FAUCET_URLS[tier],
    allowHttp: overrides?.allowHttp ?? (tier === 'local'),
    description: overrides?.description ?? TIER_DESCRIPTIONS[tier],
    metadata: overrides?.metadata,
  };
}

/**
 * Pre-built environment presets for the four canonical tiers.
 */
export const ENVIRONMENT_PRESETS: Record<EnvironmentTier, EnvironmentConfig> = {
  local: buildEnvironmentConfig('local'),
  testnet: buildEnvironmentConfig('testnet'),
  futurenet: buildEnvironmentConfig('futurenet'),
  mainnet: buildEnvironmentConfig('mainnet'),
};

/**
 * Returns all preset environments as an array.
 */
export function getPresetEnvironments(): EnvironmentConfig[] {
  return Object.values(ENVIRONMENT_PRESETS);
}

/**
 * Returns a preset environment by tier.
 * Throws if the tier is not recognized.
 */
export function getPresetEnvironment(tier: EnvironmentTier): EnvironmentConfig {
  if (!(tier in ENVIRONMENT_PRESETS)) {
    throw new Error(`Unknown environment tier: ${tier}. Valid tiers: local, testnet, futurenet, mainnet`);
  }
  return ENVIRONMENT_PRESETS[tier];
}
