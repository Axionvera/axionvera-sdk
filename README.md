# Axionvera SDK

[![npm version](https://img.shields.io/npm/v/axionvera-sdk.svg)](https://www.npmjs.com/package/axionvera-sdk)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/%3C%2F%3E-TypeScript-%230074c1.svg)](https://www.typescriptlang.org/)
[![Build Status](https://github.com/axionvera/axionvera-sdk/actions/workflows/ci.yml/badge.svg)](https://github.com/axionvera/axionvera-sdk/actions)

**Axionvera SDK v2** is a clean, strongly typed TypeScript toolkit for building dApps and services on top of Axionvera Soroban smart contracts on the Stellar network. It is a monorepo split into focused, independently installable packages so applications pull in only what they need.

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

### Current Implementation Status

**Implemented:**
- `AxionveraClient` with configurable `RpcTransport` for Stellar RPC calls
- `VaultContract` with typed methods for vault operations (deposit, withdraw, claimRewards, etc.)
- `SorobanContractInvoker` - adapter that routes requests through RPC transport
- `buildSorobanInvokeRequest()` - validates and builds Soroban invocation request objects
- `WalletConnector` interface with `MockWalletConnector` for development
- React bindings (`AxionveraProvider`, `useWallet`, `useVault`)

**Current Limitations:**
- No live Soroban transaction submission - `SorobanContractInvoker` is a skeleton adapter
- No Stellar transaction building (XDR assembly, fee handling, sequence numbers)
- No wallet signing integration for transaction submission
- RPC transport exists but Soroban-specific RPC methods are not fully implemented

**Next Steps (Roadmap):**
1. Complete Stellar transaction building with XDR assembly
2. Implement fee estimation and sequence number management
3. Add wallet signing integration for transaction submission
4. Implement full Soroban RPC method support (simulateTransaction, sendTransaction)
5. Add transaction lifecycle management (submission, polling, confirmation)

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
- [Configuration](./docs/configuration.md)

## Development

```bash
npm ci             # install dependencies
npm run lint       # ESLint
npm run typecheck  # TypeScript type checking
npm run build      # build all packages
npm run test       # typecheck + build + unit tests
```

## Contributing

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for details on the code of conduct and the process for submitting pull requests.

## License

This project is licensed under the MIT License — see the [LICENSE](./LICENSE) file for details.

_Built with ❤️ by the Axionvera Team._
