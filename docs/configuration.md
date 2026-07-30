# Configuration

> **Last updated:** 2026-07-29

The Axionvera SDK loads configuration from environment variables. All
variables are optional; sensible defaults are provided for each.

## Environment Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `AXIONVERA_RPC_URL` | string | `""` | URL of the Stellar RPC endpoint |
| `AXIONVERA_NETWORK` | string | `"public"` | Network passphrase (`public` or `testnet`) |
| `AXIONVERA_TIMEOUT_MS` | number | `30000` | HTTP request timeout in milliseconds |
| `AXIONVERA_MAX_RETRIES` | number | `3` | Maximum retry attempts for failed requests |
| `AXIONVERA_RETRY_DELAY_MS` | number | `1000` | Base delay between retries (exponential backoff) |
| `AXIONVERA_LOG_LEVEL` | string | `"info"` | Logging verbosity (`debug`, `info`, `warn`, `error`) |

## Loading Order

1. Environment variables are read at SDK initialization.
2. Missing variables fall back to their defaults.
3. Invalid values (wrong types) cause a thrown error at startup.

## Example

```bash
export AXIONVERA_RPC_URL="https://horizon.stellar.org"
export AXIONVERA_NETWORK="public"
export AXIONVERA_LOG_LEVEL="debug"
```
