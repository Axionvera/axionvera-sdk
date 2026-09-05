# VaultContract real-invoker readiness

## Meaning

`VaultContract` is real-invoker-ready when its public methods can use a
production-shaped `ContractInvoker` without changing the contract wrapper.
The invoker owns Soroban transaction construction, simulation, signing,
submission, response decoding, and transport error classification. The vault
wrapper owns the stable contract ID, method names, argument ordering, and
amount normalization.

The readiness tests use `TestContractInvoker`, an in-memory implementation of
the same dependency boundary. It records every request and returns configured
responses or errors. It contains no RPC transport and cannot make network
calls.

## Expected invoker interface

The interface is defined in `packages/core/src/contracts/vault.ts`:

```ts
interface ContractInvoker {
  invoke<TResponse = unknown>(request: {
    contractId: string;
    method: string;
    args: readonly unknown[];
  }): Promise<TResponse>;

  read?<TResponse = unknown>(request: {
    contractId: string;
    method: string;
    args: readonly unknown[];
  }): Promise<TResponse>;
}
```

`read` is optional. When it is unavailable, `VaultContract` sends the same
request through `invoke`. The current `SorobanContractInvoker` skeleton maps
`read` to `simulateTransaction` and `invoke` to `sendTransaction`.

## Vault request contract

| Vault method                 | Invoker operation | Contract method       | Ordered arguments                |
| ---------------------------- | ----------------- | --------------------- | -------------------------------- |
| `getInfo()`                  | `read`            | `get_info`            | `[]`                             |
| `getBalance(address)`        | `read`            | `get_balance`         | `[address]`                      |
| `getPendingRewards(address)` | `read`            | `get_pending_rewards` | `[address]`                      |
| `deposit(from, amount)`      | `invoke`          | `deposit`             | `[from, normalizedAmountString]` |
| `withdraw(to, amount)`       | `invoke`          | `withdraw`            | `[to, normalizedAmountString]`   |
| `claimRewards(address)`      | `invoke`          | `claim_rewards`       | `[address]`                      |

Positive `bigint`, `number`, and integer `string` amounts are normalized to a
base-unit `bigint` and then serialized as a decimal string. Invalid or
non-positive amounts fail before the invoker is called.

## Result behavior and assumptions

`VaultContract` currently performs no additional response transformation. A
decoded read value or `VaultTransaction` returned by the invoker is passed
through unchanged, including transaction results whose status is `failed`.
An error rejected by the invoker is also propagated unchanged.

The documented assumptions for the maintainer-owned real implementation are:

- it continues to implement the object-based `ContractInvoker` request shape;
- it preserves `contractId`, `method`, and the order of `args`;
- it returns already-decoded values matching the Vault types;
- it represents submitted transaction outcomes with `VaultTransaction`, and
  rejects transport, contract, signing, or malformed-response errors; and
- its read path remains compatible with simulation while its write path builds,
  signs, and submits the actual Soroban transaction.

If the real invoker adopts a different response envelope, that adapter must
decode the envelope at the invoker boundary. `VaultContract` should not need a
public API change.

See `examples/vault-real-invoker-readiness.ts` for a read and write flow using
the mock adapter as the production dependency stand-in.
