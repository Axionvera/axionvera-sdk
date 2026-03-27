[**Axionvera SDK v0.1.0**](../README.md)

***

[Axionvera SDK](../globals.md) / buildContractCallOperation

# Function: buildContractCallOperation()

> **buildContractCallOperation**(`params`): `Operation2`

Defined in: [utils/transactionBuilder.ts:81](https://github.com/nice-bills/axionvera-sdk/blob/4cdd845e523a767dd67f37a08a4340a0a379b245/src/utils/transactionBuilder.ts#L81)

Builds a Soroban contract call operation.

## Parameters

### params

The operation parameters

#### args?

[`ContractCallArg`](../type-aliases/ContractCallArg.md)[]

The arguments to pass

#### contractId

`string`

The contract ID to call

#### method

`string`

The method name to call

## Returns

`Operation2`

The constructed operation
