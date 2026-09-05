[**Axionvera SDK v1.0.0**](../README.md)

***

[Axionvera SDK](../globals.md) / normalizeRpcError

# Function: normalizeRpcError()

> **normalizeRpcError**(`error`, `operation`): [`AxionveraError`](../classes/AxionveraError.md)

Defined in: [src/errors/axionveraError.ts:104](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/errors/axionveraError.ts#L104)

Normalizes RPC errors from Stellar/Soroban RPC responses.

## Parameters

### error

`unknown`

The raw error from RPC call

### operation

`string`

Description of the operation that failed

## Returns

[`AxionveraError`](../classes/AxionveraError.md)

Normalized AxionveraError
