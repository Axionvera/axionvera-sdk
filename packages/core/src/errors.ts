export type AxionveraErrorCode =
  | 'AXIONVERA_ERROR'
  | 'VALIDATION_ERROR'
  | 'NETWORK_ERROR'
  | 'WALLET_ERROR'
  | 'CONTRACT_ERROR'
  | 'TRANSACTION_TIMEOUT';

export class AxionveraError extends Error {
  readonly code: AxionveraErrorCode;
  readonly cause: unknown | undefined;

  constructor(message: string, code: AxionveraErrorCode = 'AXIONVERA_ERROR', cause?: unknown) {
    super(message);
    this.name = 'AxionveraError';
    this.code = code;
    this.cause = cause;
  }
}

export class ValidationError extends AxionveraError {
  constructor(message: string, cause?: unknown) {
    super(message, 'VALIDATION_ERROR', cause);
    this.name = 'ValidationError';
  }
}

export class NetworkError extends AxionveraError {
  constructor(message: string, cause?: unknown) {
    super(message, 'NETWORK_ERROR', cause);
    this.name = 'NetworkError';
  }
}

export class WalletError extends AxionveraError {
  constructor(message: string, cause?: unknown) {
    super(message, 'WALLET_ERROR', cause);
    this.name = 'WalletError';
  }
}

export class ContractError extends AxionveraError {
  constructor(message: string, cause?: unknown) {
    super(message, 'CONTRACT_ERROR', cause);
    this.name = 'ContractError';
  }
}

export class TransactionTimeoutError extends AxionveraError {
  constructor(hash: string) {
    super(`Transaction confirmation timed out for ${hash}`, 'TRANSACTION_TIMEOUT');
    this.name = 'TransactionTimeoutError';
  }
}

export class TransactionError extends AxionveraError {
  constructor(message: string, cause?: unknown) {
    super(message, 'AXIONVERA_ERROR', cause);
    this.name = 'TransactionError';
  }
}

export class WalletRejectedTransactionError extends TransactionError {
  constructor(cause?: unknown) {
    super('Wallet signing was rejected', cause);
    this.name = 'WalletRejectedTransactionError';
  }
}

export class TransactionFailedError extends TransactionError {
  constructor(hash: string, cause?: unknown) {
    super(`Transaction failed for ${hash}`, cause);
    this.name = 'TransactionFailedError';
  }
}

export class TransactionNotFoundError extends TransactionError {
  constructor(hash: string, cause?: unknown) {
    super(`Transaction not found for ${hash}`, cause);
    this.name = 'TransactionNotFoundError';
  }
}

export class RpcError extends AxionveraError {
  constructor(message: string, cause?: unknown) {
    super(message, 'NETWORK_ERROR', cause);
    this.name = 'RpcError';
  }
}

export class TimeoutError extends AxionveraError {
  constructor(message: string, cause?: unknown) {
    super(message, 'TRANSACTION_TIMEOUT', cause);
    this.name = 'TimeoutError';
  }
}

export function normalizeRpcError(error: unknown, operation: string): AxionveraError {
  const message = error instanceof Error && error.message ? error.message : `RPC operation failed: ${operation}`;
  if (typeof message === 'string' && /timeout|timed out/i.test(message)) {
    return new TimeoutError(`RPC timeout during ${operation}`, error);
  }
  return new RpcError(message, error);
}

export function normalizeTransactionError(error: unknown, txHash?: string): AxionveraError {
  const message = error instanceof Error && error.message ? error.message : 'Transaction failed';
  const lower = message.toLowerCase();

  if (/user rejected|declined|denied/i.test(lower) || (typeof (error as any)?.code === 'number' && (error as any).code === 4001)) {
    return new WalletRejectedTransactionError(error);
  }

  if (lower.includes('not found')) {
    return new TransactionNotFoundError(txHash ?? 'unknown', error);
  }

  if (lower.includes('timed out') || lower.includes('timeout')) {
    return new TimeoutError(`Transaction timeout${txHash ? ` (${txHash})` : ''}`, error);
  }

  if (lower.includes('failed')) {
    return new TransactionFailedError(txHash ?? 'unknown', error);
  }

  return new TransactionError(message, error);
}
