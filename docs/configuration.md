# Configuration

> **Last updated:** 2026-08-30

The Axionvera SDK accepts network configuration directly or through your application's environment layer. The built-in `testnet` preset supplies the Stellar testnet RPC URL, Horizon URL, and network passphrase. All contract IDs remain application-specific and must be supplied separately.

Maintainers will provide real deployed contract IDs after testnet deployment. Until then, use the placeholders in [`.env.example`](../.env.example) and [`examples/testnet-sdk-config.json`](../examples/testnet-sdk-config.json); never submit live transactions with them.

## Environment Variables

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `AXIONVERA_RPC_URL` | string | testnet preset | URL of the Stellar RPC endpoint |
| `AXIONVERA_HORIZON_URL` | string | testnet preset | URL of the Horizon endpoint |
| `AXIONVERA_NETWORK` | string | `"testnet"` | Network name (`testnet`, `mainnet`, or `futurenet`) |
| `AXIONVERA_NETWORK_PASSPHRASE` | string | network preset | Stellar network passphrase |
| `VAULT_CONTRACT_ID` | string | none | Deployed vault contract ID; placeholder until maintainer handoff |
| `DEPOSIT_TOKEN_CONTRACT_ID` | string | none | Deposit token contract ID; placeholder until maintainer handoff |
| `REWARD_TOKEN_CONTRACT_ID` | string | none | Reward token contract ID; placeholder until maintainer handoff |
| `AXIONVERA_TIMEOUT_MS` | number | `30000` | HTTP request timeout in milliseconds |
| `AXIONVERA_MAX_RETRIES` | number | `3` | Maximum retry attempts for failed requests |
| `AXIONVERA_RETRY_DELAY_MS` | number | `1000` | Base delay between retries (exponential backoff) |
| `AXIONVERA_LOG_LEVEL` | string | `"info"` | Logging verbosity (`debug`, `info`, `warn`, `error`) |

## Loading Order

1. Environment variables are read at SDK initialization.
2. Missing variables fall back to their defaults.
3. Invalid values (wrong types) cause a thrown error at startup.

## Testnet example

```ts
import { AxionveraClient } from '@axionvera/core';

const client = new AxionveraClient({
  network: 'testnet',
  // These are the Stellar testnet values. Keep the passphrase exact.
  rpcUrl: process.env.AXIONVERA_RPC_URL,
  networkPassphrase: process.env.AXIONVERA_NETWORK_PASSPHRASE
});

console.log(client.getNetworkConfig());
```

For a complete placeholder-only configuration, see [`examples/testnet-sdk-config.ts`](../examples/testnet-sdk-config.ts) and [`examples/testnet-sdk-config.json`](../examples/testnet-sdk-config.json).

`resolveNetworkConfig()` validates and normalizes the selected network preset, but it does not accept placeholder contract IDs as deployed contracts. Application-level validation should reject values containing `YOUR_` before live calls.

For local development, copy [`.env.example`](../.env.example) to `.env` and fill in maintainer-provided values when available. **Never commit the `.env` file with real values.**
