import type { VaultInfo, VaultBalance, VaultReward } from '@axionvera/core';

export const MOCK_VAULT_INFO: VaultInfo = {
  contractId: 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  assetCode: 'USDC',
  assetIssuer: 'GBA...ISSUER',
  totalDeposits: BigInt(1000000000), // 100 USDC
  rewardPool: BigInt(50000000) // 5 USDC
};

export const MOCK_USER_BALANCE: VaultBalance = {
  address: 'GBB...USER',
  amount: BigInt(100000000) // 10 USDC
};

export const MOCK_USER_REWARD: VaultReward = {
  address: 'GBB...USER',
  amount: BigInt(5000000) // 0.5 USDC
};
