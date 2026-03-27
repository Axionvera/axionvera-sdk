[**Axionvera SDK v0.1.0**](../README.md)

***

[Axionvera SDK](../globals.md) / BuildContractCallParams

# Type Alias: BuildContractCallParams

> **BuildContractCallParams** = `object`

Defined in: [utils/transactionBuilder.ts:19](https://github.com/nice-bills/axionvera-sdk/blob/4cdd845e523a767dd67f37a08a4340a0a379b245/src/utils/transactionBuilder.ts#L19)

Parameters for building a contract call transaction.

## Properties

### args?

> `optional` **args?**: [`ContractCallArg`](ContractCallArg.md)[]

Defined in: [utils/transactionBuilder.ts:29](https://github.com/nice-bills/axionvera-sdk/blob/4cdd845e523a767dd67f37a08a4340a0a379b245/src/utils/transactionBuilder.ts#L29)

The arguments to pass to the method

***

### contractId

> **contractId**: `string`

Defined in: [utils/transactionBuilder.ts:25](https://github.com/nice-bills/axionvera-sdk/blob/4cdd845e523a767dd67f37a08a4340a0a379b245/src/utils/transactionBuilder.ts#L25)

The contract ID to call

***

### fee?

> `optional` **fee?**: `number`

Defined in: [utils/transactionBuilder.ts:31](https://github.com/nice-bills/axionvera-sdk/blob/4cdd845e523a767dd67f37a08a4340a0a379b245/src/utils/transactionBuilder.ts#L31)

The fee for the transaction (default: 100_000)

***

### method

> **method**: `string`

Defined in: [utils/transactionBuilder.ts:27](https://github.com/nice-bills/axionvera-sdk/blob/4cdd845e523a767dd67f37a08a4340a0a379b245/src/utils/transactionBuilder.ts#L27)

The method name to call

***

### networkPassphrase

> **networkPassphrase**: `string`

Defined in: [utils/transactionBuilder.ts:23](https://github.com/nice-bills/axionvera-sdk/blob/4cdd845e523a767dd67f37a08a4340a0a379b245/src/utils/transactionBuilder.ts#L23)

The network passphrase

***

### sourceAccount

> **sourceAccount**: `Account`

Defined in: [utils/transactionBuilder.ts:21](https://github.com/nice-bills/axionvera-sdk/blob/4cdd845e523a767dd67f37a08a4340a0a379b245/src/utils/transactionBuilder.ts#L21)

The source account for the transaction

***

### timeoutInSeconds?

> `optional` **timeoutInSeconds?**: `number`

Defined in: [utils/transactionBuilder.ts:33](https://github.com/nice-bills/axionvera-sdk/blob/4cdd845e523a767dd67f37a08a4340a0a379b245/src/utils/transactionBuilder.ts#L33)

Transaction timeout in seconds (default: 60)
