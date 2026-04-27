import { xdr } from '@stellar/stellar-sdk';
import {
  isValidXDR,
  assertValidXDR,
  MAX_XDR_STRING_LENGTH,
} from '../src/utils/xdrValidator';
import { InvalidXDRError } from '../src/errors/axionveraError';
import { decodeXdrBase64, clearXdrCache } from '../src/utils/xdrCache';
import { parseEvents } from '../src/utils/soroban';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** A known-good ScVal base64 XDR string (scvSymbol "transfer"). */
function validXdr(): string {
  return xdr.ScVal.scvSymbol('transfer').toXDR('base64');
}

// ---------------------------------------------------------------------------
// isValidXDR
// ---------------------------------------------------------------------------

describe('isValidXDR()', () => {
  test('returns true for a valid base64 XDR string', () => {
    expect(isValidXDR(validXdr())).toBe(true);
  });

  test('returns true for a minimal 4-char base64 string', () => {
    expect(isValidXDR('AAAA')).toBe(true);
  });

  test('returns true for base64 with standard padding', () => {
    expect(isValidXDR('AAAA==')).toBe(true);
    // The regex validates alphabet + length only, not block alignment.
    // Structural XDR validity is caught by the stellar-sdk parser inside a try/catch.
    expect(isValidXDR('AAAB=')).toBe(true);  // passes alphabet+length check
    expect(isValidXDR('AAAA=')).toBe(true);  // passes alphabet+length check
  });

  test('returns true for base64url characters (- and _)', () => {
    // Replace + and / with - and _ to simulate url-safe base64
    const urlSafe = validXdr().replace(/\+/g, '-').replace(/\//g, '_');
    expect(isValidXDR(urlSafe)).toBe(true);
  });

  test('returns false for an empty string', () => {
    expect(isValidXDR('')).toBe(false);
  });

  test('returns false for non-string values', () => {
    expect(isValidXDR(null as any)).toBe(false);
    expect(isValidXDR(undefined as any)).toBe(false);
    expect(isValidXDR(42 as any)).toBe(false);
  });

  test('returns false for strings shorter than 4 characters', () => {
    expect(isValidXDR('AAA')).toBe(false);
    expect(isValidXDR('A')).toBe(false);
  });

  test('returns false when the string contains spaces', () => {
    expect(isValidXDR('AAAA BBBB')).toBe(false);
  });

  test('returns false when the string contains non-base64 characters', () => {
    expect(isValidXDR('AAAA!@#$')).toBe(false);
    expect(isValidXDR('<script>alert(1)</script>')).toBe(false);
    expect(isValidXDR('not-valid-xdr!!')).toBe(false);
  });

  test('returns false when the string exceeds MAX_XDR_STRING_LENGTH', () => {
    const oversized = 'A'.repeat(MAX_XDR_STRING_LENGTH + 1);
    expect(isValidXDR(oversized)).toBe(false);
  });

  test('returns true for exactly MAX_XDR_STRING_LENGTH characters', () => {
    // Must still be valid base64; pad to a multiple-of-4 length
    const length = MAX_XDR_STRING_LENGTH - (MAX_XDR_STRING_LENGTH % 4);
    const exactly = 'A'.repeat(length);
    expect(isValidXDR(exactly)).toBe(true);
  });

  test('respects a custom maxLength override', () => {
    const small = 'AAAA'; // exactly 4 chars
    expect(isValidXDR(small, 4)).toBe(true);
    expect(isValidXDR(small + 'BBBB', 4)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// assertValidXDR
// ---------------------------------------------------------------------------

describe('assertValidXDR()', () => {
  test('does not throw for a valid base64 XDR string', () => {
    expect(() => assertValidXDR(validXdr())).not.toThrow();
  });

  test('throws InvalidXDRError for an empty string', () => {
    expect(() => assertValidXDR('')).toThrow(InvalidXDRError);
    expect(() => assertValidXDR('')).toThrow(/must not be empty/);
  });

  test('throws InvalidXDRError for non-string input', () => {
    expect(() => assertValidXDR(null as any)).toThrow(InvalidXDRError);
    expect(() => assertValidXDR(undefined as any)).toThrow(InvalidXDRError);
    expect(() => assertValidXDR(42 as any)).toThrow(InvalidXDRError);
  });

  test('throws InvalidXDRError for invalid characters', () => {
    expect(() => assertValidXDR('not-valid!!')).toThrow(InvalidXDRError);
    expect(() => assertValidXDR('not-valid!!')).toThrow(/invalid characters/);
  });

  test('throws InvalidXDRError for an oversized string', () => {
    const oversized = 'A'.repeat(MAX_XDR_STRING_LENGTH + 1);
    expect(() => assertValidXDR(oversized)).toThrow(InvalidXDRError);
    expect(() => assertValidXDR(oversized)).toThrow(/exceeds the maximum allowed length/);
    expect(() => assertValidXDR(oversized)).toThrow(/CPU and memory/);
  });

  test('includes the context name in the error message', () => {
    try {
      assertValidXDR('!!', 'myFunction');
    } catch (e) {
      expect(e).toBeInstanceOf(InvalidXDRError);
      expect((e as InvalidXDRError).message).toContain('in myFunction');
    }
  });

  test('respects a custom maxLength override', () => {
    expect(() => assertValidXDR('AAAABBBB', undefined, 4)).toThrow(InvalidXDRError);
    expect(() => assertValidXDR('AAAA', undefined, 4)).not.toThrow();
  });

  test('error .input is truncated to 64 chars for huge inputs', () => {
    const big = 'A'.repeat(200);
    try {
      assertValidXDR(big, undefined, 100); // use custom small limit
    } catch (e) {
      expect((e as InvalidXDRError).input.length).toBeLessThanOrEqual(65); // 64 + ellipsis
    }
  });
});

// ---------------------------------------------------------------------------
// InvalidXDRError
// ---------------------------------------------------------------------------

describe('InvalidXDRError', () => {
  test('is an instance of Error', () => {
    const err = new InvalidXDRError('test', 'AAAA');
    expect(err).toBeInstanceOf(Error);
  });

  test('has name "InvalidXDRError"', () => {
    const err = new InvalidXDRError('test', 'AAAA');
    expect(err.name).toBe('InvalidXDRError');
  });

  test('exposes .input property', () => {
    const err = new InvalidXDRError('test', 'AAAA');
    expect(err.input).toBe('AAAA');
  });

  test('truncates .input to 64 characters', () => {
    const long = 'A'.repeat(100);
    const err = new InvalidXDRError('test', long);
    expect(err.input.length).toBeLessThanOrEqual(65);
    expect(err.input.endsWith('…')).toBe(true);
  });

  test('preserves short inputs without truncation', () => {
    const short = 'ABCD';
    const err = new InvalidXDRError('test', short);
    expect(err.input).toBe(short);
  });

  test('accepts originalError in options', () => {
    const original = new Error('original');
    const err = new InvalidXDRError('wrap', 'AAAA', { originalError: original });
    expect(err.originalError).toBe(original);
  });
});

// ---------------------------------------------------------------------------
// xdrCache integration
// ---------------------------------------------------------------------------

describe('decodeXdrBase64 (xdrCache) – XDR sanitization', () => {
  beforeEach(() => clearXdrCache());

  test('decodes a valid XDR string without throwing', () => {
    expect(() => decodeXdrBase64(validXdr())).not.toThrow();
  });

  test('throws InvalidXDRError for an empty string', () => {
    expect(() => decodeXdrBase64('')).toThrow(InvalidXDRError);
  });

  test('throws InvalidXDRError for a string with special characters', () => {
    expect(() => decodeXdrBase64('not-valid-xdr!!')).toThrow(InvalidXDRError);
  });

  test('throws InvalidXDRError for an oversized string', () => {
    const oversized = 'A'.repeat(MAX_XDR_STRING_LENGTH + 1);
    expect(() => decodeXdrBase64(oversized)).toThrow(InvalidXDRError);
  });

  test('throws InvalidXDRError (not a raw sdk error) for structurally invalid base64 XDR', () => {
    // This passes the regex (valid base64 chars) but fails XDR structural parse
    const validBase64ButBadXdr = 'AAAAAAAAAA==';
    let caughtError: unknown;
    try {
      decodeXdrBase64(validBase64ButBadXdr);
    } catch (e) {
      caughtError = e;
    }
    // Must be an InvalidXDRError, not a raw sdk Buffer error
    expect(caughtError).toBeInstanceOf(InvalidXDRError);
  });
});

// ---------------------------------------------------------------------------
// soroban.parseEvents integration
// ---------------------------------------------------------------------------

describe('parseEvents() – XDR sanitization', () => {
  test('parses events with valid XDR topics normally', () => {
    const xdrStr = xdr.ScVal.scvSymbol('transfer').toXDR('base64');
    const events = [{ id: '1', topic: [xdrStr], value: 'v' }];
    const result = parseEvents(events);
    expect(result[0].topicNames[0]).toBe('transfer');
  });

  test('keeps an invalid XDR topic as-is (graceful fallback)', () => {
    const events = [{ id: '2', topic: ['not-base64-xdr!!'], value: 'v' }];
    const result = parseEvents(events);
    // Should not throw; bad topics fall back to the raw string
    expect(result[0].topicNames[0]).toBe('not-base64-xdr!!');
  });

  test('keeps an oversized topic string as-is without crashing', () => {
    const oversized = 'A'.repeat(MAX_XDR_STRING_LENGTH + 1);
    const events = [{ id: '3', topic: [oversized], value: 'v' }];
    expect(() => parseEvents(events)).not.toThrow();
    const result = parseEvents(events);
    expect(result[0].topicNames[0]).toBe(oversized);
  });
});

