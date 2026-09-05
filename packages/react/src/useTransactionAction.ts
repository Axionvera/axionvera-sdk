import { useCallback, useMemo, useState } from 'react';

export type TransactionActionStatus = 'idle' | 'submitting' | 'success' | 'error';

export interface UseTransactionActionResult<TResult = unknown> {
  status: TransactionActionStatus;
  isIdle: boolean;
  isSubmitting: boolean;
  isSuccess: boolean;
  isError: boolean;
  error: Error | null;
  result: TResult | null;
  /** Transaction hash from a successful result when present. */
  hash: string | null;
  run(action: () => Promise<TResult>): Promise<TResult>;
  reset(): void;
}

function extractTransactionHash(result: unknown): string | null {
  if (!result || typeof result !== 'object') {
    return null;
  }

  const hash = (result as { hash?: unknown }).hash;
  return typeof hash === 'string' && hash.trim() ? hash : null;
}

function toError(caught: unknown): Error {
  return caught instanceof Error ? caught : new Error(String(caught));
}

/**
 * Small reusable helper for transaction write-action state.
 * Tracks idle → submitting → success|error without a full state machine.
 */
export function useTransactionAction<TResult = unknown>(): UseTransactionActionResult<TResult> {
  const [status, setStatus] = useState<TransactionActionStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [result, setResult] = useState<TResult | null>(null);
  const [hash, setHash] = useState<string | null>(null);

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
    setResult(null);
    setHash(null);
  }, []);

  const run = useCallback(async (action: () => Promise<TResult>): Promise<TResult> => {
    setStatus('submitting');
    setError(null);
    setResult(null);
    setHash(null);

    try {
      const value = await action();
      setResult(value);
      setHash(extractTransactionHash(value));
      setStatus('success');
      return value;
    } catch (caught) {
      const nextError = toError(caught);
      setError(nextError);
      setResult(null);
      setHash(null);
      setStatus('error');
      throw nextError;
    }
  }, []);

  return useMemo(
    () => ({
      status,
      isIdle: status === 'idle',
      isSubmitting: status === 'submitting',
      isSuccess: status === 'success',
      isError: status === 'error',
      error,
      result,
      hash,
      run,
      reset
    }),
    [status, error, result, hash, run, reset]
  );
}
