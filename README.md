# Axionvera SDK

[![npm version](https://img.shields.io/npm/v/axionvera-sdk.svg)](https://www.npmjs.com/package/axionvera-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](https://www.typescriptlang.org/)
[![Build Status](https://github.com/axionvera/axionvera-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/axionvera/axionvera-sdk/actions)

**Axionvera SDK v2** is a clean, strongly typed TypeScript toolkit for building dApps and services on top of Axionvera Soroban smart contracts on the Stellar network. It is a monorepo split into focused, independently installable packages so applications pull in only what they need.

- 🛠 **Contract Handoffs**: Safely load contract IDs from deployment artifacts with strict network and format validation.
- 📦 **Placeholder Support**: Support for development-time placeholder contract IDs with explicit opt-in.
- 🚀 **MVP Demo Workflow**: A ready-to-use React component (`VaultDemo`) demonstrating a complete vault interaction workflow.
- 📦 **Release Packet Generator**: A maintainer tool for collecting and verifying non-secret artifacts before release.
- 🧪 **Contributor-Safe Smoke Tests**: Repeatable offline smoke test template for SDK validation (mocked by default; live mode is maintainer-only).
- 🏗 **Soroban Native**: Built for the latest Soroban smart contract features.

## Packages

| Package | Description |
| --- | --- |
| [`@axionvera/core`](./packages/core/README.md) | Core client (`AxionveraClient`), network configuration, wallet connectors (`WalletConnector`, `MockWalletConnector`), the `VaultContract` module, typed errors, and shared types. |
| [`@axionvera/react`](./packages/react/README.md) | React bindings: `AxionveraProvider`, `useWallet`, and `useVault`. |

## Installation

Requires Node.js 18+.

```bash
# Core SDK (client, contracts, wallet connectors)
npm install @axionvera/core

# React bindings (peer dependencies: @axionvera/core, react >= 18)
npm install @axionvera/react @axionvera/core
```

## Quick start

### 1. Create a client

```ts
import { AxionveraClient } from '@axionvera/core';

const client = new AxionveraClient({ network: 'testnet' });

const health = await client.getHealth();
const transaction = await client.getTransaction('TX_HASH');
```

### 2. Configure a vault contract

Contract calls are routed through a `ContractInvoker` that you provide — bring your own adapter for live Soroban calls, or use a mock while developing.

```ts
import { VaultContract, type ContractInvoker } from '@axionvera/core';

const invoker: ContractInvoker = {
  async invoke(request) {
    /* forward to your Soroban transaction layer */
    return { status: 'success' };
  },
  async read(request) {
    /* forward to your Soroban read layer */
    return {};
  }
};

const vault = new VaultContract({ contractId: 'YOUR_CONTRACT_ID', invoker });

const info = await vault.getInfo();
const balance = await vault.getBalance('G...');
const result = await vault.deposit('G...', 100n);
```

### 3. Use a mock wallet

```ts
import { MockWalletConnector } from '@axionvera/core';

const wallet = new MockWalletConnector('G...');
const { publicKey, network } = await wallet.connect();
```

### 4. Wire the React provider

```tsx
import { AxionveraProvider, useVault } from '@axionvera/react';
import { MockWalletConnector } from '@axionvera/core';

const wallet = new MockWalletConnector('G...');

function DepositButton() {
  // `invoker` is the same ContractInvoker from step 2
  const { deposit, isSubmitting, error, resetError } = useVault({
    contractId: 'YOUR_CONTRACT_ID',
    invoker,
    walletAddress: 'G...'
  });

  if (error) {
    return <button onClick={resetError}>{error.message}</button>;
  }

  return (
    <button disabled={isSubmitting} onClick={() => deposit(100n)}>
      {isSubmitting ? 'Depositing...' : 'Deposit 100'}
    </button>
  );
}

function App() {
  return (
    <AxionveraProvider wallet={wallet}>
      <DepositButton />
    </AxionveraProvider>
  );
}
```

Complete, copyable examples for each package live in the package READMEs: [`@axionvera/core`](./packages/core/README.md) and [`@axionvera/react`](./packages/react/README.md).

The repository also includes a provider-generic signing example at
[`examples/mock-wallet-signing-pipeline.ts`](./examples/mock-wallet-signing-pipeline.ts), a placeholder-only SDK testnet configuration at [`examples/testnet-sdk-config.ts`](./examples/testnet-sdk-config.ts), and a React testnet flow at [`examples/react-testnet-flow.tsx`](./examples/react-testnet-flow.tsx).

## Architecture

The SDK v2 is built in focused layers with clear separation of concerns:

### ContractInvoker Pattern

The `ContractInvoker` interface is the core abstraction for Soroban contract interactions. It defines two methods:

- `invoke(request)` - For write operations that modify contract state
- `read(request)` - For read-only operations that query contract state

`VaultContract` uses this pattern to delegate all contract calls to your invoker implementation. This design allows:

- **Flexibility**: Bring your own Soroban transaction layer, Stellar SDK integration, or custom signing logic
- **Testability**: Use mock invokers in tests without hitting the network
- **Progressive enhancement**: Start with mocks, swap in real implementation when ready

### Wallet Layer

The SDK provides a wallet abstraction for connecting to Stellar-compatible wallets:

- `WalletConnector` interface - Standard interface for wallet implementations
- `MockWalletConnector` - Development/testing wallet with connection state tracking
- `signWithWallet()` - Helper for signing transactions through wallet connectors
- `createTransactionSigningPipeline()` - Provider-generic prepare unsigned XDR -> wallet signing flow
- `checkWalletReadiness()` - Validates wallet state before operations

**Wallet Readiness Flow:**
1. Connect wallet using `wallet.connect()` - returns public key and network
2. Check connection status with `wallet.isConnected()` - returns boolean
3. Validate readiness with `checkWalletReadiness()` - ensures connector and connection are valid
4. Sign transactions with `signWithWallet()` - wraps signing errors consistently
5. For prepared unsigned XDR, use `createTransactionSigningPipeline()` to keep wallet provider details outside transaction preparation

### Transaction Layer

The SDK provides normalized types and helpers for transaction management:

- `TransactionActionResult` - Standardized result shape with status, hash, ledger, error
- Helper functions: `transactionSuccess()`, `transactionPending()`, `transactionFailed()`, `transactionTimeout()`
- `waitForTransaction()` - Polls for transaction status with configurable intervals
- `TransactionTimeoutError` - Thrown when polling exceeds max attempts

**Transaction Status Flow:**
1. Submit transaction - receive hash
2. Poll with `waitForTransaction()` - uses lookup function to check status
3. Handle terminal states (`success`, `failed`) - return result
4. Handle non-terminal states (`pending`, `not_found`) - continue polling
5. Handle timeout - throw `TransactionTimeoutError` after max attempts

### React Hook Layer

React bindings provide stateful hooks for wallet, vault, and transaction management:

- `AxionveraProvider` - Context provider for wallet and configuration
- `useWallet` - Wallet connection state and operations
- `useVault` - Vault contract operations with submission state
- `useTransactionAction` - Generic async action state management
- `useTransactionStatus` - Transaction polling with React state

**React Hook Flow:**
1. Wrap app with `AxionveraProvider` and wallet connector
2. Use `useWallet` to manage connection (connect, disconnect, check status)
3. Use `useVault` to read vault state (`getInfo`, `getBalance`, `getPendingRewards`)
4. Use `useVault` write methods for operations (`deposit`, `withdraw`, `claimRewards`)
5. Use `useTransactionStatus` to poll and track transaction confirmation

### Mocked Integration Testing

The SDK includes comprehensive mock utilities for integration-style testing:

- `MockWalletConnector` - Predictable wallet behavior for tests
- `TestContractInvoker` - Mock contract invoker with response configuration
- `sdkWorkflow.test.tsx` - Full workflow tests covering connect → read → write → poll

**Mocked Integration Behavior:**
- Wallet connection/disconnection is simulated with state tracking
- Contract calls return configured responses without network calls
- Transaction polling uses vitest mocked timers for fast tests
- All scenarios (success, failure, timeout, disconnection) are testable

### Current Implementation Status

**Implemented:**
- `AxionveraClient` with configurable `RpcTransport` for Stellar RPC calls
- `VaultContract` with typed methods for vault operations (deposit, withdraw, claimRewards, etc.)
- `SorobanContractInvoker` - adapter that routes requests through RPC transport
- `buildSorobanInvokeRequest()` - validates and builds Soroban invocation request objects
- `WalletConnector` interface with `MockWalletConnector` for development
- Transaction result types and polling helpers
- **Soroban Transaction Execution Schema** - comprehensive schema for execution requests and results (mocked/testnet-ready)
- React bindings (`AxionveraProvider`, `useWallet`, `useVault`, `useTransactionAction`, `useTransactionStatus`)
- Comprehensive test coverage with mocked integration tests

**Current Limitations:**
- No live Soroban transaction submission - `SorobanContractInvoker` is a skeleton adapter
- No Stellar transaction building (XDR assembly, fee handling, sequence numbers)
- No wallet signing integration for transaction submission
- RPC transport exists but Soroban-specific RPC methods are not fully implemented
- Transaction polling requires custom lookup function (no built-in RPC integration)

**Next Steps (Roadmap):**
1. Complete Stellar transaction building with XDR assembly
2. Implement fee estimation and sequence number management
3. Add wallet signing integration for transaction submission
4. Implement full Soroban RPC method support (simulateTransaction, sendTransaction)
5. Add built-in transaction lookup function for `waitForTransaction` using RPC
6. Add transaction lifecycle management (submission, polling, confirmation) with automatic retry

### Foundation Layer

v2 intentionally keeps RPC and Soroban invocation adapter-based:

- `AxionveraClient` talks to RPC through an `RpcTransport` (default `FetchRpcTransport`), which you can replace with a custom transport.
- `VaultContract` delegates every call to a `ContractInvoker` you provide.
- `SorobanContractInvoker` provides a basic adapter that routes requests through the transport (currently a skeleton).
- `MockWalletConnector` implements the `WalletConnector` interface for development and tests.

A production-ready Soroban transaction submission layer is not shipped yet — pass your own `transport` and `invoker`, or start with the mocks.

## Documentation

- [SDK Overview](./docs/sdk-overview.md)
- [Usage Guide](./docs/usage-guide.md)
- [Transaction Signing Pipeline](./docs/transaction-signing-pipeline.md)
- [SDK-to-Network Compatibility Fixtures](./docs/sdk-network-compatibility.md)
- [Configuration](./docs/configuration.md) — including testnet RPC, passphrase, token, and placeholder contract examples

## Development

```bash
npm ci             # install dependencies
npm run lint       # ESLint
npm run typecheck  # TypeScript type checking
npm run build      # build all packages
npm run test       # typecheck + build + unit tests
```

### SDK Smoke Test (Contributor-Safe by Default)

After any meaningful change to the SDK, run the offline-safe smoke test template to
validate the plumbing. This always defaults to **mocked + dry-run** mode — no real
RPC calls, no secrets, and no write submissions are ever required:

```bash
# Safe default: mocked mode, reads examples/smoke-test-input.json
npm run smoke-test

# Same with explicit plan-only dry-run and a custom config:
npm run smoke-test -- --config examples/smoke-test-input.json --mode dry-run

# Example output written to examples/smoke-test-output.json (already committed)
```

Under the hood this runs `node scripts/smoke-test-sdk.js`.  The script:

- Validates your config against the schema in
  [schemas/smoke-test-config.schema.json](./schemas/smoke-test-config.schema.json).
- Accepts `PLACEHOLDER_*` contract IDs so contributors never need real IDs.
- Generates a report to `options.outputFile` with exact counts of live RPC calls /
  write submissions.
- **Refuses** to enter maintainer live mode unless both `--mode live` AND
  `--no-dry-run` are passed AND the env guards `AXIONVERA_MAINTAINER=1` +
  `NODE_ENV=maintenance` are set locally.

The dry-run validation harness exercises all eight safe paths and runs in <5 s:

```bash
node scripts/test-smoke-test.js
```

See the full guide at [docs/smoke-test-maintainer-guide.md](./docs/smoke-test-maintainer-guide.md).

### Release Readiness Check

Before connecting to live testnet deployment, run the release readiness script to verify the SDK is ready:

```bash
node scripts/release-readiness.js          # Full check with quality commands
node scripts/release-readiness.js --dry-run # File existence checks only
```

The script verifies:
- Required documentation files (README.md, CONTRIBUTING.md, LICENSE, SECURITY.md)
- Package README files (packages/core/README.md, packages/react/README.md)
- Example files (execution, mock simulation, wallet signing, React vault, SDK compatibility)
- Schema files (network-vault-interface.fixture.json)
- Build outputs (packages/*/dist directories)
- Quality commands (lint, typecheck, build, vitest)

See [scripts/release-readiness.js](./scripts/release-readiness.js) for details.

## Maintainer Integration

For information about connecting the SDK to the deployed Network vault contract, see the [Maintainer Handoff Guide](./docs/maintainer-handoff.md). This guide separates contributor-safe work from maintainer-only actions and explains how SDK config, wallet signing, RPC submission, and transaction polling fit together.

## Contributing

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for details on the code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License — see the [LICENSE](./LICENSE) file for details.

_Built with ❤️ by the Axionvera Team._

## Dashboard Integration

For integrating this SDK into a Dashboard application, see the [Dashboard Integration Checklist](./docs/DASHBOARD_INTEGRATION_CHECKLIST.md).

### Quick Start

1. Copy the `.env.example` and configure your environment
2. Run `npm install` in the dashboard project
3. Import the SDK and start using the hooks

### Documentation

- [Integration Checklist](./docs/DASHBOARD_INTEGRATION_CHECKLIST.md)
- [React Package](./packages/react/README.md)
- [Examples](./examples/dashboard-integration/README.md)
