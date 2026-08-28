export type AxionveraNetwork = 'mainnet' | 'testnet' | 'futurenet' | (string & {});

export type AmountInput = bigint | number | string;

export type TransactionStatus = 'pending' | 'success' | 'failed' | 'not_found';

export interface TransactionResult {
  hash: string;
  status: TransactionStatus;
  ledger?: number | undefined;
  error?: string | undefined;
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

/**
 * Normalized result of a transaction action.
 */
export interface TransactionActionResult {
  /** The transaction hash */
  hash: string;
  /** The status of the transaction */
  status: 'success' | 'pending' | 'failed' | 'timeout';
  /** Optional ledger number when the transaction was included */
  ledger?: number | undefined;
  /** Optional error message from the network or contract */
  error?: string | undefined;
  /** The raw result from the transport for debugging or advanced use */
  raw?: unknown;
}

/**
 * Typed request shape for Soroban transaction submission.
 * This provides a stable intermediate type before real submit/sign/poll flows are connected.
 */
export interface TransactionSubmissionRequest {
  /** The Stellar transaction XDR string to submit */
  transactionXdr: string;
  /** The network passphrase for the transaction (e.g., "Test SDF Network ; September 2015") */
  networkPassphrase: string;
  /** Optional public key of the signer for the transaction */
  signerPublicKey?: string;
  /** Optional metadata for the transaction submission */
  metadata?: Record<string, unknown>;
}
