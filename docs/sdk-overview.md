# SDK Overview

## Goals

Axionvera SDK provides a small, modular TypeScript API for interacting with Axionvera Soroban smart contracts on Stellar. The core design goals are:

- Minimal surface area and predictable behavior
- Testability without live network dependencies (mockable RPC)
- Separation of concerns between network, transaction building, wallet signing, and contract modules

## Architecture

### Client Layer (`src/client`)

**`StellarClient`** is the gateway to Soroban RPC. It is responsible for:

- Connecting to a Soroban RPC endpoint
- Fetching accounts
- Simulating and preparing Soroban transactions
- Submitting transactions and polling for completion

### Utilities (`src/utils`)

**`networkConfig`** centralizes default network configuration:

- Testnet/mainnet defaults
- Network passphrase resolution
- Override support for custom RPC URLs

**`transactionBuilder`** builds contract-call transactions:

- Converts common JS/TS values into Soroban `ScVal`
- Produces `invokeHostFunction` operations via `Contract.call`
- Builds transactions that can be simulated/prepared by Soroban RPC

### Wallet Integration (`src/wallet`)

**`WalletConnector`** is a small interface designed to work in browsers and backends:

- `getPublicKey()` returns the source account public key
- `signTransaction(xdr, networkPassphrase)` returns a signed transaction XDR

The SDK includes a `LocalKeypairWalletConnector` implementation for Node.js usage and testing.

The transaction signing pipeline keeps unsigned XDR preparation outside wallet
provider code. Apps can prepare and validate an unsigned XDR request, pass it to
any `WalletConnector`, and receive a signed result without importing a specific
browser extension adapter. `MockWalletConnector` covers this flow in tests and
examples without secrets or user prompts.

### Contract Modules (`src/contracts`)

Contract modules provide developer-friendly APIs for specific Axionvera contracts. Each module:

- Knows the contract ID
- Exposes named methods (deposit/withdraw/etc.)
- Uses `StellarClient` + `WalletConnector` to build, simulate, prepare, sign, and submit transactions

`VaultContract` is the initial module and serves as the reference implementation for future modules.

### Compatibility Fixtures

The SDK includes local SDK-to-Network compatibility fixtures for the Vault
interface. These fixtures compare the SDK's method, argument, and event
expectations against a mirrored Network schema without external repository,
GitHub, RPC, or testnet access.

## Extending the SDK

To add a new contract module:

1. Add a new file under `src/contracts/`
2. Implement a class that accepts `{ client, contractId, wallet? }`
3. Reuse `transactionBuilder` helpers for contract calls
4. Export the module from `src/index.ts`
5. Add Jest tests under `tests/`

## TODO

- Add additional contract modules (staking, governance)
- Add stronger argument typing per contract ABI
- Add richer wallet adapters (browser extension wallets, external signing)
- Add higher-level helpers for contract state queries and decoding
