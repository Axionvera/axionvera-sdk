# Axionvera SDK Security Review

This document records a security review of the Axionvera SDK interaction flows.
It catalogues the trust boundaries the SDK sits on, the risks identified during
the review, their severity, and the recommended mitigations. It is intended as a
living document: each finding lists the affected flow so it can be re-checked as
the code evolves.

- **Scope:** transaction building/signing/submission, wallet connectors, RPC
  transport, faucet, webhook verification, SEP-0007 URI generation, logging, and
  state hydration.
- **Out of scope:** the on-chain Soroban contracts themselves, the security of
  the Stellar network, and third-party wallet extensions (e.g. Freighter).
- **Method:** manual source review of the SDK interaction flows under `src/`.

---

## Trust model

The SDK is consumed in two materially different contexts, and several findings
depend on which one applies:

1. **Browser / dApp (untrusted client):** signing is delegated to a browser
   wallet (`BrowserWalletConnector`). The SDK never sees a secret key. The main
   risks are malicious XDR, callback/URI injection, and leaking data to logs.
2. **Server / backend (trusted but sensitive):** signing uses
   `LocalKeypairWalletConnector`, which holds a Stellar secret key in process
   memory. The main risks are secret-key exposure (logs, error objects, crash
   dumps) and insecure transport.

Inputs that cross a trust boundary and are treated as untrusted by this review:
transaction XDR (from wallets, RPC, or callers), RPC responses, webhook request
bodies, persisted hydration state, and any user-supplied address/amount/URL.

---

## Summary of findings

| # | Finding | Flow | Severity |
|---|---------|------|----------|
| 1 | Sensitive data sent to CloudWatch is not redacted | Logging | High |
| 2 | Redaction does not cover Stellar secret seeds (`S...`) | Logging | Medium |
| 3 | SEP-0007 `callback` URL scheme is not validated | SEP-7 URIs | Medium |
| 4 | Insecure HTTP transport only blocked when `NODE_ENV=production` | RPC transport | Medium |
| 5 | Faucet interpolates the public key into the URL unencoded | Faucet | Low |
| 6 | `importState` / date thawing is open to prototype pollution | State hydration | Low |
| 7 | `MockWalletConnector` returns unsigned XDR | Wallet | Low (informational) |

Controls that were reviewed and found to be **sound** are listed in
[Positive findings](#positive-findings).

---

## Findings

### 1. Sensitive data sent to CloudWatch bypasses redaction (High)

**Flow:** `src/utils/logger.ts` → `logWithCloudWatch` / `sendToCloudWatch`.

`Logger.redact()` correctly scrubs the values that go to the console:

```ts
const redactedMessage = this.redact(message);
const redactedArgs = args.map((a) => this.redact(a));
// console output uses the redacted values …
this.sendToCloudWatch(logLevel, message, args.length > 0 ? args : undefined);
```

The CloudWatch path is handed the **raw** `message` and `args`, not the redacted
copies. Any secret that redaction would have masked on the console is forwarded
verbatim to CloudWatch, where it is persisted and indexed. CloudWatch is exactly
the kind of long-lived, widely-readable sink where a leaked credential is most
damaging.

**Recommendation:** pass the already-redacted `redactedMessage` /
`redactedArgs` to `sendToCloudWatch`, so a single redaction pass protects every
sink. Apply redaction once, before fanning out to destinations.

---

### 2. Redaction patterns do not cover Stellar secret seeds (Medium)

**Flow:** `src/utils/logger.ts` → `redact`.

`redact()` masks values by key name (`secret`, `password`, `token`,
`private_key`, …) and a few token shapes (`Bearer …`, `apiKey=…`). It does **not**
recognise a Stellar secret seed, which has a well-defined shape: a base32 string
beginning with `S` and 56 characters long. If a seed is logged as a bare string
(for example inside a free-text message such as `` `signing with ${secret}` ``,
or nested in an array argument), it passes through unredacted.

Given the SDK's purpose, a secret seed is the single most sensitive value it can
encounter, so it deserves an explicit pattern.

**Recommendation:** add a redaction rule for the `S[A-Z2-7]{55}` seed shape (and
optionally a defensive rule for raw 64-hex private keys). Keep it conservative to
avoid masking public keys (`G...`) or other base32 data.

---

### 3. SEP-0007 `callback` URL scheme is not validated (Medium)

**Flow:** `src/utils/sep7.ts` → `generateTransactionURI`.

```ts
params.append("callback", `url:${callbackUrl}`);
```

`URLSearchParams` percent-encodes the value, so query-string injection is
prevented. However the **scheme** of `callbackUrl` is never checked. A caller
that forwards an attacker-controlled value can emit a SEP-7 URI whose callback is
`http://…` (signed transaction POSTed in cleartext) or a `javascript:` / `data:`
URI. Per SEP-0007 the wallet POSTs the signed transaction to this callback, so an
attacker-chosen callback can exfiltrate a signed transaction.

Two related gaps: the generated URIs are unsigned (no SEP-7 `origin_domain` /
`signature`), so a receiving wallet cannot attribute them; this is acceptable for
a generator but should be documented.

**Recommendation:** validate that `callbackUrl` parses as a URL and uses `https:`
(allow `http:` only for localhost during development). Reject other schemes.
Document that the produced URIs are unsigned and that wallets will warn on them.

---

### 4. Insecure HTTP transport is only blocked in production (Medium)

**Flow:** `src/client/stellarClient.ts` constructor + `rpc.Server({ allowHttp })`.

The insecure-transport guard only triggers when
`process.env.NODE_ENV === 'production'`:

```ts
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction && isHttp && !isLocalhost && !allowHttp) {
  throw new InsecureNetworkError(/* … */);
}
```

Outside production (the default when `NODE_ENV` is unset — which is common in
scripts, serverless functions, and CI), a plaintext `http://` RPC URL to a remote
host is accepted silently, and `allowHttp` is then forwarded to the underlying
`rpc.Server`. RPC traffic carries transaction XDR and account data; over cleartext
it is exposed to network observers and MITM tampering. Relying on an environment
variable as the sole gate is fragile because the variable is frequently unset.

**Recommendation:** when a remote (non-localhost) `http://` endpoint is used and
`allowHttp` was not explicitly set, emit a warning regardless of `NODE_ENV`, and
treat unset `NODE_ENV` as non-trusted rather than implicitly safe.

---

### 5. Faucet interpolates the public key into the URL unencoded (Low)

**Flow:** `src/client/faucetClient.ts` → `fundAccount`.

```ts
url = `https://friendbot.stellar.org/?addr=${publicKey}`;
```

`publicKey` is concatenated into the query string without `encodeURIComponent`
and without validating it as a Stellar account ID. A malformed value containing
`&` or `#` allows query-parameter pollution against Friendbot. Impact is low
(testnet/futurenet only, and Mainnet is already rejected), but it is an untrusted
value flowing into a URL.

**Recommendation:** validate `publicKey` with the SDK's address validation (or
`StrKey.isValidEd25519PublicKey`) and use `encodeURIComponent`, or build the URL
with `URL`/`URLSearchParams`.

---

### 6. State hydration is open to prototype pollution (Low)

**Flow:** `src/client/stellarClient.ts` → `importState` → `thawContext` /
`thawDates`.

`importState` accepts a JSON string (typically from `localStorage`, an untrusted
client store) and rebuilds `simulationContext` by walking the parsed object:

```ts
for (const key of Object.keys(obj)) {
  out[key] = thawDates(obj[key]);
}
```

Keys are copied without filtering `__proto__` / `constructor` / `prototype`.
Although the destination is a fresh object literal (which limits direct
pollution), copying attacker-controlled keys into objects is a known
prototype-pollution sink and should be guarded defensively, especially since the
source is persisted client state that an attacker who controls the page can
modify.

**Recommendation:** skip the dangerous keys (`__proto__`, `constructor`,
`prototype`) when rebuilding objects, or use `Object.create(null)` /
`Map`-backed structures for the rehydrated context.

---

### 7. `MockWalletConnector` returns unsigned XDR (Low / informational)

**Flow:** `src/wallet/walletConnector.ts` → `MockWalletConnector.signTransaction`.

The mock returns the input XDR unchanged. This is correct for sandbox/demo use
and is documented, but if a `MockWalletConnector` is wired into a real client by
mistake, `sendTransaction` will submit an unsigned transaction (which the network
rejects — no funds are at risk). Worth a guard rail so it cannot be used silently
against Mainnet.

**Recommendation:** keep the mock test-only; consider a runtime warning if it is
constructed while the client network is `mainnet`.

---

## Positive findings

These controls were reviewed and are well-implemented; they are recorded so they
are preserved through future refactors.

- **XDR input hardening** (`src/utils/xdrValidator.ts`): every untrusted XDR
  string is length-capped (64 KiB) and alphabet-checked *before* being handed to
  the stellar-sdk parser, guarding against buffer/CPU-exhaustion from oversized
  inputs. `assertValidXDR` is correctly applied in the local-keypair connector,
  the browser connector, and on the wallet's returned XDR in `sendTransaction`.
- **Webhook signature verification** (`src/utils/webhooks.ts`): uses Web Crypto
  HMAC-SHA256 and a constant-time comparison of the full hex strings, with
  case-normalisation. It correctly requires the raw request body (documented) and
  throws rather than returning `false`, which discourages truthy misuse.
- **Wallet-returned XDR is re-validated** in `sendTransaction` before being
  re-parsed, so a malicious or buggy wallet cannot inject an oversized/garbage
  payload into the parser.
- **Retry policy is submission-safe** (`src/utils/httpInterceptor.ts`): only
  `GET`/`PUT` are auto-retried, so transaction submission (`POST`) is never
  silently replayed, avoiding accidental double-spend.
- **Fee ceilings** (`maxFeeLimit`, `feeBufferMultiplier` validation in the
  `StellarClient` constructor and `applyFeeBuffer`) bound the fee an automated
  flow can attach to a transaction.

---

## Recommended follow-ups

Priority order, derived from the table above:

1. Redact before fan-out so CloudWatch (and any future sink) cannot leak secrets
   — finding 1.
2. Add a Stellar secret-seed redaction pattern — finding 2.
3. Validate the SEP-7 `callback` scheme and document unsigned URIs — finding 3.
4. Warn on remote cleartext RPC regardless of `NODE_ENV` — finding 4.
5. Encode/validate faucet input — finding 5.
6. Filter dangerous keys during state hydration — finding 6.

Each item is small and self-contained; they can be addressed as individual
follow-up PRs referencing this review.
