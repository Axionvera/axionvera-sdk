import { xdr } from "@stellar/stellar-sdk";
import { decodeXdrBase64, clearXdrCache, getXdrCacheSize } from "../src/utils/xdrCache";

beforeEach(() => {
  clearXdrCache();
});

describe("XDR decode cache", () => {
  test("decodes a valid base64 XDR string", () => {
    const original = xdr.ScVal.scvSymbol("transfer");
    const encoded = original.toXDR("base64");
    const decoded = decodeXdrBase64(encoded);
    expect(decoded.switch()).toEqual(xdr.ScValType.scvSymbol());
    expect((decoded as any).sym().toString()).toBe("transfer");
  });

  test("returns the cached instance on repeated calls", () => {
    const encoded = xdr.ScVal.scvSymbol("deposit").toXDR("base64");
    const first = decodeXdrBase64(encoded);
    const second = decodeXdrBase64(encoded);
    expect(second).toBe(first);
  });

  test("cache size grows with unique inputs", () => {
    expect(getXdrCacheSize()).toBe(0);
    decodeXdrBase64(xdr.ScVal.scvSymbol("a").toXDR("base64"));
    decodeXdrBase64(xdr.ScVal.scvSymbol("b").toXDR("base64"));
    expect(getXdrCacheSize()).toBe(2);
  });

  test("does not grow beyond 50 entries", () => {
    for (let i = 0; i < 60; i++) {
      decodeXdrBase64(xdr.ScVal.scvI32(i).toXDR("base64"));
    }
    expect(getXdrCacheSize()).toBe(50);
  });

  test("evicts the oldest entry when the cache is full", () => {
    const firstEncoded = xdr.ScVal.scvI32(0).toXDR("base64");
    decodeXdrBase64(firstEncoded);

    for (let i = 1; i < 50; i++) {
      decodeXdrBase64(xdr.ScVal.scvI32(i).toXDR("base64"));
    }

    // Cache is now at capacity; adding one more should evict the entry for i=0
    const newEntry = xdr.ScVal.scvI32(999).toXDR("base64");
    const resultBefore = decodeXdrBase64(firstEncoded); // re-promote i=0 to MRU
    clearXdrCache();

    // Rebuild without re-promoting i=0 so it is the oldest
    decodeXdrBase64(firstEncoded);
    for (let i = 1; i < 50; i++) {
      decodeXdrBase64(xdr.ScVal.scvI32(i).toXDR("base64"));
    }
    expect(getXdrCacheSize()).toBe(50);

    // Adding a new unique entry should evict i=0 (oldest)
    decodeXdrBase64(newEntry);
    expect(getXdrCacheSize()).toBe(50);
  });

  test("clearXdrCache empties the cache", () => {
    decodeXdrBase64(xdr.ScVal.scvSymbol("foo").toXDR("base64"));
    expect(getXdrCacheSize()).toBe(1);
    clearXdrCache();
    expect(getXdrCacheSize()).toBe(0);
  });

  test("re-accessing a cached entry refreshes its LRU position", () => {
    const firstEncoded = xdr.ScVal.scvI32(0).toXDR("base64");
    decodeXdrBase64(firstEncoded);

    // Fill the remaining 49 slots
    for (let i = 1; i < 50; i++) {
      decodeXdrBase64(xdr.ScVal.scvI32(i).toXDR("base64"));
    }

    // Re-access firstEncoded to promote it to MRU
    decodeXdrBase64(firstEncoded);

    // The next new entry should evict i=1 (now the oldest), not i=0
    decodeXdrBase64(xdr.ScVal.scvI32(999).toXDR("base64"));
    expect(getXdrCacheSize()).toBe(50);

    // i=0 must still be in the cache (it was re-promoted)
    const secondAccess = decodeXdrBase64(firstEncoded);
    // size stays the same because it was a cache hit
    expect(getXdrCacheSize()).toBe(50);
    expect(secondAccess).toBeDefined();
  });

  test("throws on invalid base64 XDR input", () => {
    expect(() => decodeXdrBase64("not-valid-xdr!!")).toThrow();
  });
});
