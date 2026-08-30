import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { TransactionTimeoutError, ValidationError } from '@axionvera/core';
import type { TransactionResult } from '@axionvera/core';

export type TransactionPollingStatus = 'idle' | 'polling' | 'success' | 'failed' | 'timeout' | 'error';

export interface UseTransactionStatusResult {
  status: TransactionPollingStatus;
  isIdle: boolean;
  isPolling: boolean;
  isSuccess: boolean;
  isFailed: boolean;
  isTimeout: boolean;
  isError: boolean;
  error: Error | null;
  result: TransactionResult | null;
  hash: string | null;
  /** Start polling for the given transaction hash. */
  poll(hash: string, lookup: (hash: string) => Promise<TransactionResult>): void;
  /** Reset the hook to idle state. */
  reset(): void;
}

function toError(caught: unknown): Error {
  return caught instanceof Error ? caught : new Error(String(caught));
}

/**
 * React hook for polling and exposing transaction status.
 * 
 * This hook provides a clean way to track transaction hashes after SDK write actions.
 * It uses the core waitForTransaction helper with injected delay for testability.
 * 
 * @example
 * ```tsx
 * const { status, result, poll, reset } = useTransactionStatus();
 * 
 * // Start polling when you have a hash
 * poll(txHash, async (hash) => await rpc.getTransaction(hash));
 * ```
 */
export function useTransactionStatus(): UseTransactionStatusResult {
  const [status, setStatus] = useState<TransactionPollingStatus>('idle');
  const [error, setError] = useState<Error | null>(null);
  const [result, setResult] = useState<TransactionResult | null>(null);
  const [hash, setHash] = useState<string | null>(null);
  
  const abortControllerRef = useRef<AbortController | null>(null);
  const pollingRef = useRef(false);

  const reset = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    pollingRef.current = false;
    setStatus('idle');
    setError(null);
    setResult(null);
    setHash(null);
  }, []);

  const poll = useCallback(
    async (txHash: string, lookup: (hash: string) => Promise<TransactionResult>) => {
      // Reset any ongoing polling
      reset();

      // Validate inputs
      if (!txHash || typeof txHash !== 'string' || !txHash.trim()) {
        const validationError = new ValidationError('Transaction hash is required');
        setStatus('error');
        setError(validationError);
        return;
      }

      if (typeof lookup !== 'function') {
        const validationError = new ValidationError('Lookup function is required');
        setStatus('error');
        setError(validationError);
        return;
      }

      const trimmedHash = txHash.trim();
      setHash(trimmedHash);
      setStatus('polling');
      setError(null);
      setResult(null);
      pollingRef.current = true;

      const abortController = new AbortController();
      abortControllerRef.current = abortController;

      try {
        // Poll with a simple delay implementation
        const maxAttempts = 30;
        const interval = 1000;

        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          // Check if polling was aborted
          if (abortController.signal.aborted || !pollingRef.current) {
            return;
          }

          const txResult = await lookup(trimmedHash);

          // Check if polling was aborted during lookup
          if (abortController.signal.aborted || !pollingRef.current) {
            return;
          }

          if (txResult.status === 'success' || txResult.status === 'failed') {
            setResult(txResult);
            setStatus(txResult.status);
            pollingRef.current = false;
            abortControllerRef.current = null;
            return;
          }

          // Wait before next poll (unless this was the last attempt)
          if (attempt < maxAttempts && pollingRef.current) {
            await new Promise<void>((resolve) => {
              const timeoutId = setTimeout(resolve, interval);
              abortController.signal.addEventListener('abort', () => {
                clearTimeout(timeoutId);
                resolve();
              });
            });
          }
        }

        // Max attempts reached without terminal status
        if (pollingRef.current) {
          setStatus('timeout');
          setError(new TransactionTimeoutError(trimmedHash));
          pollingRef.current = false;
          abortControllerRef.current = null;
        }
      } catch (caught) {
        // Only set error if we weren't aborted
        if (!abortController.signal.aborted && pollingRef.current) {
          const nextError = toError(caught);
          setError(nextError);
          setStatus('error');
          setResult(null);
          pollingRef.current = false;
          abortControllerRef.current = null;
        }
      }
    },
    [reset]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  return useMemo(
    () => ({
      status,
      isIdle: status === 'idle',
      isPolling: status === 'polling',
      isSuccess: status === 'success',
      isFailed: status === 'failed',
      isTimeout: status === 'timeout',
      isError: status === 'error',
      error,
      result,
      hash,
      poll,
      reset
    }),
    [status, error, result, hash, poll, reset]
  );
}
