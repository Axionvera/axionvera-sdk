# Offline Transaction Creation Workflow

`OfflineTransactionBuilder` (`src/builders/offlineTransactionBuilder.ts`) lets you build, validate, and serialize
unsigned Stellar/Soroban transactions without any network connectivity. This is useful for air-gapped
signing setups, hardware wallet pairing flows, and enterprise workflows where transaction *preparation*
must happen separately from simulation and submission.

## Why "offline" works here

Building a Stellar transaction only requires two pieces of network-derived state: the source account's
current **sequence number** and the **network passphrase**. Both are plain strings. `OfflineTransactionBuilder`
takes them as direct inputs instead of fetching them from RPC, so the entire build pipeline — constructing
operations, assembling the transaction, validating its shape, and serializing it — runs with zero I/O.

The caller is responsible for sourcing the sequence number ahead of time (e.g. cached from a prior
online session, or read off a co-located online machine) and carrying it across the air gap.

## Building a transaction offline

```typescript
import { OfflineTransactionBuilder } from './src/builders/offlineTransactionBuilder';
import { Networks } from '@stellar/stellar-sdk';

const builder = new OfflineTransactionBuilder({
  sourceAccount: {
    accountId: 'GABC...', // the account the transaction is sent from
    sequence: '123456789', // sourced from a previous online session
  },
  networkPassphrase: Networks.TESTNET,
  fee: 100_000,
  timeoutInSeconds: 60,
});

builder.addContractCall({
  contractId: 'CABC...',
  method: 'deposit',
  args: [1000n],
});

const transaction = builder.build(); // a standard @stellar/stellar-sdk Transaction
```

`addOperation` is also available for any pre-built `xdr.Operation`, so the builder isn't limited to
contract calls.

## Validation approach

Because no RPC access is available offline, validation here is purely **structural** — it cannot tell
you whether the transaction will succeed on-chain (that requires simulation), only whether it is
well-formed enough to be signed and submitted later:

- at least one operation, and no more than the network's 100-operation limit
- a positive transaction fee
- a syntactically valid source account ID and sequence number
- time bounds are set

`build()` runs this validation automatically and throws a `ValidationError` if it fails.
`OfflineTransactionBuilder.validate(transaction)` is also exposed directly so you can re-check a
transaction reconstructed from XDR (e.g. after importing it back from a signing device) before
submission.

## Serialization format

`builder.export(transaction)` produces an `OfflineTransactionPackage` — a plain JSON object designed to
be written to disk, encoded as a QR code, or otherwise carried across an air gap:

```typescript
interface OfflineTransactionPackage {
  version: 1;
  xdr: string;              // base64-encoded unsigned TransactionEnvelope XDR
  networkPassphrase: string;
  sourceAccountId: string;
  sequence: string;         // the sequence number consumed when the transaction was built
  operationCount: number;
  createdAt: number;        // epoch milliseconds
}
```

The `xdr` field is the standard Stellar transaction envelope — nothing custom — so any tool that
understands Stellar XDR can also work with it directly via `transaction.toXDR()` /
`OfflineTransactionBuilder.fromXDR(xdr, networkPassphrase)`.

`OfflineTransactionBuilder.import(pkg)` reverses `export`, reconstructing the `Transaction`. It checks
`pkg.version` and rejects unsupported schema versions, and it routes the embedded XDR through
`assertValidXDR` before parsing, so malformed or oversized input is rejected before it reaches the
stellar-sdk parser (see `src/utils/xdrValidator.ts`).

## Signing compatibility

`build()` returns a normal `@stellar/stellar-sdk` `Transaction`, so the output of this builder is a
drop-in fit for every existing signing path in the SDK:

```typescript
import { TransactionBuilder } from '@stellar/stellar-sdk';
import { LocalKeypairWalletConnector } from './src/wallet/walletConnector';

const unsignedXdr = transaction.toXDR();

// On the signing device / air-gapped machine:
const wallet = new LocalKeypairWalletConnector(keypair);
const signedXdr = await wallet.signTransaction(unsignedXdr, networkPassphrase);

// Equivalently, without a WalletConnector:
const txToSign = TransactionBuilder.fromXDR(unsignedXdr, networkPassphrase);
txToSign.sign(keypair);
```

`OfflineTransactionBuilder.fromXDR` rejects fee-bump envelopes — it only parses inner transactions,
matching the shape `WalletConnector.signTransaction` implementations expect.

## End-to-end offline workflow

1. **Online machine**: fetch the source account's sequence number and the network passphrase once.
2. **Air-gapped machine**: run `OfflineTransactionBuilder` to build and validate the transaction, then
   call `export()` to produce an `OfflineTransactionPackage`. Carry it across the air gap (file, QR code).
3. **Signing device**: `OfflineTransactionBuilder.import(pkg)` to reconstruct the transaction, sign it
   with a `WalletConnector` (or any `Keypair`), and carry the signed XDR back.
4. **Online machine**: submit the signed XDR via `StellarClient` as usual.

See `examples/offlineTransactionExample.ts` for a runnable version of this flow.

## Out of scope

This feature only covers transaction *preparation*. It does not implement a wallet, hardware wallet
integration, or any dashboard/UI — those are tracked separately.
