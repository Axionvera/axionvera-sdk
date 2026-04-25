[**Axionvera SDK v1.0.0**](../README.md)

***

[Axionvera SDK](../globals.md) / normalizeRpcError

# Function: normalizeRpcError()

> **normalizeRpcError**(`error`, `operation`): [`AxionveraError`](../classes/AxionveraError.md)

Defined in: [src/errors/axionveraError.ts:104](https://github.com/1sraeliteX/axionvera-sdk/blob/main/src/errors/axionveraError.ts#L104)

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
