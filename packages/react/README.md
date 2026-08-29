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

### useTransactionAction

`useTransactionAction` is a generic hook for managing async action state:

```tsx
import { useTransactionAction } from '@axionvera/react';

function MyComponent() {
  const { status, isIdle, isSubmitting, isSuccess, isError, error, result, run, reset } = 
    useTransactionAction<{ hash: string }>();

  const handleSubmit = async () => {
    const result = await run(async () => {
      // Your async action
      return { hash: 'abc123' };
    });
  };

  if (isSubmitting) return <div>Submitting...</div>;
  if (isError) return <div>Error: {error?.message}</div>;
  if (isSuccess) return <div>Success! Hash: {result?.hash}</div>;

  return <button onClick={handleSubmit}>Submit</button>;
}
```

The hook provides:
- `status` - Current state: `'idle' | 'submitting' | 'success' | 'error'`
- Boolean flags: `isIdle`, `isSubmitting`, `isSuccess`, `isError`
- `error` - Error object if failed
- `result` - Result object if succeeded
- `hash` - Extracted transaction hash from result (if present)
- `run(action)` - Execute an async action
- `reset()` - Reset to idle state

### useTransactionStatus

`useTransactionStatus` polls for transaction status with a clean React interface:

```tsx
import { useTransactionStatus } from '@axionvera/react';
import type { TransactionResult } from '@axionvera/core';

function TransactionMonitor({ txHash }: { txHash: string }) {
  const { 
    status, 
    isIdle, 
    isPolling, 
    isSuccess, 
    isFailed, 
    isTimeout, 
    isError, 
    error, 
    result, 
    poll, 
    reset 
  } = useTransactionStatus();

  const startPolling = () => {
    poll(txHash, async (hash) => {
      // Your transaction lookup function
      const response = await fetch(`/api/tx/${hash}`);
      return response.json() as TransactionResult;
    });
  };

  if (isIdle) return <button onClick={startPolling}>Check Status</button>;
  if (isPolling) return <div>Polling...</div>;
  if (isSuccess) return <div>Confirmed! Ledger: {result?.ledger}</div>;
  if (isFailed) return <div>Failed: {result?.error}</div>;
  if (isTimeout) return <div>Timeout: {error?.message}</div>;
  if (isError) return <div>Error: {error?.message}</div>;

  return null;
}
```

The hook provides:
- `status` - Current state: `'idle' | 'polling' | 'success' | 'failed' | 'timeout' | 'error'`
- Boolean flags: `isIdle`, `isPolling`, `isSuccess`, `isFailed`, `isTimeout`, `isError`
- `error` - Error object if error or timeout
- `result` - Transaction result if success or failed
- `hash` - Transaction hash being polled
- `poll(hash, lookup)` - Start polling with a lookup function
- `reset()` - Reset to idle state (cancels ongoing polling)

The hook uses `AbortController` for clean cancellation and automatically cleans up on unmount. It polls with 1000ms intervals for up to 30 attempts by default.

### React hook flow

The typical React workflow combines these hooks:

1. **Setup provider** - Wrap app with `AxionveraProvider` and wallet
2. **Connect wallet** - Use `useWallet` to manage connection
3. **Read vault state** - Use `useVault` read methods (`getInfo`, `getBalance`, `getPendingRewards`)
4. **Execute write action** - Use `useVault` write methods (`deposit`, `withdraw`, `claimRewards`)
5. **Poll transaction status** - Use `useTransactionStatus` to track confirmation

```tsx
import { AxionveraProvider, useWallet, useVault, useTransactionStatus } from '@axionvera/react';
import { MockWalletConnector, type ContractInvoker, type TransactionResult } from '@axionvera/core';

const invoker: ContractInvoker = {
  async invoke(request) { /* your Soroban layer */ return { status: 'success' }; },
  async read(request) { /* your Soroban read layer */ return {}; }
};

function VaultInterface() {
  const { connect, disconnect, connection, isConnected } = useWallet();
  const { deposit, isSubmitting, error: vaultError, resetError } = useVault({
    contractId: 'YOUR_CONTRACT_ID',
    invoker,
    walletAddress: connection?.publicKey || null
  });
  const { status: txStatus, poll: pollTx, reset: resetTx } = useTransactionStatus();

  const handleDeposit = async () => {
    try {
      const result = await deposit(100n);
      if (result.hash) {
        pollTx(result.hash, async (hash) => {
          // Your transaction lookup
          return { hash, status: 'success' } as TransactionResult;
        });
      }
    } catch (e) {
      // Error handled by vaultError state
    }
  };

  if (!isConnected) {
    return <button onClick={() => connect()}>Connect Wallet</button>;
  }

  return (
    <div>
      <p>Connected: {connection?.publicKey}</p>
      <button onClick={() => disconnect()}>Disconnect</button>
      <button disabled={isSubmitting} onClick={handleDeposit}>
        Deposit 100
      </button>
      {vaultError && <div>Error: {vaultError.message} <button onClick={resetError}>Retry</button></div>}
      {txStatus === 'polling' && <div>Confirming transaction...</div>}
      {txStatus === 'success' && <div>Transaction confirmed!</div>}
      {txStatus === 'timeout' && <div>Transaction timeout <button onClick={resetTx}>Reset</button></div>}
    </div>
  );
}

function App() {
  return (
    <AxionveraProvider wallet={new MockWalletConnector()}>
      <VaultInterface />
    </AxionveraProvider>
  );
}
```

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

## Maintainer Integration

For information about connecting React applications to real Network vault contracts and implementing live wallet integration, see the [Maintainer Handoff Guide](../../docs/maintainer-handoff.md). This guide explains the maintainer-only actions required for real testnet integration, including real wallet connector implementation and transaction polling.

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