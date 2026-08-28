# @axionvera/react

Clean v2 React bindings for Axionvera apps.

## Installation

```bash
npm install @axionvera/react @axionvera/core
```

Requires `react >= 18` (peer dependency).

## Quick start

### AxionveraProvider

Wrap your app with `AxionveraProvider` and pass an optional `WalletConnector`:

```tsx
import { AxionveraProvider } from '@axionvera/react';
import { MockWalletConnector } from '@axionvera/core';

const wallet = new MockWalletConnector('GABC1234567890');

export function App() {
  return (
    <AxionveraProvider wallet={wallet}>
      <WalletStatus />
      <DepositButton />
    </AxionveraProvider>
  );
}
```

### useWallet

`useWallet` exposes the wallet connection state from the provider:

```tsx
import { useWallet } from '@axionvera/react';

function WalletStatus() {
  const { connect, disconnect, connection, isConnected } = useWallet();

  if (isConnected) {
    return <button onClick={() => disconnect()}>Disconnect {connection?.publicKey}</button>;
  }

  return <button onClick={() => connect()}>Connect wallet</button>;
}
```

### useVault

`useVault` creates a `VaultContract` and exposes its read and write helpers plus submitting and error state:

```tsx
import { useVault } from '@axionvera/react';
import type { ContractInvoker } from '@axionvera/core';

// The same ContractInvoker you would pass to VaultContract in @axionvera/core
const invoker: ContractInvoker = {
  async invoke(request) {
    // forward to your Soroban transaction layer
    return { status: 'success' };
  },
  async read(request) {
    // forward to your Soroban read layer
    return {};
  }
};

function DepositButton() {
  const { deposit, isSubmitting, error, resetError } = useVault({
    contractId: 'YOUR_CONTRACT_ID',
    invoker,
    walletAddress: 'GABC1234567890'
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
```

Write helpers (`deposit`, `withdraw`, `claimRewards`) require a `walletAddress`; action errors are stored in `error` state and can be cleared with `resetError`.

### Current Limitations

The React bindings follow the same adapter-based pattern as the core package:

- `useVault` requires you to provide a `ContractInvoker` implementation
- No built-in Soroban transaction submission or wallet signing
- Use `SorobanContractInvoker` from `@axionvera/core` for basic RPC routing (currently a skeleton)
- Provide your own invoker for production use with real Stellar transaction building and signing

## Development commands

```bash
npm run lint
npm run typecheck
npm run build
```
## Complete Vault & Wallet Example

For a fully typed end-to-end component illustrating provider setup, wallet connection, vault reads, deposit execution, and error handling, see [`examples/react-vault-example.tsx`](../../examples/react-vault-example.tsx).

```tsx
import { AxionveraProvider, useWallet, useVault } from '@axionvera/react';

function VaultManager({ contractId, invoker }) {
  const { publicKey, connect, isConnected } = useWallet();
  const { deposit, isSubmitting, error } = useVault({
    contractId,
    invoker,
    walletAddress: publicKey,
  });

  if (!isConnected) {
    return <button onClick={connect}>Connect Wallet</button>;
  }

  return (
    <div>
      <button onClick={() => deposit('100')} disabled={isSubmitting}>
        {isSubmitting ? 'Depositing...' : 'Deposit 100'}
      </button>
      {error && <p style={{ color: 'red' }}>{error.message}</p>}
    </div>
  );
}