[**Axionvera SDK v1.0.0**](../README.md)

***

[Axionvera SDK](../globals.md) / normalizeTransactionError

# Function: normalizeTransactionError()

> **normalizeTransactionError**(`error`, `txHash?`): [`AxionveraError`](../classes/AxionveraError.md)

Defined in: [src/errors/axionveraError.ts:137](https://github.com/1sraeliteX/axionvera-sdk/blob/main/src/errors/axionveraError.ts#L137)

Normalizes transaction submission errors.

## Parameters

### error

`unknown`

The raw error from transaction submission

### txHash?

`string`

The transaction hash if available

## Returns

[`AxionveraError`](../classes/AxionveraError.md)

Normalized AxionveraError
