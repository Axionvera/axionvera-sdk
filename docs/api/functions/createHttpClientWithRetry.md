[**Axionvera SDK v0.1.0**](../README.md)

***

[Axionvera SDK](../globals.md) / createHttpClientWithRetry

# Function: createHttpClientWithRetry()

> **createHttpClientWithRetry**(`retryConfig?`): `AxiosInstance`

Defined in: [utils/httpInterceptor.ts:56](https://github.com/nice-bills/axionvera-sdk/blob/4cdd845e523a767dd67f37a08a4340a0a379b245/src/utils/httpInterceptor.ts#L56)

Creates an Axios client with automatic retry interceptors.

## Parameters

### retryConfig?

`Partial`\<[`RetryConfig`](../type-aliases/RetryConfig.md)\> = `{}`

Configuration for retry behavior

## Returns

`AxiosInstance`

An Axios instance with retry interceptors
