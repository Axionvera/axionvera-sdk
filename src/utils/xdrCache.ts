import { xdr } from "@stellar/stellar-sdk";

const MAX_CACHE_SIZE = 50;

const cache = new Map<string, xdr.ScVal>();

/**
 * Decodes a base64-encoded XDR ScVal string, returning a cached result when the
 * same input is seen again. The cache is bounded to MAX_CACHE_SIZE entries using
 * an LRU eviction strategy (oldest entry evicted first).
 */
export function decodeXdrBase64(input: string): xdr.ScVal {
  if (cache.has(input)) {
    const cached = cache.get(input)!;
    // Refresh insertion order so this entry is evicted last (LRU)
    cache.delete(input);
    cache.set(input, cached);
    return cached;
  }

  const decoded = xdr.ScVal.fromXDR(input, "base64");

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
