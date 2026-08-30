# Security Policy

## Supported versions

Security fixes are applied to the latest published release of the Axionvera SDK
on npm. Please upgrade to the latest version before reporting an issue.

## Reporting a vulnerability

Please **do not** open a public GitHub issue for security vulnerabilities.

Instead, report privately using one of the following:

- GitHub's [private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing-information-about-vulnerabilities/privately-reporting-a-security-vulnerability)
  ("Report a vulnerability" under the repository's **Security** tab), or
- the security contact listed in the repository / npm package metadata.

When reporting, please include:

- a description of the issue and the affected interaction flow,
- steps to reproduce or a proof of concept,
- the SDK version and runtime (Node.js, browser, edge),
- the potential impact as you see it.

We aim to acknowledge reports promptly and will keep you informed as we
investigate and prepare a fix. Please give us a reasonable window to release a
patch before any public disclosure.

## Scope

This SDK is a client library for interacting with Axionvera contracts on Stellar
/ Soroban. In scope: transaction building, signing, submission, wallet
connectors, RPC transport, faucet, webhook verification, SEP-0007 URI generation,
logging, and state hydration. Out of scope: the on-chain contracts, the Stellar
network itself, and third-party wallet extensions.

## Security guidance for SDK users

- **Protect secret keys.** `LocalKeypairWalletConnector` holds a Stellar secret
  seed in process memory; use it only in trusted server environments, never ship
  a seed to a browser, and prefer a wallet connector for client-side signing.
- **Use HTTPS RPC endpoints.** Only set `allowHttp: true` for local development.
- **Always simulate and review fees** before submitting transactions; use
  `maxFeeLimit` to cap automated spending.
- **Verify webhook signatures** with `verifyWebhookSignature`, passing the raw
  request body (not a re-stringified object).
- **Keep logging redaction in mind.** Avoid logging secret seeds; see the logging
  notes in the security review.

## Secret management for maintainers

⚠️ **CRITICAL: Never commit secrets to the repository**

Maintainers performing real testnet integration must follow these security practices:

- **Never commit** private keys, seed phrases, or wallet mnemonics
- **Never commit** real contract IDs for production deployments
- **Never commit** API keys, authentication tokens, or RPC credentials
- **Never commit** personal wallet addresses or sensitive configuration
- **Always use** environment variables for sensitive configuration
- **Always add** `.env` files to `.gitignore`
- **Always provide** `.env.example` files with placeholder values only
- **Always use** secure secret management for production (AWS Secrets Manager, etc.)
- **Always rotate** secrets regularly and audit access logs
- **Always validate** user inputs before processing transactions

### Environment variable pattern

See [`.env.example`](.env.example) for the complete template. The pattern is:

```bash
# .env.example (Safe to commit - placeholders only)
AXIONVERA_RPC_URL="https://soroban-testnet.stellar.org"
AXIONVERA_NETWORK="testnet"
VAULT_CONTRACT_ID="YOUR_CONTRACT_ID"

# .env (Never commit - real values)
AXIONVERA_RPC_URL="https://real-endpoint.example.com"
AXIONVERA_NETWORK="testnet"
VAULT_CONTRACT_ID="CAXIONVERA_REAL_CONTRACT_ID_1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ"
```

For detailed maintainer security guidelines, see [docs/maintainer-handoff.md](docs/maintainer-handoff.md#security-guidelines).

## Security review

An internal review of the SDK's interaction flows and the resulting findings is
documented in [docs/SECURITY_REVIEW.md](docs/SECURITY_REVIEW.md).
