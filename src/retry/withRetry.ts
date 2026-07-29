/**
 * Retry engine — the runner.
 *
 * Wraps any async operation with a {@link RetryPolicy}, honouring a total
 * attempt cap, an overall time budget, an AbortSignal, and a diagnostics hook.
 */

import { TimeoutError } from '../errors';
import type { RetryOptions, RetryPolicy } from './types';
import { errorTypeName, isRetryableError } from './errorClassification';

/** Error thrown when the retry loop is aborted via an AbortSignal. */
export class RetryAbortedError extends Error {
  constructor(message = 'Retry aborted') {
    super(message);
    this.name = 'RetryAbortedError';
  }
}

function abortableSleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new RetryAbortedError());
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = () => {
      clearTimeout(timer);
      reject(new RetryAbortedError());
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}

const now = (): number =>
  typeof performance !== 'undefined' && typeof performance.now === 'function'
    ? performance.now()
    : Date.now();

/**
 * Run `fn`, retrying transient failures according to `policy`.
 *
 * Resolves with `fn`'s result on the first success. Rejects with the last
 * error once the policy stops retrying, the attempt/time budget is exhausted,
 * or the signal aborts.
 *
 * @example
 * const ledger = await withRetry(
 *   () => client.getLatestLedger(),
 *   new ExponentialBackoffPolicy({ maxAttempts: 5 }),
 *   { onRetry: (e) => diagnostics.record('retry', e) },
 * );
 */
export async function withRetry<T>(
  fn: (attempt: number) => Promise<T>,
  policy: RetryPolicy,
  options: RetryOptions = {}
): Promise<T> {
  const { maxAttempts, maxElapsedMs, signal, onRetry } = options;
  const isRetryable = options.isRetryable ?? isRetryableError;
  const start = now();

  let attempt = 1;
  for (;;) {
    if (signal?.aborted) throw new RetryAbortedError();

    try {
      return await fn(attempt);
    } catch (error) {
      const elapsedMs = now() - start;
      const context = { attempt, error, elapsedMs };

      const hitAttemptCap = typeof maxAttempts === 'number' && attempt >= maxAttempts;
      const policySaysRetry = policy.shouldRetry(context) && isRetryable(error);

      if (hitAttemptCap || !policySaysRetry) {
        throw error;
      }

      let delayMs = Math.max(0, policy.nextDelayMs(context));

      // Respect the overall time budget: never sleep past it.
      if (typeof maxElapsedMs === 'number') {
        const remaining = maxElapsedMs - elapsedMs;
        if (remaining <= 0)
          throw new TimeoutError('Retry time budget exhausted', { originalError: error });
        delayMs = Math.min(delayMs, remaining);
      }

      onRetry?.({
        attempt,
        delayMs,
        error,
        errorType: errorTypeName(error),
        elapsedMs,
      });

      await abortableSleep(delayMs, signal);
      attempt += 1;
    }
  }
}
