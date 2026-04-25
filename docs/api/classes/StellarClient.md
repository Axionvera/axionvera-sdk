[**Axionvera SDK v1.0.0**](../README.md)

***

[Axionvera SDK](../globals.md) / StellarClient

# Class: StellarClient

Defined in: [src/client/stellarClient.ts:67](https://github.com/1sraeliteX/axionvera-sdk/blob/main/src/client/stellarClient.ts#L67)

RPC gateway for interacting with Soroban networks.

Provides methods for querying network state, simulating transactions,
preparing transactions with fees, and submitting signed transactions.

## Example

```typescript
import { StellarClient } from "axionvera-sdk";

const client = new StellarClient({ network: "testnet" });
const health = await client.getHealth();
```

## Constructors

### Constructor

> **new StellarClient**(`options?`): `StellarClient`

Defined in: [src/client/stellarClient.ts:93](https://github.com/1sraeliteX/axionvera-sdk/blob/main/src/client/stellarClient.ts#L93)

Creates a new StellarClient instance.

#### Parameters

##### options?

[`StellarClientOptions`](../type-aliases/StellarClientOptions.md)

Configuration options

#### Returns

`StellarClient`

## Properties

### concurrencyConfig

> `readonly` **concurrencyConfig**: `ConcurrencyConfig`

Defined in: [src/client/stellarClient.ts:81](https://github.com/1sraeliteX/axionvera-sdk/blob/main/src/client/stellarClient.ts#L81)

The effective concurrency configuration after merging with defaults.

***

### concurrencyEnabled

> `readonly` **concurrencyEnabled**: `boolean`

Defined in: [src/client/stellarClient.ts:83](https://github.com/1sraeliteX/axionvera-sdk/blob/main/src/client/stellarClient.ts#L83)

Whether concurrency control is enabled.

***

### httpClient

> `readonly` **httpClient**: `AxiosInstance`

Defined in: [src/client/stellarClient.ts:77](https://github.com/1sraeliteX/axionvera-sdk/blob/main/src/client/stellarClient.ts#L77)

The HTTP client with retry interceptors.

***

### logger

> `readonly` **logger**: `Logger`

Defined in: [src/client/stellarClient.ts:87](https://github.com/1sraeliteX/axionvera-sdk/blob/main/src/client/stellarClient.ts#L87)

Logger instance for debugging and monitoring.

***

### network

> `readonly` **network**: `AxionveraNetwork`

Defined in: [src/client/stellarClient.ts:69](https://github.com/1sraeliteX/axionvera-sdk/blob/main/src/client/stellarClient.ts#L69)

The network this client is connected to.

***

### networkPassphrase

> `readonly` **networkPassphrase**: `string`

Defined in: [src/client/stellarClient.ts:73](https://github.com/1sraeliteX/axionvera-sdk/blob/main/src/client/stellarClient.ts#L73)

The network passphrase for transaction signing.

***

### retryConfig

> `readonly` **retryConfig**: `Partial`\<`RetryConfig`\>

Defined in: [src/client/stellarClient.ts:79](https://github.com/1sraeliteX/axionvera-sdk/blob/main/src/client/stellarClient.ts#L79)

The effective retry configuration after merging with defaults.

***

### rpc

> `readonly` **rpc**: `RpcServer`

Defined in: [src/client/stellarClient.ts:75](https://github.com/1sraeliteX/axionvera-sdk/blob/main/src/client/stellarClient.ts#L75)

The underlying RPC server instance.

***

### rpcUrl

> `readonly` **rpcUrl**: `string`

Defined in: [src/client/stellarClient.ts:71](https://github.com/1sraeliteX/axionvera-sdk/blob/main/src/client/stellarClient.ts#L71)

The RPC URL this client uses.

***

### webSocketManager?

> `readonly` `optional` **webSocketManager?**: `WebSocketManager`

Defined in: [src/client/stellarClient.ts:85](https://github.com/1sraeliteX/axionvera-sdk/blob/main/src/client/stellarClient.ts#L85)

WebSocket manager for real-time event subscriptions.

## Methods

### getAccount()

> **getAccount**(`publicKey`): `Promise`\<`Account`\>

Defined in: [src/client/stellarClient.ts:201](https://github.com/1sraeliteX/axionvera-sdk/blob/main/src/client/stellarClient.ts#L201)

Retrieves an account's information from the network.
Automatically retries on failure.

#### Parameters

##### publicKey

`string`

The account's public key

#### Returns

`Promise`\<`Account`\>

The account information

***

### getConcurrencyStats()

> **getConcurrencyStats**(): `any`

Defined in: [src/client/stellarClient.ts:362](https://github.com/1sraeliteX/axionvera-sdk/blob/main/src/client/stellarClient.ts#L362)

Get concurrency control statistics

#### Returns

`any`

***

### getHealth()

> **getHealth**(): `Promise`\<`GetHealthResponse`\>

Defined in: [src/client/stellarClient.ts:159](https://github.com/1sraeliteX/axionvera-sdk/blob/main/src/client/stellarClient.ts#L159)

Checks the health of the RPC server.
Automatically retries on failure.

#### Returns

`Promise`\<`GetHealthResponse`\>

The health check response

***

### getLatestLedger()

> **getLatestLedger**(): `Promise`\<`GetLatestLedgerResponse`\>

Defined in: [src/client/stellarClient.ts:183](https://github.com/1sraeliteX/axionvera-sdk/blob/main/src/client/stellarClient.ts#L183)

#### Returns

`Promise`\<`GetLatestLedgerResponse`\>

***

### getNetwork()

> **getNetwork**(): `Promise`\<`GetNetworkResponse`\>

Defined in: [src/client/stellarClient.ts:171](https://github.com/1sraeliteX/axionvera-sdk/blob/main/src/client/stellarClient.ts#L171)

#### Returns

`Promise`\<`GetNetworkResponse`\>

***

### getTransaction()

> **getTransaction**(`hash`): `Promise`\<`unknown`\>

Defined in: [src/client/stellarClient.ts:285](https://github.com/1sraeliteX/axionvera-sdk/blob/main/src/client/stellarClient.ts#L285)

Retrieves the status of a submitted transaction.
Automatically retries on failure.

#### Parameters

##### hash

`string`

The transaction hash

#### Returns

`Promise`\<`unknown`\>

The transaction status response

***

### pollTransaction()

> **pollTransaction**(`hash`, `params?`): `Promise`\<`unknown`\>

Defined in: [src/client/stellarClient.ts:298](https://github.com/1sraeliteX/axionvera-sdk/blob/main/src/client/stellarClient.ts#L298)

Polls for a transaction to be confirmed or rejected.

#### Parameters

##### hash

`string`

The transaction hash to wait for

##### params?

Polling parameters

###### intervalMs?

`number`

Time between polls in milliseconds (default: 1000)

###### timeoutMs?

`number`

Maximum time to wait in milliseconds (default: 30000)

#### Returns

`Promise`\<`unknown`\>

The transaction result when it reaches a final state

#### Throws

TimeoutError if the transaction times out

***

### prepareTransaction()

> **prepareTransaction**(`tx`): `Promise`\<`Transaction`\<`Memo`\<`MemoType`\>, `Operation`[]\>\>

Defined in: [src/client/stellarClient.ts:235](https://github.com/1sraeliteX/axionvera-sdk/blob/main/src/client/stellarClient.ts#L235)

Prepares a transaction by fetching the current ledger sequence
and setting the correct min sequence age.

#### Parameters

##### tx

`Transaction`\<`Memo`\<`MemoType`\>, `Operation`[]\> \| `FeeBumpTransaction`

The transaction to prepare

#### Returns

`Promise`\<`Transaction`\<`Memo`\<`MemoType`\>, `Operation`[]\>\>

The prepared transaction

***

### sendTransaction()

> **sendTransaction**(`tx`): `Promise`\<`TransactionSendResult`\>

Defined in: [src/client/stellarClient.ts:244](https://github.com/1sraeliteX/axionvera-sdk/blob/main/src/client/stellarClient.ts#L244)

Submits a signed transaction to the network.

#### Parameters

##### tx

`Transaction`\<`Memo`\<`MemoType`\>, `Operation`[]\> \| `FeeBumpTransaction`

The signed transaction to submit

#### Returns

`Promise`\<`TransactionSendResult`\>

The submission result containing hash and status

***

### signWithKeypair()

> **signWithKeypair**(`tx`, `keypair`): `Promise`\<`Transaction`\<`Memo`\<`MemoType`\>, `Operation`[]\>\>

Defined in: [src/client/stellarClient.ts:325](https://github.com/1sraeliteX/axionvera-sdk/blob/main/src/client/stellarClient.ts#L325)

Signs a transaction using a local Keypair.
This is a convenience method for local signing without a wallet connector.

#### Parameters

##### tx

`Transaction`

The transaction to sign

##### keypair

`Keypair`

The keypair to sign with

#### Returns

`Promise`\<`Transaction`\<`Memo`\<`MemoType`\>, `Operation`[]\>\>

The signed transaction

***

### simulateTransaction()

> **simulateTransaction**(`tx`): `Promise`\<`SimulateTransactionResponse`\>

Defined in: [src/client/stellarClient.ts:211](https://github.com/1sraeliteX/axionvera-sdk/blob/main/src/client/stellarClient.ts#L211)

Simulates a transaction without submitting it.
This is useful for testing transaction validity and getting expected costs.

#### Parameters

##### tx

`Transaction`\<`Memo`\<`MemoType`\>, `Operation`[]\> \| `FeeBumpTransaction`

The transaction to simulate

#### Returns

`Promise`\<`SimulateTransactionResponse`\>

The simulation result

***

### getDefaultNetworkPassphrase()

> `static` **getDefaultNetworkPassphrase**(`network`): `string`

Defined in: [src/client/stellarClient.ts:348](https://github.com/1sraeliteX/axionvera-sdk/blob/main/src/client/stellarClient.ts#L348)

Gets the default network passphrase for a given network.

#### Parameters

##### network

`AxionveraNetwork`

The network ("testnet" or "mainnet")

#### Returns

`string`

The corresponding network passphrase

***

### parseTransactionXdr()

> `static` **parseTransactionXdr**(`transactionXdr`, `networkPassphrase`): `Transaction`\<`Memo`\<`MemoType`\>, `Operation`[]\> \| `FeeBumpTransaction`

Defined in: [src/client/stellarClient.ts:336](https://github.com/1sraeliteX/axionvera-sdk/blob/main/src/client/stellarClient.ts#L336)

Parses a base64-encoded transaction XDR string.

#### Parameters

##### transactionXdr

`string`

The base64-encoded transaction

##### networkPassphrase

`string`

The network passphrase

#### Returns

`Transaction`\<`Memo`\<`MemoType`\>, `Operation`[]\> \| `FeeBumpTransaction`

The parsed Transaction or FeeBumpTransaction
