[**Axionvera SDK v1.0.0**](../README.md)

***

[Axionvera SDK](../globals.md) / normalizeContractError

# Function: normalizeContractError()

> **normalizeContractError**(`error`, `contractId`, `method`): [`AxionveraError`](../classes/AxionveraError.md)

Defined in: [src/errors/axionveraError.ts:175](https://github.com/1sraeliteX/axionvera-sdk/blob/main/src/errors/axionveraError.ts#L175)

Normalizes contract call errors.

## Parameters

### error

`unknown`

The raw error from contract call

### contractId

`string`

The contract ID

### method

`string`

The method that was called

## Returns

[`AxionveraError`](../classes/AxionveraError.md)

Normalized AxionveraError
