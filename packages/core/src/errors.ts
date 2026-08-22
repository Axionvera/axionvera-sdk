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
