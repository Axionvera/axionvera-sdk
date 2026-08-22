export type AxionveraNetwork = 'mainnet' | 'testnet' | 'futurenet' | (string & {});

export type AmountInput = bigint | number | string;

export type TransactionStatus = 'pending' | 'success' | 'failed' | 'not_found';

export interface TransactionResult {
  hash: string;
  status: TransactionStatus;
  ledger?: number;
  error?: string;
}

export interface VaultInfo {
  contractId: string;
  assetCode?: string;
  assetIssuer?: string;
  totalDeposits?: bigint;
  rewardPool?: bigint;
}

export interface VaultTransaction {
  hash?: string;
  status: TransactionStatus;
  raw?: unknown;
}

export interface VaultBalance {
  address: string;
  amount: bigint;
}

export interface VaultReward {
  address: string;
  amount: bigint;
}
