import { ValidationError } from './errors';
import type { AmountInput } from './types';

export interface ContractCallRequest {
  contractId: string;
  method: string;
  args: readonly unknown[];
}

export function createContractCallRequest(
  contractId: string,
  method: string,
  args: readonly unknown[] = []
): ContractCallRequest {
  if (!contractId.trim()) {
    throw new ValidationError('contractId is required');
  }

  if (!method.trim()) {
    throw new ValidationError('method is required');
  }

  return {
    contractId,
    method,
    args
  };
}

export function normalizeAmount(amount: AmountInput): bigint {
  const normalized = typeof amount === 'bigint' ? amount : BigInt(amount);

  if (normalized <= 0n) {
    throw new ValidationError('amount must be greater than zero');
  }

  return normalized;
}
