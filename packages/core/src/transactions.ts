import { TransactionTimeoutError, ValidationError } from './errors';
import type { AmountInput, TransactionResult, TransactionStatus, TransactionSubmissionRequest } from './types';

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

export interface WaitForTransactionParams {
  /** Resolves the current state of the transaction for the given hash. */
  lookup: (hash: string) => Promise<TransactionResult> | TransactionResult;
  /** Transaction hash to wait for. */
  hash: string;
  /** Milliseconds to wait between polls. Defaults to 1000. */
  interval?: number;
  /** Maximum number of polling attempts before timing out. Defaults to 30. */
  maxAttempts?: number;
  /** Injectable delay used between polls; defaults to a setTimeout-backed sleep. */
  delay?: (ms: number) => Promise<void>;
}

const sleep = async (ms: number, delay?: (ms: number) => Promise<void>): Promise<void> => {
  if (delay) return delay(ms);
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Polls `lookup(hash)` until the transaction reaches a terminal status or the
 * attempt budget is exhausted.
 *
 * `success` and `failed` are terminal: the resolved `TransactionResult` is
 * returned (callers inspect `status` to distinguish success from failure).
 *
 * `pending` and `not_found` are treated as non-terminal. A `not_found` result
 * means the transaction has not yet propagated, so polling continues — the
 * caller does not have to special-case it. Once `maxAttempts` is reached
 * without a terminal status, a `TransactionTimeoutError` is thrown.
 */
export async function waitForTransaction(
  params: WaitForTransactionParams
): Promise<TransactionResult> {
  const { lookup, hash, interval = 1000, maxAttempts = 30, delay } = params;

  if (typeof lookup !== 'function') {
    throw new ValidationError('lookup must be a function');
  }
  if (typeof hash !== 'string' || !hash.trim()) {
    throw new ValidationError('hash is required');
  }
  if (interval != null && (!Number.isFinite(interval) || interval < 0)) {
    throw new ValidationError('interval must be a non-negative number');
  }
  if (maxAttempts != null && (!Number.isInteger(maxAttempts) || maxAttempts < 1)) {
    throw new ValidationError('maxAttempts must be a positive integer');
  }
  if (delay != null && typeof delay !== 'function') {
    throw new ValidationError('delay must be a function');
  }

  const trimmedHash = hash.trim();

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = await lookup(trimmedHash);

    if (result.status === 'success' || result.status === 'failed') {
      return result;
    }

    // pending or not_found: continue polling unless attempts are exhausted.
    if (attempt === maxAttempts) {
      throw new TransactionTimeoutError(trimmedHash);
    }

    await sleep(interval, delay);
  }

  // Unreachable given the loop bound above, but keeps the compiler happy.
  throw new TransactionTimeoutError(trimmedHash);
}

/**
 * Input parameters for building a transaction submission request.
 */
export interface TransactionSubmissionRequestInput {
  /** The Stellar transaction XDR string to submit */
  transactionXdr: string;
  /** The network passphrase for the transaction */
  networkPassphrase: string;
  /** Optional public key of the signer for the transaction */
  signerPublicKey?: string;
  /** Optional metadata for the transaction submission */
  metadata?: Record<string, unknown>;
}

/**
 * Validates and builds a transaction submission request.
 *
 * @param input - The request parameters to validate and build
 * @returns A validated TransactionSubmissionRequest object
 * @throws ValidationError if required fields are invalid
 */
export function validateTransactionSubmissionRequest(
  input: TransactionSubmissionRequestInput
): TransactionSubmissionRequest {
  if (typeof input.transactionXdr !== 'string' || !input.transactionXdr.trim()) {
    throw new ValidationError('transactionXdr is required and must be a non-empty string');
  }

  if (typeof input.networkPassphrase !== 'string' || !input.networkPassphrase.trim()) {
    throw new ValidationError('networkPassphrase is required and must be a non-empty string');
  }

  if (input.signerPublicKey !== undefined) {
    if (typeof input.signerPublicKey !== 'string' || !input.signerPublicKey.trim()) {
      throw new ValidationError('signerPublicKey must be a non-empty string when provided');
    }
  }

  if (input.metadata !== undefined && typeof input.metadata !== 'object') {
    throw new ValidationError('metadata must be an object when provided');
  }

  const result: TransactionSubmissionRequest = {
    transactionXdr: input.transactionXdr.trim(),
    networkPassphrase: input.networkPassphrase.trim(),
  };

  if (input.signerPublicKey !== undefined) {
    result.signerPublicKey = input.signerPublicKey.trim();
  }

  if (input.metadata !== undefined) {
    result.metadata = input.metadata;
  }

  return result;
}
