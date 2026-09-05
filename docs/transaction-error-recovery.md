# Transaction Error Recovery Guide

This guide shows how to classify and surface the SDK's transaction recovery states without making live RPC calls.

The recovery fixtures are mocked, typed, and testnet-ready. They are designed for unit tests, docs examples, and local harnesses that need predictable behavior.

## What the SDK surfaces

- `WalletRejectedTransactionError` for user signing rejection
- `RpcError` for hard RPC failures
- `TimeoutError` for request or poll timeouts
- `TransactionFailedError` for final `FAILED` transaction states
- `TransactionNotFoundError` for final `NOT_FOUND` transaction states

## Fixture-driven handling

```ts
import {
  classifyTransactionRecoveryInput,
  normalizeTransactionRecoveryInput,
  transactionErrorRecoveryFixtures,
  WalletRejectedTransactionError,
  TimeoutError,
  TransactionFailedError,
  TransactionNotFoundError,
  RpcError
} from "axionvera-sdk";

for (const fixture of transactionErrorRecoveryFixtures) {
  const normalized = normalizeTransactionRecoveryInput(fixture.input);
  const scenario = classifyTransactionRecoveryInput(fixture.input);

  switch (scenario) {
    case "wallet-rejection":
      if (normalized instanceof WalletRejectedTransactionError) {
        // Ask the user to re-sign or choose a different wallet.
      }
      break;
    case "rpc-failure":
      if (normalized instanceof RpcError) {
        // Retry against a healthy RPC endpoint.
      }
      break;
    case "timeout":
      if (normalized instanceof TimeoutError) {
        // Retry with a longer timeout or backoff.
      }
      break;
    case "failed-transaction":
      if (normalized instanceof TransactionFailedError) {
        // Inspect the contract call or account state before resubmitting.
      }
      break;
    case "not-found-transaction":
      if (normalized instanceof TransactionNotFoundError) {
        // Keep polling briefly, then surface a timeout-aware retry path.
      }
      break;
  }
}
```

## Mocked and testnet-ready behavior

The fixtures intentionally avoid live RPC traffic. They model the transaction states you would see from mocked poll responses, test harnesses, or testnet endpoints, so you can assert the recovery path without waiting on the network.

## Recommended pattern

1. Normalize the raw error or final poll snapshot.
2. Branch on the typed error class or recovery scenario.
3. Retry only when the state is retryable.
4. Surface non-retryable failures with a short user-facing message and the original error attached for logs.

