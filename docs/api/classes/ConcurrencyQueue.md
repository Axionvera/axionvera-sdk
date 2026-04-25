[**Axionvera SDK v1.0.0**](../README.md)

***

[Axionvera SDK](../globals.md) / ConcurrencyQueue

# Class: ConcurrencyQueue

Defined in: [src/utils/concurrencyQueue.ts:18](https://github.com/1sraeliteX/axionvera-sdk/blob/main/src/utils/concurrencyQueue.ts#L18)

## Constructors

### Constructor

> **new ConcurrencyQueue**(`config`): `ConcurrencyQueue`

Defined in: [src/utils/concurrencyQueue.ts:26](https://github.com/1sraeliteX/axionvera-sdk/blob/main/src/utils/concurrencyQueue.ts#L26)

#### Parameters

##### config

`ConcurrencyConfig`

#### Returns

`ConcurrencyQueue`

## Methods

### clearQueue()

> **clearQueue**(): `void`

Defined in: [src/utils/concurrencyQueue.ts:195](https://github.com/1sraeliteX/axionvera-sdk/blob/main/src/utils/concurrencyQueue.ts#L195)

Clear all queued requests (useful for cleanup)

#### Returns

`void`

***

### destroy()

> **destroy**(): `void`

Defined in: [src/utils/concurrencyQueue.ts:221](https://github.com/1sraeliteX/axionvera-sdk/blob/main/src/utils/concurrencyQueue.ts#L221)

Destroy the queue and cleanup resources

#### Returns

`void`

***

### execute()

> **execute**\<`T`\>(`requestFn`): `Promise`\<`T`\>

Defined in: [src/utils/concurrencyQueue.ts:39](https://github.com/1sraeliteX/axionvera-sdk/blob/main/src/utils/concurrencyQueue.ts#L39)

Execute a request with concurrency control

#### Type Parameters

##### T

`T`

#### Parameters

##### requestFn

() => `Promise`\<`T`\>

#### Returns

`Promise`\<`T`\>

***

### getQueueStatus()

> **getQueueStatus**(): `object`

Defined in: [src/utils/concurrencyQueue.ts:179](https://github.com/1sraeliteX/axionvera-sdk/blob/main/src/utils/concurrencyQueue.ts#L179)

Get queue status for monitoring

#### Returns

`object`

##### activeRequests

> **activeRequests**: `number`

##### averageWaitTime

> **averageWaitTime**: `number`

##### isThrottled

> **isThrottled**: `boolean`

##### maxConcurrentRequests

> **maxConcurrentRequests**: `number`

##### oldestRequestWaitTime

> **oldestRequestWaitTime**: `number` = `oldestRequest`

##### queuedRequests

> **queuedRequests**: `number`

##### queueTimeout

> **queueTimeout**: `number` \| `undefined`

##### queueTimestamps

> **queueTimestamps**: `number`[]

##### requestsInCurrentInterval

> **requestsInCurrentInterval**: `number`

##### throttleEnabled

> **throttleEnabled**: `boolean` \| `undefined`

##### throttleInterval

> **throttleInterval**: `number` \| `undefined`

##### throttleRate

> **throttleRate**: `number` \| `undefined`

##### timeUntilNextThrottleReset

> **timeUntilNextThrottleReset**: `number`

##### utilizationRate

> **utilizationRate**: `number`

***

### getStats()

> **getStats**(): `object`

Defined in: [src/utils/concurrencyQueue.ts:161](https://github.com/1sraeliteX/axionvera-sdk/blob/main/src/utils/concurrencyQueue.ts#L161)

Get current queue statistics

#### Returns

`object`

##### activeRequests

> **activeRequests**: `number`

##### maxConcurrentRequests

> **maxConcurrentRequests**: `number`

##### queuedRequests

> **queuedRequests**: `number`

##### queueTimeout

> **queueTimeout**: `number` \| `undefined`

##### queueTimestamps

> **queueTimestamps**: `number`[]

##### requestsInCurrentInterval

> **requestsInCurrentInterval**: `number`

##### throttleEnabled

> **throttleEnabled**: `boolean` \| `undefined`

##### throttleInterval

> **throttleInterval**: `number` \| `undefined`

##### throttleRate

> **throttleRate**: `number` \| `undefined`

##### timeUntilNextThrottleReset

> **timeUntilNextThrottleReset**: `number`

***

### updateConfig()

> **updateConfig**(`newConfig`): `void`

Defined in: [src/utils/concurrencyQueue.ts:214](https://github.com/1sraeliteX/axionvera-sdk/blob/main/src/utils/concurrencyQueue.ts#L214)

Update configuration

#### Parameters

##### newConfig

`Partial`\<`ConcurrencyConfig`\>

#### Returns

`void`
