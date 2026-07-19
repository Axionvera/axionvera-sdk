import type { ValidationIssue, ValidationKind } from '../types/validation';

/** Type-safe error response structure */
interface ErrorResponseLike {
  status?: number;
  headers?: Record<string, string>;
  data?: unknown;
}

/** Type-safe error structure with discriminated union */
interface ErrorLike {
  message?: unknown;
  code?: unknown;
  status?: unknown;
  requestId?: unknown;
  response?: ErrorResponseLike;
}

/** Error type discriminant */
export type ErrorDiscriminant = 
  | 'NetworkError'
  | 'AuthenticationError'
  | 'RateLimitError'
  | 'ValidationError'
  | 'TransactionError'
  | 'RpcError'
  | 'ContractError'
  | 'TimeoutError'
  | 'InsufficientFundsError'
  | 'InvalidSignatureError'
  | 'InvalidXDRError'
  | 'SimulationError'
  | 'WalletNotInstalledError'
  | 'FaucetRateLimitError'
  | 'NetworkMismatchError'
  | 'InsecureNetworkError'
  | 'BatchError'
  | 'BatchValidationError'
  | 'BatchExecutionError';

export interface AxionveraErrorOptions {
  statusCode?: number;
  requestId?: string;
  originalError?: unknown;
}

export class AxionveraError extends Error {
  readonly statusCode?: number;
  readonly requestId?: string;
  readonly originalError?: unknown;

  constructor(message: string, options: AxionveraErrorOptions = {}) {
    super(message);
    this.name = new.target.name;
    this.statusCode = options.statusCode;
    this.requestId = options.requestId;
    this.originalError = options.originalError;
  }

  /** Type-safe discriminant method for error handling */
  getType(): ErrorDiscriminant {
    return (this.name as ErrorDiscriminant) || 'NetworkError';
  }
}

export class NetworkError extends AxionveraError {}

export class AuthenticationError extends AxionveraError {}

export class RateLimitError extends AxionveraError {}

export class ValidationError extends AxionveraError {}

export class TransactionError extends AxionveraError {}

export class RpcError extends AxionveraError {}

export class ContractError extends AxionveraError {}

export class TimeoutError extends AxionveraError {}

export class TransactionTimeoutError extends TimeoutError {}

export class InsufficientFundsError extends AxionveraError {}

export class InvalidSignatureError extends AxionveraError {}

/**
 * Thrown when a consumer-provided XDR string fails sanitization.
 *
 * This error is raised before the underlying @stellar/stellar-sdk parser is
 * ever invoked, so no unhandled Buffer allocation panics can reach the caller.
 *
 * @example
 * ```typescript
 * import { assertValidXDR } from 'axionvera-sdk';
 * // Throws InvalidXDRError for any non-base64 or oversized input
 * assertValidXDR(userSuppliedXdr);
 * ```
 */
export class InvalidXDRError extends AxionveraError {
  /** The (possibly truncated) input that failed validation. */
  readonly input: string;

  constructor(message: string, input: string, options: AxionveraErrorOptions = {}) {
    super(message, options);
    this.name = 'InvalidXDRError';
    // Avoid leaking huge strings in the error object — keep at most 64 chars.
    this.input = input.length > 64 ? `${input.slice(0, 64)}…` : input;
  }
}

export class SimulationError extends AxionveraError {}

export class WalletNotInstalledError extends AxionveraError {}

export class FaucetRateLimitError extends AxionveraError {}

export class NetworkMismatchError extends AxionveraError {}

export class InsecureNetworkError extends AxionveraError {}

export class AxionveraRPCError extends AxionveraError {
  readonly rpcMethod: string;

  constructor(message: string, rpcMethod: string, options: AxionveraErrorOptions = {}) {
    super(message, options);
    this.name = 'AxionveraRPCError';
    this.rpcMethod = rpcMethod;
  }
}

export class SimulationFailedError extends AxionveraError {
  readonly simulationResult?: unknown;

  constructor(
    message: string,
    options: AxionveraErrorOptions & { simulationResult?: unknown } = {}
  ) {
    super(message, options);
    this.name = 'SimulationFailedError';
    this.simulationResult = options.simulationResult;
  }
}

export class SlippageToleranceExceededError extends AxionveraError {
  readonly expected: bigint;
  readonly actual: bigint;
  readonly tolerance: bigint;

  constructor(
    expected: bigint,
    actual: bigint,
    tolerance: bigint,
    options: AxionveraErrorOptions = {}
  ) {
    super(
      `Slippage tolerance exceeded: expected at least ${expected.toString()} shares, ` +
        `but simulation returned ${actual.toString()}. Tolerance was ${tolerance.toString()}.`,
      options
    );
    this.name = 'SlippageToleranceExceededError';
    this.expected = expected;
    this.actual = actual;
    this.tolerance = tolerance;
  }
}

export class WalletConnectionError extends AxionveraError {
  readonly walletType?: string;

  constructor(message: string, options: AxionveraErrorOptions & { walletType?: string } = {}) {
    super(message, options);
    this.name = 'WalletConnectionError';
    this.walletType = options.walletType;
  }
}

export type SchemaValidationErrorOptions = AxionveraErrorOptions & {
  /** Logical contract/method-group identifier the schema was registered under. */
  contractId: string;
  /** The contract method whose params or result failed validation. */
  method: string;
  /** Whether the failure was on the input params or the returned result. */
  kind: ValidationKind;
  /** Every individual field-level issue that caused the failure. */
  issues: ValidationIssue[];
};

/**
 * Thrown by the contract schema validation engine when a method's params or
 * result do not match its registered schema.
 *
 * Carries structured {@link ValidationIssue} entries so callers can render
 * field-level error messages instead of parsing a single string.
 */
export class SchemaValidationError extends AxionveraError {
  readonly contractId: string;
  readonly method: string;
  readonly kind: ValidationKind;
  readonly issues: ValidationIssue[];

  constructor(message: string, options: SchemaValidationErrorOptions) {
    super(message, options);
    this.name = 'SchemaValidationError';
    this.contractId = options.contractId;
    this.method = options.method;
    this.kind = options.kind;
    this.issues = options.issues;
  }
}

export type MigrationStateValidationErrorOptions = AxionveraErrorOptions & {
  /** Logical contract id whose state failed validation. */
  contractId: string;
  /** The migration version the state was expected to match. */
  version: string;
  /** Every individual field-level issue that caused the failure. */
  issues: ValidationIssue[];
};

/**
 * Thrown by {@link MigrationStateValidator} when a contract's state does not
 * match the schema registered for a given migration version.
 *
 * Carries structured {@link ValidationIssue} entries, consistent with
 * {@link SchemaValidationError}, so callers can render field-level error
 * messages instead of parsing a single string.
 */
export class MigrationStateValidationError extends AxionveraError {
  readonly contractId: string;
  readonly version: string;
  readonly issues: ValidationIssue[];

  constructor(message: string, options: MigrationStateValidationErrorOptions) {
    super(message, options);
    this.name = 'MigrationStateValidationError';
    this.contractId = options.contractId;
    this.version = options.version;
    this.issues = options.issues;
  }
}

/**
 * Thrown by {@link MigrationRegistry.resolvePath} when no chain of registered
 * migration steps connects `fromVersion` to `toVersion` for a contract.
 */
export class MigrationPathNotFoundError extends AxionveraError {
  readonly contractId: string;
  readonly fromVersion: string;
  readonly toVersion: string;

  constructor(contractId: string, fromVersion: string, toVersion: string) {
    super(
      `No migration path found for contract "${contractId}" from version "${fromVersion}" to "${toVersion}"`
    );
    this.name = 'MigrationPathNotFoundError';
    this.contractId = contractId;
    this.fromVersion = fromVersion;
    this.toVersion = toVersion;
  }
}

/**
 * Thrown by {@link AbiVersionRegistry.require} (and, transitively, by
 * `AbiCompatAdapter`) when the requested ABI version has no registered
 * {@link AbiVersionDescriptor} for a given contract.
 */
export class UnsupportedAbiVersionError extends AxionveraError {
  readonly contractId: string;
  readonly version: string;
  readonly availableVersions: string[];

  constructor(contractId: string, version: string, availableVersions: string[] = []) {
    super(
      `Unsupported ABI version "${version}" for contract "${contractId}". ` +
        (availableVersions.length
          ? `Registered versions: ${availableVersions.join(', ')}.`
          : 'No versions are registered for this contract.')
    );
    this.name = 'UnsupportedAbiVersionError';
    this.contractId = contractId;
    this.version = version;
    this.availableVersions = availableVersions;
  }
}

/**
 * Thrown when {@link AbiVersionRegistry.detectVersion} cannot determine an
 * ABI version for a deployed contract (no explicit tag, and no registered
 * version's fingerprint fully matched) and no `fallbackVersion` was configured.
 */
export class AbiVersionDetectionError extends AxionveraError {
  readonly contractId: string;

  constructor(contractId: string, message?: string) {
    super(message ?? `Could not determine the deployed ABI version for contract "${contractId}"`);
    this.name = 'AbiVersionDetectionError';
    this.contractId = contractId;
  }
}

/**
 * Thrown by `AbiCompatAdapter` when a canonical method has no mapping in
 * the deployed contract's resolved ABI version — i.e. the method was
 * introduced in a later version than what's currently deployed.
 */
export class UnsupportedContractMethodError extends AxionveraError {
  readonly contractId: string;
  readonly method: string;
  readonly version: string;

  constructor(contractId: string, method: string, version: string) {
    super(
      `Method "${method}" is not supported by contract "${contractId}" at ABI version "${version}".`
    );
    this.name = 'UnsupportedContractMethodError';
    this.contractId = contractId;
    this.method = method;
    this.version = version;
  }
}

// ── Batch Errors ──────────────────────────────────────────────────

/**
 * Base error class for all batch-related failures.
 */
export class BatchError extends AxionveraError {
  constructor(message: string, options: AxionveraErrorOptions = {}) {
    super(message, options);
    this.name = 'BatchError';
  }
}

/**
 * Thrown when pre-execution batch validation fails.
 * Carries the full {@link BatchValidationResult} so callers can render
 * per-transaction diagnostics.
 */
export class BatchValidationError extends BatchError {
  readonly validationResult: import('../batch/types').BatchValidationResult;

  constructor(
    validationResult: import('../batch/types').BatchValidationResult,
    options: AxionveraErrorOptions = {}
  ) {
    const summary = validationResult.issues
      .map((i) => `[${i.category}] ${i.message}`)
      .join('; ');
    super(`Batch validation failed: ${summary}`, options);
    this.name = 'BatchValidationError';
    this.validationResult = validationResult;
  }
}

/**
 * Thrown when batch execution encounters an unrecoverable error outside
 * of individual transaction failures (e.g. RPC connection loss).
 */
export class BatchExecutionError extends BatchError {
  readonly failedAt: number;

  constructor(message: string, failedAt: number, options: AxionveraErrorOptions = {}) {
    super(message, options);
    this.name = 'BatchExecutionError';
    this.failedAt = failedAt;
  }
}

export type RPCValidationMismatchErrorOptions = AxionveraErrorOptions & {
  rpcMethod: string;
  receivedShape: unknown;
};

export class RPCValidationMismatchError extends AxionveraError {
  readonly rpcMethod: string;
  readonly receivedShape: unknown;

  constructor(message: string, options: RPCValidationMismatchErrorOptions) {
    super(message, options);
    this.rpcMethod = options.rpcMethod;
    this.receivedShape = options.receivedShape;
  }
}

/**
 * Normalizes RPC errors from Stellar/Soroban RPC responses.
 * @param error - The raw error from RPC call
 * @param operation - Description of the operation that failed
 * @returns Normalized AxionveraError
 */
export function normalizeRpcError(error: unknown, operation: string): AxionveraError {
  if (error instanceof AxionveraError) {
    return error;
  }

  const errorLike = asErrorLike(error);
  const message = getErrorMessage(error, `RPC operation failed: ${operation}`);

  // Check for specific RPC error patterns
  if (typeof errorLike.code === 'string') {
    if (errorLike.code.includes('TIMEOUT') || message.toLowerCase().includes('timeout')) {
      return new TimeoutError(message, {
        originalError: error,
      });
    }
    if (errorLike.code.includes('NETWORK') || message.toLowerCase().includes('network')) {
      return new NetworkError(message, {
        originalError: error,
      });
    }
  }

  return new RpcError(message, {
    originalError: error,
  });
}

/**
 * Normalizes transaction submission errors.
 * @param error - The raw error from transaction submission
 * @param txHash - The transaction hash if available
 * @returns Normalized AxionveraError
 */
export function normalizeTransactionError(error: unknown, txHash?: string): AxionveraError {
  if (error instanceof AxionveraError) {
    return error;
  }

  const message = getErrorMessage(error, 'Transaction failed');

  // Check for specific transaction error patterns
  const lowerMessage = message.toLowerCase();
  if (lowerMessage.includes('insufficient') && lowerMessage.includes('fund')) {
    return new InsufficientFundsError(
      `Insufficient funds for transaction${txHash ? ` (${txHash})` : ''}`,
      {
        originalError: error,
      }
    );
  }
  if (lowerMessage.includes('invalid') && lowerMessage.includes('signature')) {
    return new InvalidSignatureError(
      `Invalid signature for transaction${txHash ? ` (${txHash})` : ''}`,
      {
        originalError: error,
      }
    );
  }
  if (lowerMessage.includes('timeout') || lowerMessage.includes('timed out')) {
    return new TimeoutError(`Transaction timeout${txHash ? ` (${txHash})` : ''}`, {
      originalError: error,
    });
  }

  return new TransactionError(message, {
    originalError: error,
  });
}

/**
 * Normalizes contract call errors.
 * @param error - The raw error from contract call
 * @param contractId - The contract ID
 * @param method - The method that was called
 * @returns Normalized AxionveraError
 */
export function normalizeContractError(
  error: unknown,
  contractId: string,
  method: string
): AxionveraError {
  if (error instanceof AxionveraError) {
    return error;
  }

  return new ContractError(`Contract call failed: ${method} on ${contractId}`, {
    originalError: error,
  });
}

/**
 * Normalizes simulation errors.
 * @param error - The raw error from simulation
 * @returns Normalized AxionveraError
 */
export function normalizeSimulationError(error: unknown): AxionveraError {
  if (error instanceof AxionveraError) {
    return error;
  }

  const message = getErrorMessage(error, 'Transaction simulation failed');

  return new SimulationError(message, {
    originalError: error,
  });
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function asErrorLike(error: unknown): ErrorLike {
  return isObject(error) ? error : {};
}

function getHeaderValue(
  headers: ErrorHeaderContainer | undefined,
  key: string
): string | undefined {
  if (!headers) {
    return undefined;
  }

  if (typeof headers.get === 'function') {
    const headerValue = headers.get(key) ?? headers.get(key.toLowerCase());
    if (typeof headerValue === 'string') {
      return headerValue;
    }
  }

  const direct = headers[key] ?? headers[key.toLowerCase()] ?? headers[key.toUpperCase()];
  return typeof direct === 'string' ? direct : undefined;
}

function getMessageFromResponseData(data: unknown): string | undefined {
  if (typeof data === 'string') {
    return data;
  }

  if (!isObject(data)) {
    return undefined;
  }

  const message = data.message;
  if (typeof message === 'string' && message.trim().length > 0) {
    return message;
  }

  const error = data.error;
  if (typeof error === 'string' && error.trim().length > 0) {
    return error;
  }

  return undefined;
}

export function getErrorStatusCode(error: unknown): number | undefined {
  if (error instanceof AxionveraError) {
    return error.statusCode;
  }

  const errorLike = asErrorLike(error);
  const responseStatus = errorLike.response?.status;
  if (typeof responseStatus === 'number') {
    return responseStatus;
  }

  if (typeof errorLike.status === 'number') {
    return errorLike.status;
  }

  return undefined;
}

export function getErrorRequestId(error: unknown): string | undefined {
  if (error instanceof AxionveraError) {
    return error.requestId;
  }

  const errorLike = asErrorLike(error);
  const headers = errorLike.response?.headers;

  return (
    getHeaderValue(headers, 'x-request-id') ??
    getHeaderValue(headers, 'x-requestid') ??
    getHeaderValue(headers, 'request-id') ??
    getHeaderValue(headers, 'x-correlation-id') ??
    (typeof errorLike.requestId === 'string' ? errorLike.requestId : undefined)
  );
}

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  const errorLike = asErrorLike(error);
  if (typeof errorLike.message === 'string' && errorLike.message.trim().length > 0) {
    return errorLike.message;
  }

  const messageFromResponse = getMessageFromResponseData(errorLike.response?.data);
  if (messageFromResponse) {
    return messageFromResponse;
  }

  return fallbackMessage;
}

function isNetworkCode(errorCode: unknown): boolean {
  if (typeof errorCode !== 'string') {
    return false;
  }

  return ['ECONNABORTED', 'ECONNRESET', 'ENOTFOUND', 'ETIMEDOUT', 'ERR_NETWORK'].includes(
    errorCode
  );
}

export function toAxionveraError(
  error: unknown,
  fallbackMessage = 'API request failed'
): AxionveraError {
  if (error instanceof AxionveraError) {
    return error;
  }

  const statusCode = getErrorStatusCode(error);
  const requestId = getErrorRequestId(error);
  const message = getErrorMessage(error, fallbackMessage);
  const errorLike = asErrorLike(error);

  const options: AxionveraErrorOptions = {
    statusCode,
    requestId,
    originalError: error,
  };

  if (statusCode === 401 || statusCode === 403) {
    return new AuthenticationError(message, options);
  }

  if (statusCode === 429) {
    return new RateLimitError(message, options);
  }

  if (statusCode !== undefined && statusCode >= 400 && statusCode < 500) {
    return new ValidationError(message, options);
  }

  if (statusCode === undefined || statusCode >= 500 || isNetworkCode(errorLike.code)) {
    return new NetworkError(message, options);
  }

  return new AxionveraError(message, options);
}
