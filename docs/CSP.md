# Content Security Policy (CSP) Compliance

Axionvera SDK is designed to be safe for use in high-security banking and fintech frontends. This documentation explains the CSP guarantees and the exact RPC domains that must be allowed.

## CSP guarantee

- The SDK does not use `eval()`.
- The SDK does not use `new Function()`.
- The SDK does not rely on `unsafe-inline` script execution.
- The SDK is audited for unsafe JavaScript execution patterns in the repository source.
- A strict browser-based CSP audit is included in CI to prove runtime compliance.

## How this is audited

1. A static repository scan looks for common unsafe dynamic execution patterns such as `eval()`, `new Function()`, `Function(...)`, and string-based `setTimeout()` / `setInterval()` calls.
2. The SDK is then built and loaded in a headless Chromium browser under a strict `Content-Security-Policy` that only allows same-origin scripts and approved RPC endpoints.

## Tested policy

The SDK is verified under a strict Content Security Policy that includes:

```text
Content-Security-Policy: default-src 'none'; script-src 'self'; connect-src 'self' https://soroban-testnet.stellar.org https://soroban-mainnet.stellar.org; style-src 'self'; img-src 'self'; font-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none';
```

This policy ensures the SDK can load only same-origin scripts and only connect to approved RPC endpoints.

## Required `connect-src` whitelisting

For the default networks, whitelist the following RPC URLs in your frontend's `connect-src` directive:

- `https://soroban-testnet.stellar.org`
- `https://soroban-mainnet.stellar.org`

If your application uses a custom RPC endpoint, add that exact origin as well.

Example header:

```text
Content-Security-Policy: connect-src 'self' https://soroban-testnet.stellar.org https://soroban-mainnet.stellar.org;
```

## Notes for integrators

- `script-src` should remain restricted to `'self'` or a trusted bundle source.
- `style-src`, `img-src`, and `font-src` should follow your application's existing security posture.
- The SDK itself does not require `unsafe-eval` or `unsafe-inline` for any of its runtime behavior.
