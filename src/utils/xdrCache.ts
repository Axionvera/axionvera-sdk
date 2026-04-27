import { xdr } from "@stellar/stellar-sdk";
import { InvalidXDRError } from '../errors/axionveraError';
import { assertValidXDR } from './xdrValidator';

const MAX_CACHE_SIZE = 50;

const cache = new Map<string, xdr.ScVal>();

/**
 * Decodes a base64-encoded XDR ScVal string, returning a cached result when the
 * same input is seen again. The cache is bounded to MAX_CACHE_SIZE entries using
 * an LRU eviction strategy (oldest entry evicted first).
 *
 * @throws {InvalidXDRError} If the input is not a valid, length-safe base64 string.
 */
export function decodeXdrBase64(input: string): xdr.ScVal {
  // Sanitize before any buffer allocation; throws InvalidXDRError on bad input.
  assertValidXDR(input, 'decodeXdrBase64');

  if (cache.has(input)) {
    const cached = cache.get(input)!;
    // Refresh insertion order so this entry is evicted last (LRU)
    cache.delete(input);
    cache.set(input, cached);
    return cached;
  }

  let decoded: xdr.ScVal;
  try {
    decoded = xdr.ScVal.fromXDR(input, "base64");
  } catch (err) {
    throw new InvalidXDRError(
      `XDR decoding failed in decodeXdrBase64: ${
        err instanceof Error ? err.message : String(err)
      }`,
      input,
      { originalError: err },
    );
  }

  if (cache.size >= MAX_CACHE_SIZE) {
    cache.delete(cache.keys().next().value!);
  }

  cache.set(input, decoded);
  return decoded;
}

export function clearXdrCache(): void {
  cache.clear();
}

export function getXdrCacheSize(): number {
  return cache.size;
}
