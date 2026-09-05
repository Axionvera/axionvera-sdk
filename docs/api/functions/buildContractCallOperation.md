[**Axionvera SDK v1.0.0**](../README.md)

***

[Axionvera SDK](../globals.md) / buildContractCallOperation

# Function: buildContractCallOperation()

> **buildContractCallOperation**(`params`): `Operation2`

Defined in: [src/utils/transactionBuilder.ts:81](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/utils/transactionBuilder.ts#L81)

Builds a Soroban contract call operation.

## Parameters

### params

The operation parameters

#### args?

`ContractCallArg`[]

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
