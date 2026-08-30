# @axionvera/core

Clean v2 core SDK for Axionvera vaults, wallet connectors, contract calls, and Stellar/Soroban app integrations.

## Installation

```bash
npm install @axionvera/core
```

## Quick start

### Create a client

```ts
import { AxionveraClient } from '@axionvera/core';

const client = new AxionveraClient({ network: 'testnet' });

client.getNetworkConfig();
// { network: 'testnet', rpcUrl: 'https://soroban-testnet.stellar.org', networkPassphrase: 'Test SDF Network ; September 2015' }

const health = await client.getHealth();
const transaction = await client.getTransaction('TX_HASH');
```

### Configure a vault contract with a mock invoker

`VaultContract` delegates every call to a `ContractInvoker`. Provide a real adapter for production, or a mock for development and tests:

```ts
import { VaultContract, type ContractInvoker } from '@axionvera/core';

const invoker: ContractInvoker = {
  async invoke({ contractId, method, args }) {
    // forward to your Soroban transaction layer
    return { status: 'success' };
  },
  async read({ contractId, method, args }) {
    // forward to your Soroban read layer
    return {};
  }
};

const vault = new VaultContract({
  contractId: 'YOUR_CONTRACT_ID',
  invoker
});

const info = await vault.getInfo();                    // reads get_info
const balance = await vault.getBalance('G...');        // reads get_balance
const rewards = await vault.getPendingRewards('G...'); // reads get_pending_rewards
const deposit = await vault.deposit('G...', 100n);     // invokes deposit
const withdrawal = await vault.withdraw('G...', 50n);  // invokes withdraw
const claim = await vault.claimRewards('G...');        // invokes claim_rewards
```

When `invoker.read` is not provided, read methods fall back to `invoker.invoke`.

### Using SorobanContractInvoker

The SDK includes `SorobanContractInvoker`, a basic adapter that routes contract calls through an RPC transport:

```ts
import { SorobanContractInvoker, AxionveraClient } from '@axionvera/core';

const client = new AxionveraClient({ network: 'testnet' });
const invoker = new SorobanContractInvoker({ client });

const vault = new VaultContract({
  contractId: 'YOUR_CONTRACT_ID',
  invoker
});
```

**Important:** `SorobanContractInvoker` is currently a skeleton implementation. It validates request shapes and routes to RPC methods (`simulateTransaction` for reads, `sendTransaction` for invokes), but does not perform real Stellar transaction building, signing, or submission. Use it for testing the contract interface, or provide your own invoker for production use.

### Building Soroban invocation requests

Use `buildSorobanInvokeRequest()` to validate and construct Soroban invocation request objects:

```ts
import { buildSorobanInvokeRequest } from '@axionvera/core';

const request = buildSorobanInvokeRequest({
  contractId: 'CABCDEF0000000000000000000000000000000000000000000000000000000001',
  method: 'deposit',
  args: ['GUSER', 100],
  sourceAccount: 'GSOURCE'
});

// Returns validated SorobanInvokeRequest with trimmed contractId/method
```

This helper validates:
- `contractId` must be a non-empty string
- `method` must be a non-empty string
- `args` must be an array when provided (defaults to empty array)
- `sourceAccount` must be a string when provided (optional)

### Contract Handoffs

Safely load contract IDs from deployment artifacts with strict network and format validation:

```ts
import { loadContractIdFromHandoff } from '@axionvera/core';
import artifact from './deployment-handoff.json';

const contractId = loadContractIdFromHandoff(artifact, {
  contractName: 'vault',
  network: 'testnet'
});
```

The loader validates:
- The artifact structure matches the required schema.
- The contract exists in the artifact.
- The contract is deployed on the expected network.
- The contract ID is a valid Soroban ID or an explicitly allowed placeholder.

### Use a mock wallet

```ts
import { MockWalletConnector } from '@axionvera/core';

const wallet = new MockWalletConnector('GABC1234567890');
const { publicKey, network } = await wallet.connect();
// { publicKey: 'GABC1234567890', network: 'testnet' }
```

Implement the `WalletConnector` interface to integrate a browser wallet extension or a backend signer.

## Foundation layer

RPC and Soroban invocation are adapter-based in v2:

- `AxionveraClient` uses an `RpcTransport` (default: `FetchRpcTransport`) and accepts a custom `transport` in its config.
- Contract calls go through a `ContractInvoker` that you supply.
- `SorobanContractInvoker` provides a basic adapter that routes requests through the transport (currently a skeleton).
- `MockWalletConnector` is a development/test implementation of `WalletConnector`.

No production Soroban invoker or transaction builder is shipped yet — plug in your own via `transport` and `invoker`, or start with the mocks.

## Development commands

```bash
npm run lint
npm run typecheck
npm run build
```
