/**
 * Sleep utility for delays and backoff.
 *
 * Centralized so callers do not duplicate
 * `new Promise(resolve => setTimeout(resolve, ms))`.
 */

export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
