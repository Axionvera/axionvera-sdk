[**Axionvera SDK v1.0.0**](../README.md)

***

[Axionvera SDK](../globals.md) / retry

# Function: retry()

> **retry**\<`T`\>(`fn`, `retryConfig?`): `Promise`\<`T`\>

Defined in: [src/utils/httpInterceptor.ts:107](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/utils/httpInterceptor.ts#L107)

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

`Partial`\<`RetryConfig`\> = `{}`

Configuration for retry behavior

## Returns

`Promise`\<`T`\>

The result of the function

## Throws

The last error if all retries are exhausted
