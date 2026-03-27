[**Axionvera SDK v0.1.0**](../README.md)

***

[Axionvera SDK](../globals.md) / RetryConfig

# Type Alias: RetryConfig

> **RetryConfig** = `object`

Defined in: [utils/httpInterceptor.ts:6](https://github.com/nice-bills/axionvera-sdk/blob/4cdd845e523a767dd67f37a08a4340a0a379b245/src/utils/httpInterceptor.ts#L6)

Configuration for retry behavior.

## Properties

### baseDelayMs

> **baseDelayMs**: `number`

Defined in: [utils/httpInterceptor.ts:12](https://github.com/nice-bills/axionvera-sdk/blob/4cdd845e523a767dd67f37a08a4340a0a379b245/src/utils/httpInterceptor.ts#L12)

Base delay between retries in milliseconds

***

### enabled

> **enabled**: `boolean`

Defined in: [utils/httpInterceptor.ts:8](https://github.com/nice-bills/axionvera-sdk/blob/4cdd845e523a767dd67f37a08a4340a0a379b245/src/utils/httpInterceptor.ts#L8)

Whether retries are enabled

***

### maxDelayMs

> **maxDelayMs**: `number`

Defined in: [utils/httpInterceptor.ts:14](https://github.com/nice-bills/axionvera-sdk/blob/4cdd845e523a767dd67f37a08a4340a0a379b245/src/utils/httpInterceptor.ts#L14)

Maximum delay between retries in milliseconds

***

### maxRetries

> **maxRetries**: `number`

Defined in: [utils/httpInterceptor.ts:10](https://github.com/nice-bills/axionvera-sdk/blob/4cdd845e523a767dd67f37a08a4340a0a379b245/src/utils/httpInterceptor.ts#L10)

Maximum number of retry attempts

***

### retryableMethods

> **retryableMethods**: `string`[]

Defined in: [utils/httpInterceptor.ts:16](https://github.com/nice-bills/axionvera-sdk/blob/4cdd845e523a767dd67f37a08a4340a0a379b245/src/utils/httpInterceptor.ts#L16)

HTTP methods that should be retried

***

### retryableStatusCodes

> **retryableStatusCodes**: `number`[]

Defined in: [utils/httpInterceptor.ts:18](https://github.com/nice-bills/axionvera-sdk/blob/4cdd845e523a767dd67f37a08a4340a0a379b245/src/utils/httpInterceptor.ts#L18)

HTTP status codes that should trigger a retry
