import { ValidationError } from './errors';
import type { AmountInput, TransactionResult, TransactionStatus } from './types';

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

export function normalizeTransactionResult(raw: unknown): TransactionResult {
  if (!raw || typeof raw !== 'object') {
    throw new ValidationError('Invalid raw transaction response');
  }

  const record = raw as Record<string, unknown>;

  if (typeof record.hash !== 'string' || !record.hash.trim()) {
    throw new ValidationError('Missing or invalid transaction hash');
  }

  const hash = record.hash.trim();
  let status: TransactionStatus;

  const rawStatus = typeof record.status === 'string' ? record.status.toUpperCase() : '';
  
  if (rawStatus === 'SUCCESS') {
    status = 'success';
  } else if (rawStatus === 'FAILED') {
    status = 'failed';
  } else if (rawStatus === 'PENDING') {
    status = 'pending';
  } else if (rawStatus === 'NOT_FOUND') {
    status = 'not_found';
  } else {
    throw new ValidationError(`Unknown or missing transaction status: ${record.status}`);
  }

  const result: TransactionResult = { hash, status };

  if (typeof record.ledger === 'number') {
    result.ledger = record.ledger;
  }

  if (status === 'failed' && typeof record.error === 'string') {
    result.error = record.error;
  }

  return result;
}
