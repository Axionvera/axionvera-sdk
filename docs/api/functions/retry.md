[**Axionvera SDK v0.1.0**](../README.md)

***

[Axionvera SDK](../globals.md) / retry

# Function: retry()

> **retry**\<`T`\>(`fn`, `retryConfig?`): `Promise`\<`T`\>

Defined in: [utils/httpInterceptor.ts:104](https://github.com/nice-bills/axionvera-sdk/blob/4cdd845e523a767dd67f37a08a4340a0a379b245/src/utils/httpInterceptor.ts#L104)

Executes a function with automatic retries on failure.
Uses exponential backoff between retry attempts.

## Type Parameters

### T

`T`

## Parameters

### fn

() => `Promise`\<`T`\>

The function to execute

### retryConfig?

`Partial`\<[`RetryConfig`](../type-aliases/RetryConfig.md)\> = `{}`

Configuration for retry behavior

## Returns

`Promise`\<`T`\>

The result of the function

## Throws

The last error if all retries are exhausted
