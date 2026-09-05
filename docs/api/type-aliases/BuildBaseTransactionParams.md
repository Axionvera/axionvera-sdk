[**Axionvera SDK v1.0.0**](../README.md)

***

[Axionvera SDK](../globals.md) / BuildBaseTransactionParams

# Type Alias: BuildBaseTransactionParams

> **BuildBaseTransactionParams** = `object`

Defined in: [src/utils/transactionBuilder.ts:120](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/utils/transactionBuilder.ts#L120)

Parameters for building a base transaction.

## Properties

### fee?

> `optional` **fee?**: `number`

Defined in: [src/utils/transactionBuilder.ts:126](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/utils/transactionBuilder.ts#L126)

The fee for the transaction (default: 100_000)

***

### networkPassphrase

> **networkPassphrase**: `string`

Defined in: [src/utils/transactionBuilder.ts:124](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/utils/transactionBuilder.ts#L124)

The network passphrase

***

### sourceAccount

> **sourceAccount**: `Account`

Defined in: [src/utils/transactionBuilder.ts:122](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/utils/transactionBuilder.ts#L122)

The source account for the transaction

***

### timeoutInSeconds?

> `optional` **timeoutInSeconds?**: `number`

Defined in: [src/utils/transactionBuilder.ts:128](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/utils/transactionBuilder.ts#L128)

Transaction timeout in seconds (default: 60)
