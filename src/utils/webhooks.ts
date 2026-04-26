import { InvalidSignatureError } from "../errors/axionveraError";

/**
 * Verifies an HMAC-SHA256 webhook signature from an Axionvera indexer.
 *
 * Uses a constant-time byte comparison to prevent timing attacks. The
 * signature header is normalized to lowercase before comparison so callers
 * don't have to care about hex casing. Built on the Web Crypto API
 * (`globalThis.crypto.subtle`) so it runs identically in Node.js 18+,
 * Cloudflare Workers, Vercel Edge, Deno, and modern browsers.
 *
 * @param payloadString - The raw webhook request body as a string. Pass the
 *   exact bytes you received — do not re-stringify a parsed JSON object.
 * @param signatureHeader - The value of the X-Axionvera-Signature header (hex)
 * @param secretKey - Your webhook secret key
 * @returns `true` if the signature is valid
 * @throws {InvalidSignatureError} if the signature does not match
 *
 * @example
 * ```typescript
 * app.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
 *   await verifyWebhookSignature(
 *     req.body.toString('utf8'),
 *     req.headers['x-axionvera-signature'] as string,
 *     process.env.WEBHOOK_SECRET!
 *   );
 *   res.sendStatus(200);
 * });
 * ```
 */
export async function verifyWebhookSignature(
  payloadString: string,
  signatureHeader: string,
  secretKey: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secretKey);
  const payload = encoder.encode(payloadString);

  const cryptoKey = await globalThis.crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await globalThis.crypto.subtle.sign(
    "HMAC",
    cryptoKey,
    payload
  );

  const computedHex = bytesToHex(new Uint8Array(signatureBuffer));
  const providedHex = signatureHeader.toLowerCase();

  if (computedHex.length !== providedHex.length) {
    throw new InvalidSignatureError('Webhook signature verification failed');
  }

  let mismatch = 0;
  for (let i = 0; i < computedHex.length; i++) {
    mismatch |= computedHex.charCodeAt(i) ^ providedHex.charCodeAt(i);
  }

  if (mismatch !== 0) {
    throw new InvalidSignatureError('Webhook signature verification failed');
  }

  return true;
}

function bytesToHex(bytes: Uint8Array): string {
  let hex = "";
  for (let i = 0; i < bytes.length; i++) {
    hex += bytes[i].toString(16).padStart(2, "0");
  }
  return hex;
}
