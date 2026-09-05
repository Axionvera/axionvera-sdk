# Transaction Serialization

`serializeTransactionEnvelope` creates a compact base64 JSON envelope around a
transaction XDR string and the network passphrase required to parse it later. It
uses a `WeakMap` cache so repeated serialization of the same transaction object
does not call `toXDR()` more than once for the same option set.

```ts
import { deserializeTransactionEnvelope, serializeTransactionEnvelope } from 'axionvera-sdk';

const encoded = serializeTransactionEnvelope(transaction, {
  networkPassphrase: 'Test SDF Network ; September 2015',
  includeMetadata: true,
});

const { transaction: parsed } = deserializeTransactionEnvelope(encoded, (xdr, networkPassphrase) =>
  TransactionBuilder.fromXDR(xdr, networkPassphrase)
);
```

## Compatibility

The serialized payload stores:

- `version`
- `xdr`
- `networkPassphrase`
- optional diagnostics metadata: source, fee, sequence, operation count

Protocol parsing remains caller-owned through the parser callback. That keeps the
serialization helper independent from a specific Stellar SDK runtime while still
preserving protocol-compatible XDR payloads.

## Performance Notes

The cache is scoped by transaction object and serialization options. It reduces
repeat calls to `transaction.toXDR()` and repeated object allocation when SDK code
needs to log, queue, persist, or retry the same transaction.
