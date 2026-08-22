export type VaultEventType = 'deposit' | 'withdraw' | 'claim_rewards' | 'initialized';

export interface VaultEvent {
  type: VaultEventType;
  contractId: string;
  address?: string;
  amount?: bigint;
  transactionHash?: string;
  ledger?: number;
  raw?: unknown;
}

export function isVaultEvent(value: unknown): value is VaultEvent {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as Partial<VaultEvent>;

  return (
    candidate.type === 'deposit' ||
    candidate.type === 'withdraw' ||
    candidate.type === 'claim_rewards' ||
    candidate.type === 'initialized'
  );
}
