# Axionvera SDK

[![npm version](https://img.shields.io/npm/v/axionvera-sdk.svg)](https://www.npmjs.com/package/axionvera-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](https://www.typescriptlang.org/)
[![Build Status](https://github.com/axionvera/axionvera-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/axionvera/axionvera-sdk/actions)

**Axionvera SDK** is a powerful, robust TypeScript developer toolkit designed to simplify interactions with Axionvera smart contracts deployed on the Stellar blockchain using Soroban. It provides a clean, strongly typed interface for dApp developers to connect, build, simulate, and submit transactions with ease.

---

## 📖 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Prerequisites](#-prerequisites)
- [Installation](#-installation)
- [Quick Start](#-quick-start)
- [Migration Guide](#-migration-guide)
- [Usage Examples](#-usage-examples)
- [Module Architecture](#-module-architecture)
- [Dependency Injection](#dependency-injection)
- [ABI Version Compatibility](#-abi-version-compatibility)
- [API Reference](#-api-reference)
- [Troubleshooting](#-troubleshooting)
- [Contributing](#-contributing)
- [License](#-license)
- [Contact](#-contact)

---

## 🌟 Overview

Building on Stellar's Soroban smart contract platform requires managing RPC connections, building XDR transactions, simulating contract calls for resource limits, and handling cryptographic signatures. The Axionvera SDK abstracts these complexities away. Whether you're building a frontend dApp or a backend service, the SDK provides the tools you need to interact with the Axionvera ecosystem safely and efficiently.

## ✨ Features

- **Network Management**: Seamlessly connect to Stellar networks (Testnet/Mainnet) via Soroban RPC.
- **Transaction Lifecycle**: Build, simulate, prepare, and submit Soroban contract call transactions in a few lines of code.
- **Resilience**: Built-in HTTP interceptors with exponential backoff for robust RPC interactions, handling rate limits automatically.
- **Configurable Logging**: Built-in logger with automatic sensitive data redaction for easier debugging.
- **Vault Contract Module**: Out-of-the-box support for the Axionvera Vault contract (`deposit`, `withdraw`, `balance`, `claimRewards`).
- **Faucet Client**: Automated account funding for Testnet and Futurenet environments.
- **SEP-0007 Support**: Standardized URI generation for mobile wallet deep-linking and QR code payments.
- **Wallet Integration**: Flexible `WalletConnector` interface, including a built-in `LocalKeypairWalletConnector` for server-side or automated signing.

---

## 📋 Prerequisites

Before using the Axionvera SDK, ensure you have the following installed:

- **Node.js**: v18.0.0 or higher is recommended.
- **Package Manager**: npm, yarn, or pnpm.
- **Stellar Account**: A funded Stellar account on your target network (Testnet or Mainnet) to pay for transaction fees.

---

## 📦 Installation

The SDK requires Node.js 18+ and has `@stellar/stellar-sdk` as a peer dependency.

Install the package using your preferred package manager:

**Using npm:**

```bash
npm install axionvera-sdk @stellar/stellar-sdk
```

**Using yarn:**

```bash
yarn add axionvera-sdk @stellar/stellar-sdk
```

**Using pnpm:**

```bash
pnpm add axionvera-sdk @stellar/stellar-sdk
```

### Modular Packages

The SDK is being split into independently installable packages so applications
can pull in only what they need. The first extracted package is
**`@axionvera/codegen`** (Soroban WASM spec parser + contract-client generator):

```bash
npm install @axionvera/codegen
```

```ts
import { parseWasm, generateContractClass } from '@axionvera/codegen';
```

**No import changes required:** `@axionvera/core` continues to re-export these
utilities through thin shims, so this extraction does not change any existing
import paths. New code should prefer the dedicated package to keep bundles lean.
See `packages/codegen/README.md` for details.

### TypeScript Configuration

Ensure your `tsconfig.json` has `strict: true` for full type safety:

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler"
  }
}
```

---

## 🚀 Quick Start

Here is a step-by-step guide to initializing the SDK, connecting a local wallet, and executing a transaction on the Vault contract.

```typescript
import { Keypair } from '@stellar/stellar-sdk';
import { LocalKeypairWalletConnector, StellarClient, VaultContract } from 'axionvera-sdk';

// 1. Initialize the Stellar Client for the Testnet
const client = new StellarClient({ network: 'testnet' });

// 2. Set up the Wallet Connector with your secret key
const keypair = Keypair.fromSecret(process.env.STELLAR_SECRET_KEY!);
const wallet = new LocalKeypairWalletConnector(keypair);

// 3. Initialize the Vault Contract wrapper
const vault = new VaultContract({
  client,
  contractId: process.env.AXIONVERA_VAULT_CONTRACT_ID!,
  wallet,
});

// 4. Execute a transaction
async function run() {
  try {
    console.log('Depositing 1000 units into the vault...');

    // The SDK automatically handles building, simulating, signing, and submitting the transaction
    const depositResult = await vault.deposit({ amount: 1000n });

    console.log('Transaction successful!');
    console.log('Result:', depositResult);
  } catch (error) {
    console.error('Transaction failed:', error);
  }
}

run();
```

---

## 🌐 Quick Start (Browser)

Try the SDK in your browser without any local setup using our interactive playground:

[![Open in StackBlitz](https://stackblitz.com/github/Listoncrypt/axionvera-sdk/badge.svg)](https://stackblitz.com/github/Listoncrypt/axionvera-sdk?file=examples/browser-sandbox/index.ts)

The browser sandbox uses the `MockWalletConnector` to demonstrate SDK initialization and wallet connection flows without requiring a real wallet extension. This is perfect for:

- Quick prototyping and testing
- Understanding the SDK API
- Demonstrating the SDK to stakeholders

To run the sandbox locally:

```bash
cd examples/browser-sandbox
npm install
npm run dev
```

---

## � Migration Guide

**Coming from Stellar Classic (stellar-sdk v10)?**

We've prepared a comprehensive [Migration Guide](./docs/MIGRATION_GUIDE.md) to help you transition from Classic operations to Soroban smart contracts. The guide covers:

- **Paradigm shift**: Understanding the difference between Classic Operations and Soroban `InvokeHostFunction`
- **Side-by-side examples**: Compare how you used to build transactions vs. the simplified Axionvera SDK approach
- **Common scenarios**: Migrating payment services, data storage, and multi-signature workflows
- **Best practices**: Error handling, resource estimation, and debugging in Soroban

Whether you're migrating an existing dApp or starting fresh, the migration guide bridges the knowledge gap and gets you productive quickly.

---

## �💻 Usage Examples

We provide detailed, runnable examples in the [`examples/`](./examples/) directory to help you understand specific workflows:

- 💰 **Deposit**: [depositExample.ts](./examples/depositExample.ts)
- 🏦 **Withdraw**: [withdrawExample.ts](./examples/withdrawExample.ts)
- ⚖️ **Check Balance**: [balanceExample.ts](./examples/balanceExample.ts)
- 🔄 **HTTP Retry Logic**: [retryExample.ts](./examples/retryExample.ts)

### Recover a Stuck Transaction with a Fee Bump

When a signed transaction is still pending and the network fee market moves, you can wrap the original signed XDR in a fee bump envelope instead of asking the user to re-sign the contract call.

```typescript
import { Keypair, Networks } from '@stellar/stellar-sdk';
import { LocalKeypairWalletConnector, bumpTransactionFee } from 'axionvera-sdk';

const sponsorWallet = new LocalKeypairWalletConnector(
  Keypair.fromSecret(process.env.SPONSOR_SECRET_KEY!)
);

const feeBumpEnvelopeXdr = bumpTransactionFee(userSignedXdr, 500, {
  feeSource: await sponsorWallet.getPublicKey(),
  networkPassphrase: Networks.TESTNET,
});

const sponsorSignedXdr = await sponsorWallet.signTransaction(feeBumpEnvelopeXdr, Networks.TESTNET);

await client.sendTransaction(sponsorSignedXdr);
```

This preserves the original user signature on the inner transaction. Only the outer fee bump envelope is signed by the sponsor wallet.

---

## 🏗️ Module Architecture

The SDK is organized into clear layers to keep concerns separated:

### `src/client/`

- **`StellarClient`**: Main entry point for Soroban RPC connections
- **`FaucetClient`**: Automated account funding for test networks

### `src/contracts/`

- **`VaultContract`**: High-level wrapper for the Axionvera Vault contract

### `src/wallet/`

- **`WalletConnector`**: Interface for wallet signing
- **`LocalKeypairWalletConnector`**: Built-in keypair signer for server-side use

### `src/utils/`

- **`networkConfig`**: Default RPC URLs and network passphrases
- **`transactionBuilder`**: Helpers to build Soroban contract calls
- **`concurrencyQueue`**: Rate limiting for high-volume apps
- **`sep7`**: URI generation for wallet deep-linking
- **`httpInterceptor`**: Retry logic with exponential backoff
- **`logger`**: Built-in logging with sensitive data redaction

### `src/errors/`

- Typed error classes for different failure modes

---

## Dependency Injection

Axionvera SDK services can be resolved through a lightweight dependency container. This keeps core modules loosely coupled while preserving the existing `new StellarClient(...)` API.

```typescript
import { StellarClient, createServiceContainer } from 'axionvera-sdk';

const container = createServiceContainer({
  rpcClient: mockRpcClient,
  httpClient: mockHttpClient,
  logger: testLogger,
});

const client = new StellarClient({
  network: 'testnet',
  container,
});
```

The default dependency graph is:

- `StellarClient` resolves a `LoggerService`, `HttpClient`, `RpcServer`, and optional `WebSocketManagerService`.
- `defaultRpcClientFactory` creates `@stellar/stellar-sdk` RPC clients and wraps them with concurrency control when `concurrencyConfig` is provided.
- `defaultHttpClientFactory` creates the retry-enabled Axios client.
- `defaultWebSocketManagerFactory` wires WebSocket callbacks to the resolved logger.

Migration is incremental: existing callers do not need changes, while tests and advanced integrations can override individual services with `services` or provide a preconfigured `ServiceContainer`.

## 🔄 ABI Version Compatibility

Axionvera contracts evolve over time — new fields, new methods, renamed on-chain functions. Without a compatibility layer, every SDK consumer would need to upgrade the moment any deployed contract changed shape. The ABI version compatibility framework lets several ABI versions of the same logical contract coexist — across environments, or mid-rollout in the same environment — while every caller keeps using one stable, canonical method interface.

### Architecture overview

Three pieces work together:

- **`AbiVersionRegistry`** (`src/registry/abiVersionRegistry.ts`) — registers an `AbiVersionDescriptor` per contract/version, and resolves which version a *deployed* contract instance is running via `detectVersion()`:
  1. **Explicit** — if the caller supplies `probe.readExplicitVersion()` (e.g. a `version()` view call) and it returns a version that's registered, that wins outright.
  2. **Inferred** — otherwise, every registered version is tried newest-first; the first one whose `fingerprintMethods` are ALL present on the deployed contract is used.
  3. **Unknown** — if neither resolves anything, detection reports `confidence: 'unknown'` and callers fall back to a configured default version (or surface an error).
- **`AbiCompatAdapter`** (`src/adapters/abiCompatAdapter.ts`) — a `ContractAdapter` that detects (and caches) the ABI version for each deployed contract address, then translates every canonical `read`/`write` call through that version's method mapping: serializing arguments down to the raw on-chain call, dispatching it via a `RawContractCaller`, then deserializing the raw result back up to the canonical shape.
- **Version-specific serializers/deserializers** — each `AbiMethodAdapter` carries an optional `serializeArgs`/`deserializeResult` pair. Deliberately, this is a *different* concern from `src/migrations` (which transforms *persisted* state offline): this layer governs *live RPC calls* for whichever ABI version happens to be deployed right now. The two compose naturally — see below.

### Supported ABI versions (Vault)

`src/contracts/vaultAbiVersions.ts` registers three ABI versions for the Vault contract against the shared `defaultAbiVersionRegistry`, matching the on-chain history already captured by `VaultStateV1`/`V2`/`V3` in `contractMigrations.ts`:

| Version | Adds | `getVaultInfo` raw method |
| --- | --- | --- |
| `v1` | Base vault: deposit, withdraw, balance | `get_vault_info` (no `apy`/`lockPeriod`/`feeBps`) |
| `v2` | Rewards program: `claimRewards`, `getPendingRewards`, `apy`, `lockPeriod` | `get_vault_info` |
| `v3` (latest) | Protocol fee: `feeBps` on `getVaultInfo`, plus a dedicated `getFeeBps` read | `get_vault_info` |

Rather than hand-writing a second upgrade path, `v1`/`v2`'s `getVaultInfo` deserializer reuses the migration steps already registered in `defaultMigrationRegistry` (`vaultV1ToV2Migration`, `vaultV2ToV3Migration`) to bring an older raw result up to the canonical `v3` shape — one raw RPC call becomes one migration-chain replay.

### Usage

```typescript
import {
  AbiCompatAdapter,
  defaultAbiVersionRegistry,
  VAULT_ABI_CONTRACT_ID,
} from 'axionvera-sdk';

const adapter = new AbiCompatAdapter({
  name: 'vault-abi-compat',
  contractId: VAULT_ABI_CONTRACT_ID,
  registry: defaultAbiVersionRegistry,
  raw: myRawContractCaller, // wraps StellarClient / VaultContract calls
  createProbe: (deployedContractId) => myOnChainProbe(deployedContractId),
  fallbackVersion: 'v1', // optional: used only if detection is inconclusive
});

// Works the same whether the deployed Vault is on ABI v1, v2, or v3 —
// the canonical result always has apy/lockPeriod/feeBps.
const info = await adapter.read(vaultContractId, 'getVaultInfo');
```

Register your own contract's ABI versions the same way `vaultAbiVersions.ts` does, against `defaultAbiVersionRegistry` (or an isolated `new AbiVersionRegistry()` for tests).

### Test coverage

- `tests/registry/abiVersionRegistry.test.ts` — registration/listing, `require()` error behavior, and all three detection paths (explicit, inferred-newest, inferred-oldest, unknown).
- `tests/adapters/abiCompatAdapter.test.ts` — version caching across calls, argument serialization, result deserialization, unsupported-method and detection-failure errors, `invalidate()`.
- `tests/contracts/vaultAbiVersions.test.ts` — integration coverage against the real Vault registrations, including the migration-registry replay that upgrades a `v1` raw result to the canonical `v3` shape.

### Upgrade considerations

- Register new ABI versions in ascending order (oldest first) — `getLatestVersion()` and the newest-first search in `detectVersion()` both rely on registration order.
- A canonical method absent from an older version's descriptor throws `UnsupportedContractMethodError` rather than silently no-op'ing — callers should treat this the same as a feature-detection gate.
- `AbiCompatAdapter` caches the detected version per deployed contract address; call `invalidate()` after a contract upgrade so the next call re-detects instead of using a stale version.
- If a contract exposes an explicit on-chain version tag, wire it through `probe.readExplicitVersion()` — it's checked before fingerprinting and avoids relying on method-presence heuristics entirely.

## 📚 API Reference

For deep architectural details, see the [SDK Overview](./docs/sdk-overview.md) and [Usage Guide](./docs/usage-guide.md). Below is a summary of the core API classes:

### `StellarClient`

The core client wrapping the Soroban RPC connection.

- `getHealth()`: Check the health of the RPC node.
- `simulateTransaction(tx)`: Simulates a transaction to calculate fees and resource footprints.
- `prepareTransaction(tx)`: Attaches the simulation footprints and minimum fees to the transaction.
- `sendTransaction(tx)`: Submits a signed transaction to the network.
- `pollTransaction(hash, params)`: Polls the network until a transaction reaches a final state (`SUCCESS` or `FAILED`).
- `logLevel`: Property in `StellarClientOptions` to control SDK output visibility.

### `VaultContract`

A high-level abstraction for the Axionvera Vault smart contract.

- `deposit({ amount, from })`: Deposits tokens into the vault.
- `withdraw({ amount, from })`: Withdraws tokens from the vault.
- `getBalance({ account })`: Retrieves the vault balance for a specific account.
- `getVaultShares({ account })`: Queries the user's balance of the Vault's share token (read-only).
- `getExchangeRate()`: Queries the current conversion rate between 1 Share and the underlying asset (read-only).
- `claimRewards({ from })`: Claims pending rewards for the caller.

### `FaucetClient`

Automated funding for Testnet and Futurenet.

- `fundAccount(publicKey)`: Hits the correct Friendbot endpoint based on the client's network. Throws `FaucetRateLimitError` if throttled.

### `SEP-0007 Utilities`

Standardized URI generation for mobile wallet integration.

- `generateTransactionURI(xdr, callbackUrl)`: Generates a `web+stellar:tx` URI.
- `generatePayURI(destination, amount, assetCode, assetIssuer)`: Generates a `web+stellar:pay` URI.
- `bumpTransactionFee(signedXdr, newBaseFee, options)`: Wraps a signed transaction XDR in an unsigned fee bump envelope for sponsor signing.

### `WalletConnector` (Interface)

Implement this interface to integrate browser extension wallets (like Freighter) or use the provided `LocalKeypairWalletConnector` for backend/scripting services.

- `getPublicKey()`: Returns the public key of the connected wallet.
- `signTransaction(xdr, passphrase)`: Signs a prepared transaction XDR string and returns the signed XDR.

---

## 🛠 Troubleshooting

If you encounter issues while using the SDK, check the following common problems:

- **Error: `Simulation failed`**
  This usually means the contract call reverted during simulation. Ensure your account has sufficient XLM for fees, the contract ID is correct, you are passing the correct arguments, and the contract logic allows the operation.
- **Error: `Timed out waiting for transaction`**
  The transaction was submitted but not confirmed within the polling window. You may need to increase the `timeoutMs` parameter in `pollTransaction` or check if the network is heavily congested.
- **Rate Limiting (HTTP 429)**
  The SDK automatically retries on `429 Too Many Requests` using exponential backoff. If you consistently hit rate limits, consider configuring a private RPC provider URL instead of using the default public endpoints during `StellarClient` initialization.

---

## 🤝 Contributing

We welcome and appreciate contributions from the community! Whether it's reporting a bug, suggesting a feature, or submitting a pull request, your input helps make this project better.

Please read our [Contributing Guidelines](./CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

### Development Setup

To set up the project locally for development:

```bash
git clone https://github.com/axionvera/axionvera-sdk.git
cd axionvera-sdk
npm ci
npm run build
npm run test
```

For a faster feedback loop during development, run typecheck separately:

```bash
npm run typecheck
npm run lint
```

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](./LICENSE) file for details.

---

## 📞 Contact

If you have any questions, feedback, or need support, feel free to reach out:

- **GitHub Issues**: For bug reports and feature requests, please use the [Issue Tracker](https://github.com/axionvera/axionvera-sdk/issues).
- **Website**: [https://axionvera.com](https://axionvera.com)
- **Twitter**: [@Axionvera](https://twitter.com/axionvera)

---

_Built with ❤️ by the Axionvera Team._
