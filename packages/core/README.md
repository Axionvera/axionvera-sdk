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
- `MockWalletConnector` is a development/test implementation of `WalletConnector`.

No production Soroban invoker or transaction builder is shipped yet — plug in your own via `transport` and `invoker`, or start with the mocks.

## Development commands

```bash
npm run lint
npm run typecheck
npm run build
```
