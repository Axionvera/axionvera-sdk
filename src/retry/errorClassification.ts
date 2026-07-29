/**
 * Retry engine — error classification.
 *
 * Decides whether a failure is *transient* (worth retrying) or *permanent*
 * (retrying would just waste time / duplicate side effects). Recognises the
 * SDK's typed errors first, then falls back to HTTP status codes, then errs on
 * the side of NOT retrying.
 */

import { AxionveraError } from '../errors';

/** HTTP status codes that indicate a transient, retryable condition. */
export const RETRYABLE_STATUS_CODES: ReadonlySet<number> = new Set([
  408, // Request Timeout
  425, // Too Early
  429, // Too Many Requests
  500, // Internal Server Error
  502, // Bad Gateway
  503, // Service Unavailable
  504, // Gateway Timeout
]);

/** Typed errors that are always transient. */
const RETRYABLE_ERROR_NAMES: ReadonlySet<string> = new Set([
  'NetworkError',
  'TimeoutError',
  'TransactionTimeoutError',
  'RateLimitError',
  'FaucetRateLimitError',
  'RpcError',
  'AxionveraRPCError',
]);

/** Typed errors that are never worth retrying (the request itself is wrong). */
const NON_RETRYABLE_ERROR_NAMES: ReadonlySet<string> = new Set([
  'ValidationError',
  'AuthenticationError',
  'InvalidXDRError',
  'InvalidSignatureError',
  'InsufficientFundsError',
  'NetworkMismatchError',
  'InsecureNetworkError',
  'WalletNotInstalledError',
  'ContractError',
]);

function statusCodeOf(error: unknown): number | undefined {
  if (error && typeof error === 'object' && 'statusCode' in error) {
    const code = (error as { statusCode?: unknown }).statusCode;
    if (typeof code === 'number') return code;
  }
  return undefined;
}

/**
 * Returns true if `error` represents a transient failure worth retrying.
 *
 * Order of precedence: explicit non-retryable type → explicit retryable type →
 * retryable HTTP status code → default false.
 */
export function isRetryableError(error: unknown): boolean {
  if (error instanceof AxionveraError) {
    const name = error.getType();
    if (NON_RETRYABLE_ERROR_NAMES.has(name)) return false;
    if (RETRYABLE_ERROR_NAMES.has(name)) return true;
    const status = error.statusCode;
    if (typeof status === 'number') return RETRYABLE_STATUS_CODES.has(status);
    return false;
  }

  // Non-SDK errors: classify by name then by status code.
  if (error instanceof Error) {
    if (NON_RETRYABLE_ERROR_NAMES.has(error.name)) return false;
    if (RETRYABLE_ERROR_NAMES.has(error.name)) return true;
  }
  const status = statusCodeOf(error);
  if (typeof status === 'number') return RETRYABLE_STATUS_CODES.has(status);

  return false;
}

/** A readable discriminant for diagnostics. */
export function errorTypeName(error: unknown): string {
  if (error instanceof AxionveraError) return error.getType();
  if (error instanceof Error) return error.name || 'Error';
  return typeof error;
}
