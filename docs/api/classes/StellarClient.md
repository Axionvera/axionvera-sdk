[**Axionvera SDK v0.1.0**](../README.md)

***

[Axionvera SDK](../globals.md) / StellarClient

# Class: StellarClient

Defined in: [client/stellarClient.ts:42](https://github.com/nice-bills/axionvera-sdk/blob/4cdd845e523a767dd67f37a08a4340a0a379b245/src/client/stellarClient.ts#L42)

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

Defined in: [client/stellarClient.ts:60](https://github.com/nice-bills/axionvera-sdk/blob/4cdd845e523a767dd67f37a08a4340a0a379b245/src/client/stellarClient.ts#L60)

Creates a new StellarClient instance.

#### Parameters

##### options?

`StellarClientOptions`

Configuration options

#### Returns

`StellarClient`

## Properties

### httpClient

> `readonly` **httpClient**: `AxiosInstance`

Defined in: [client/stellarClient.ts:52](https://github.com/nice-bills/axionvera-sdk/blob/4cdd845e523a767dd67f37a08a4340a0a379b245/src/client/stellarClient.ts#L52)

The HTTP client with retry interceptors.

***

### network

> `readonly` **network**: [`AxionveraNetwork`](../type-aliases/AxionveraNetwork.md)

Defined in: [client/stellarClient.ts:44](https://github.com/nice-bills/axionvera-sdk/blob/4cdd845e523a767dd67f37a08a4340a0a379b245/src/client/stellarClient.ts#L44)

The network this client is connected to.

***

### networkPassphrase

> `readonly` **networkPassphrase**: `string`

Defined in: [client/stellarClient.ts:48](https://github.com/nice-bills/axionvera-sdk/blob/4cdd845e523a767dd67f37a08a4340a0a379b245/src/client/stellarClient.ts#L48)

The network passphrase for transaction signing.

***

### retryConfig

> `readonly` **retryConfig**: `Partial`\<[`RetryConfig`](../type-aliases/RetryConfig.md)\>

Defined in: [client/stellarClient.ts:54](https://github.com/nice-bills/axionvera-sdk/blob/4cdd845e523a767dd67f37a08a4340a0a379b245/src/client/stellarClient.ts#L54)

The effective retry configuration after merging with defaults.

***

### rpc

> `readonly` **rpc**: `RpcServer`

Defined in: [client/stellarClient.ts:50](https://github.com/nice-bills/axionvera-sdk/blob/4cdd845e523a767dd67f37a08a4340a0a379b245/src/client/stellarClient.ts#L50)

The underlying RPC server instance.

***

### rpcUrl

> `readonly` **rpcUrl**: `string`

Defined in: [client/stellarClient.ts:46](https://github.com/nice-bills/axionvera-sdk/blob/4cdd845e523a767dd67f37a08a4340a0a379b245/src/client/stellarClient.ts#L46)

The RPC URL this client uses.

## Methods

### getAccount()

> **getAccount**(`publicKey`): `Promise`\<`Account`\>

Defined in: [client/stellarClient.ts:109](https://github.com/nice-bills/axionvera-sdk/blob/4cdd845e523a767dd67f37a08a4340a0a379b245/src/client/stellarClient.ts#L109)

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

### getHealth()

> **getHealth**(): `Promise`\<`unknown`\>

Defined in: [client/stellarClient.ts:81](https://github.com/nice-bills/axionvera-sdk/blob/4cdd845e523a767dd67f37a08a4340a0a379b245/src/client/stellarClient.ts#L81)

Checks the health of the RPC server.
Automatically retries on failure.

#### Returns

`Promise`\<`unknown`\>

The health check response

***

### getLatestLedger()

> **getLatestLedger**(): `Promise`\<`unknown`\>

Defined in: [client/stellarClient.ts:99](https://github.com/nice-bills/axionvera-sdk/blob/4cdd845e523a767dd67f37a08a4340a0a379b245/src/client/stellarClient.ts#L99)

Gets the latest ledger sequence number.
Automatically retries on failure.

#### Returns

`Promise`\<`unknown`\>

The latest ledger info

***

### getNetwork()

> **getNetwork**(): `Promise`\<`unknown`\>

Defined in: [client/stellarClient.ts:90](https://github.com/nice-bills/axionvera-sdk/blob/4cdd845e523a767dd67f37a08a4340a0a379b245/src/client/stellarClient.ts#L90)

Retrieves the network configuration from the RPC server.
Automatically retries on failure.

#### Returns

`Promise`\<`unknown`\>

The network configuration

***

### getTransaction()

> **getTransaction**(`hash`): `Promise`\<`unknown`\>

Defined in: [client/stellarClient.ts:153](https://github.com/nice-bills/axionvera-sdk/blob/4cdd845e523a767dd67f37a08a4340a0a379b245/src/client/stellarClient.ts#L153)

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

Defined in: [client/stellarClient.ts:166](https://github.com/nice-bills/axionvera-sdk/blob/4cdd845e523a767dd67f37a08a4340a0a379b245/src/client/stellarClient.ts#L166)

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

Error if the transaction times out

***

### prepareTransaction()

> **prepareTransaction**(`tx`): `Promise`\<`Transaction`\<`Memo`\<`MemoType`\>, `Operation`[]\>\>

Defined in: [client/stellarClient.ts:131](https://github.com/nice-bills/axionvera-sdk/blob/4cdd845e523a767dd67f37a08a4340a0a379b245/src/client/stellarClient.ts#L131)

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

Defined in: [client/stellarClient.ts:140](https://github.com/nice-bills/axionvera-sdk/blob/4cdd845e523a767dd67f37a08a4340a0a379b245/src/client/stellarClient.ts#L140)

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

Defined in: [client/stellarClient.ts:193](https://github.com/nice-bills/axionvera-sdk/blob/4cdd845e523a767dd67f37a08a4340a0a379b245/src/client/stellarClient.ts#L193)

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

Defined in: [client/stellarClient.ts:119](https://github.com/nice-bills/axionvera-sdk/blob/4cdd845e523a767dd67f37a08a4340a0a379b245/src/client/stellarClient.ts#L119)

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

Defined in: [client/stellarClient.ts:216](https://github.com/nice-bills/axionvera-sdk/blob/4cdd845e523a767dd67f37a08a4340a0a379b245/src/client/stellarClient.ts#L216)

Gets the default network passphrase for a given network.

#### Parameters

##### network

[`AxionveraNetwork`](../type-aliases/AxionveraNetwork.md)

The network ("testnet" or "mainnet")

#### Returns

`string`

The corresponding network passphrase

***

### parseTransactionXdr()

> `static` **parseTransactionXdr**(`transactionXdr`, `networkPassphrase`): `Transaction`\<`Memo`\<`MemoType`\>, `Operation`[]\> \| `FeeBumpTransaction`

Defined in: [client/stellarClient.ts:204](https://github.com/nice-bills/axionvera-sdk/blob/4cdd845e523a767dd67f37a08a4340a0a379b245/src/client/stellarClient.ts#L204)

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
