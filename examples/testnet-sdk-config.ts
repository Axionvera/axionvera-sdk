import { AxionveraClient, type NetworkConfig } from '@axionvera/core';

export const TESTNET_SDK_CONFIG = {
  network: 'testnet',
  rpcUrl: 'https://soroban-testnet.stellar.org',
  horizonUrl: 'https://horizon-testnet.stellar.org',
  networkPassphrase: 'Test SDF Network ; September 2015',
  vaultContractId: 'YOUR_TESTNET_VAULT_CONTRACT_ID',
  tokens: {
    deposit: 'YOUR_TESTNET_DEPOSIT_TOKEN_CONTRACT_ID',
    reward: 'YOUR_TESTNET_REWARD_TOKEN_CONTRACT_ID'
  }
} as const;

/**
 * Placeholder IDs are intentional until maintainers provide deployed contracts.
 * Do not use this configuration for live submissions until every placeholder is replaced.
 */
export function validateTestnetSdkConfig(config: typeof TESTNET_SDK_CONFIG): void {
  const values = [config.vaultContractId, config.tokens.deposit, config.tokens.reward];
  if (values.some((value) => value.includes('YOUR_'))) {
    throw new Error('Testnet contract configuration still contains placeholders');
  }
  if (config.network !== 'testnet') {
    throw new Error('This example requires the testnet network');
  }
  if (config.networkPassphrase !== 'Test SDF Network ; September 2015') {
    throw new Error('Use the Stellar testnet network passphrase');
  }
}

const network: NetworkConfig = {
  network: TESTNET_SDK_CONFIG.network,
  rpcUrl: TESTNET_SDK_CONFIG.rpcUrl,
  horizonUrl: TESTNET_SDK_CONFIG.horizonUrl,
  networkPassphrase: TESTNET_SDK_CONFIG.networkPassphrase
};

const client = new AxionveraClient(network);
console.log('Configured testnet RPC:', client.getNetworkConfig().rpcUrl);
// Replace the placeholders above with maintainer-provided IDs before live integration.
