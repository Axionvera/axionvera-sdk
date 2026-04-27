import { InvalidXDRError } from '../errors/axionveraError';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Maximum permitted byte-length of a consumer-supplied XDR string.
 *
 * Soroban transactions in practice are well under 100 KB when base64-encoded.
 * Setting an upper bound of 64 KB prevents CPU-exhaustion / zip-bomb style
 * attacks where an attacker submits an enormous base64 payload and forces the
 * server to allocate a proportionally huge Buffer.
 *
 * Override this constant if your use-case genuinely requires larger payloads.
 */
export const MAX_XDR_STRING_LENGTH = 65_536; // 64 KiB of base64 characters

/**
 * Standard base64 alphabet: A-Z, a-z, 0-9, +, /
 * Padding character: =
 *
 * This regex also accepts base64url (-, _) because some Stellar tooling emits
 * URL-safe base64.  Both variants are valid XDR envelope encodings.
 *
 * The regex enforces:
 *   - Only base64 / base64url characters
 *   - Optional one or two `=` padding chars at the tail
 *   - Minimum length of 4 characters (the smallest possible XDR envelope)
 */
const BASE64_RE = /^[A-Za-z0-9+/\-_]{4,}[=]{0,2}$/;

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Returns `true` when `xdrString` is a structurally valid, length-safe XDR
 * string (purely base64-encoded, within the length limit).
 *
 * **This function does NOT parse the XDR** — it only validates the outer
 * encoding envelope.  A string that passes this check can still represent
 * semantically invalid XDR; parsing errors from the stellar-sdk will still
 * be surfaced, but safely wrapped.
 *
 * @param xdrString - Candidate XDR string from an untrusted source
 * @param maxLength - Override the default maximum string length
 */
export function isValidXDR(
  xdrString: string,
  maxLength: number = MAX_XDR_STRING_LENGTH,
): boolean {
  if (typeof xdrString !== 'string') return false;
  if (xdrString.length === 0) return false;
  if (xdrString.length > maxLength) return false;
  return BASE64_RE.test(xdrString);
}

/**
 * Asserts that `xdrString` is a safe, well-formed XDR envelope string.
 *
 * Throws {@link InvalidXDRError} immediately — before the input reaches the
 * stellar-sdk — if any of the following conditions are true:
 *
 * - The value is not a string
 * - The string is empty
 * - The string exceeds `maxLength` characters (default: 64 KiB)
 * - The string contains characters outside the base64 / base64url alphabet
 *
 * @param xdrString - Candidate XDR string from an untrusted source
 * @param context   - Optional label used in the error message (e.g. the function name)
 * @param maxLength - Override the default maximum string length
 *
 * @throws {@link InvalidXDRError}
 *
 * @example
 * ```typescript
 * // In an SDK function that accepts user-supplied XDR:
 * assertValidXDR(transactionXdr, 'parseTransactionXdr');
 * // Safe to call stellar-sdk now
 * return TransactionBuilder.fromXDR(transactionXdr, networkPassphrase);
 * ```
 */
export function assertValidXDR(
  xdrString: string,
  context?: string,
  maxLength: number = MAX_XDR_STRING_LENGTH,
): void {
  const where = context ? ` in ${context}` : '';

  if (typeof xdrString !== 'string') {
    throw new InvalidXDRError(
      `XDR input${where} must be a string, received ${typeof xdrString}`,
      String(xdrString),
    );
  }

  if (xdrString.length === 0) {
    throw new InvalidXDRError(
      `XDR input${where} must not be empty`,
      xdrString,
    );
  }

  if (xdrString.length > maxLength) {
    throw new InvalidXDRError(
      `XDR input${where} exceeds the maximum allowed length of ${maxLength} characters ` +
        `(received ${xdrString.length} characters). ` +
        `Oversized XDR inputs can exhaust server CPU and memory.`,
      xdrString,
    );
  }

  if (!BASE64_RE.test(xdrString)) {
    throw new InvalidXDRError(
      `XDR input${where} contains invalid characters. ` +
        `Only base64-encoded strings (A-Z, a-z, 0-9, +, /, -, _, with optional = padding) are accepted.`,
      xdrString,
    );
  }
}
