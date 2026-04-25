[**Axionvera SDK v1.0.0**](../README.md)

***

[Axionvera SDK](../globals.md) / buildBaseTransaction

# Function: buildBaseTransaction()

> **buildBaseTransaction**(`params`): `TransactionBuilder`

Defined in: [src/utils/transactionBuilder.ts:152](https://github.com/1sraeliteX/axionvera-sdk/blob/main/src/utils/transactionBuilder.ts#L152)

Builds a base transaction that can be extended with additional operations.
This is useful for composing multiple contract calls into a single transaction.

## Parameters

### params

[`BuildBaseTransactionParams`](../type-aliases/BuildBaseTransactionParams.md)

The transaction parameters

## Returns

`TransactionBuilder`

A TransactionBuilder instance ready for adding operations

## Example

```typescript
const builder = buildBaseTransaction({
  sourceAccount,
  networkPassphrase: "Test SDF Network ; September 2015"
});

// Add multiple operations
builder.addOperation(depositOperation);
builder.addOperation(stakingOperation);

const transaction = builder.setTimeout(60).build();
```
