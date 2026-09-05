[**Axionvera SDK v1.0.0**](../README.md)

***

[Axionvera SDK](../globals.md) / normalizeContractError

# Function: normalizeContractError()

> **normalizeContractError**(`error`, `contractId`, `method`): [`AxionveraError`](../classes/AxionveraError.md)

Defined in: [src/errors/axionveraError.ts:175](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/errors/axionveraError.ts#L175)

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
