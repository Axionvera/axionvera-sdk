[**Axionvera SDK v1.0.0**](../README.md)

***

[Axionvera SDK](../globals.md) / createHttpClientWithRetry

# Function: createHttpClientWithRetry()

> **createHttpClientWithRetry**(`retryConfig?`): `AxiosInstance`

Defined in: [src/utils/httpInterceptor.ts:59](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/utils/httpInterceptor.ts#L59)

Creates an Axios client with automatic retry interceptors.

## Parameters

### retryConfig?

`Partial`\<`RetryConfig`\> = `{}`

Configuration for retry behavior

## Returns

`AxiosInstance`

An Axios instance with retry interceptors
