[**Axionvera SDK v1.0.0**](../README.md)

***

[Axionvera SDK](../globals.md) / StellarClient

# Class: StellarClient

Defined in: [src/client/stellarClient.ts:68](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/client/stellarClient.ts#L68)

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

Defined in: [src/client/stellarClient.ts:122](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/client/stellarClient.ts#L122)

Creates a new StellarClient instance for interacting with Soroban RPC.

#### Parameters

##### options?

[`StellarClientOptions`](../type-aliases/StellarClientOptions.md)

Configuration options for the client

#### Returns

`StellarClient`

#### Example

```typescript
import { StellarClient } from "axionvera-sdk";

// Connect to testnet with default settings
const client = new StellarClient({ network: "testnet" });

// Connect to a custom RPC endpoint
const customClient = new StellarClient({
  rpcUrl: "https://your-custom-rpc.com",
  networkPassphrase: "Public Global Stellar Network ; September 2015"
});

// Enable concurrency control for high-volume apps
const highVolumeClient = new StellarClient({
  network: "mainnet",
  concurrencyConfig: {
    maxConcurrentRequests: 10,
    queueTimeout: 5000
  }
});
```

## Properties

### concurrencyConfig

> `readonly` **concurrencyConfig**: `ConcurrencyConfig`

Defined in: [src/client/stellarClient.ts:82](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/client/stellarClient.ts#L82)

The effective concurrency configuration after merging with defaults.

***

### concurrencyEnabled

> `readonly` **concurrencyEnabled**: `boolean`

Defined in: [src/client/stellarClient.ts:84](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/client/stellarClient.ts#L84)

Whether concurrency control is enabled.

***

### httpClient

> `readonly` **httpClient**: `AxiosInstance`

Defined in: [src/client/stellarClient.ts:78](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/client/stellarClient.ts#L78)

The HTTP client with retry interceptors.

***

### logger

> `readonly` **logger**: `Logger`

Defined in: [src/client/stellarClient.ts:88](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/client/stellarClient.ts#L88)

Logger instance for debugging and monitoring.

***

### network

> `readonly` **network**: `AxionveraNetwork`

Defined in: [src/client/stellarClient.ts:70](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/client/stellarClient.ts#L70)

The network this client is connected to.

***

### networkPassphrase

> `readonly` **networkPassphrase**: `string`

Defined in: [src/client/stellarClient.ts:74](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/client/stellarClient.ts#L74)

The network passphrase for transaction signing.

***

### retryConfig

> `readonly` **retryConfig**: `Partial`\<`RetryConfig`\>

Defined in: [src/client/stellarClient.ts:80](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/client/stellarClient.ts#L80)

The effective retry configuration after merging with defaults.

***

### rpc

> `readonly` **rpc**: `RpcServer`

Defined in: [src/client/stellarClient.ts:76](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/client/stellarClient.ts#L76)

The underlying RPC server instance.

***

### rpcUrl

> `readonly` **rpcUrl**: `string`

Defined in: [src/client/stellarClient.ts:72](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/client/stellarClient.ts#L72)

The RPC URL this client uses.

***

### webSocketManager?

> `readonly` `optional` **webSocketManager?**: `WebSocketManager`

Defined in: [src/client/stellarClient.ts:86](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/client/stellarClient.ts#L86)

WebSocket manager for real-time event subscriptions.

## Methods

### clearAccountCache()

> **clearAccountCache**(): `void`

Defined in: [src/client/stellarClient.ts:347](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/client/stellarClient.ts#L347)

Clears the account cache, removing all cached account data.
Useful for testing or when you need to force fresh data from the network.

#### Returns

`void`

#### Example

```typescript
import { StellarClient } from "axionvera-sdk";

const client = new StellarClient({ network: "testnet" });

// Clear cache to force fresh network fetch
client.clearAccountCache();
console.log("Account cache cleared");
```

***

### getAccount()

> **getAccount**(`publicKey`): `Promise`\<`Account`\>

Defined in: [src/client/stellarClient.ts:272](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/client/stellarClient.ts#L272)

Retrieves an account's information from the network with automatic retry on failure.

#### Parameters

##### publicKey

`string`

The account's public key (G-prefixed string)

#### Returns

`Promise`\<`Account`\>

The account information including sequence number and balances

#### Example

```typescript
import { StellarClient } from "axionvera-sdk";

const client = new StellarClient({ network: "testnet" });
const account = await client.getAccount("GD5JPQ7VKFOVRWPOEX74JYXHHFNTFZ2JE5WZ4K2MWTROVHMWHD7KUZ2V");
console.log("Sequence:", account.sequenceNumber().toString());
console.log("Balance:", account.balance());
```

***

### getAccountWithCache()

> **getAccountWithCache**(`publicKey`): `Promise`\<`Account`\>

Defined in: [src/client/stellarClient.ts:298](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/client/stellarClient.ts#L298)

Retrieves an account's information with offline cache fallback.
Tries to fetch from the network first, but falls back to cached data if the network is unavailable.
The cache is valid for 5 seconds and sequence numbers are incremented for sequential offline builds.

#### Parameters

##### publicKey

`string`

The account's public key (G-prefixed string)

#### Returns

`Promise`\<`Account`\>

The account information including sequence number and balances

#### Throws

AxionveraError if both network fetch fails and no valid cache exists

#### Example

```typescript
import { StellarClient } from "axionvera-sdk";

const client = new StellarClient({ network: "testnet" });

// First call fetches from network and caches the result
const account1 = await client.getAccountWithCache("GD5JPQ7VKFOVRWPOEX74JYXHHFNTFZ2JE5WZ4K2MWTROVHMWHD7KUZ2V");
console.log("Sequence:", account1.sequenceNumber().toString());

// If network fails within 5 seconds, returns cached account with incremented sequence
const account2 = await client.getAccountWithCache("GD5JPQ7VKFOVRWPOEX74JYXHHFNTFZ2JE5WZ4K2MWTROVHMWHD7KUZ2V");
console.log("Cached sequence:", account2.sequenceNumber().toString());
```

***

### getConcurrencyStats()

> **getConcurrencyStats**(): `any`

Defined in: [src/client/stellarClient.ts:644](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/client/stellarClient.ts#L644)

Gets concurrency control statistics if enabled, showing request queue metrics.

#### Returns

`any`

Concurrency statistics including enabled status, max concurrent requests, and queue timeout

#### Example

```typescript
import { StellarClient } from "axionvera-sdk";

const client = new StellarClient({
  network: "mainnet",
  concurrencyConfig: {
    maxConcurrentRequests: 10,
    queueTimeout: 5000
  }
});

const stats = client.getConcurrencyStats();
console.log("Concurrency enabled:", stats.enabled);
console.log("Max concurrent requests:", stats.maxConcurrentRequests);
```

***

### getHealth()

> **getHealth**(): `Promise`\<`GetHealthResponse`\>

Defined in: [src/client/stellarClient.ts:196](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/client/stellarClient.ts#L196)

Checks the health of the RPC server with automatic retry on failure.

#### Returns

`Promise`\<`GetHealthResponse`\>

The health check response containing status information

#### Example

```typescript
import { StellarClient } from "axionvera-sdk";

const client = new StellarClient({ network: "testnet" });
const health = await client.getHealth();
console.log("RPC Status:", health.status);
```

***

### getLatestLedger()

> **getLatestLedger**(): `Promise`\<`GetLatestLedgerResponse`\>

Defined in: [src/client/stellarClient.ts:246](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/client/stellarClient.ts#L246)

Retrieves information about the latest ledger on the network.

#### Returns

`Promise`\<`GetLatestLedgerResponse`\>

The latest ledger response containing sequence, timestamp, and protocol version

#### Example

```typescript
import { StellarClient } from "axionvera-sdk";

const client = new StellarClient({ network: "testnet" });
const ledger = await client.getLatestLedger();
console.log("Latest sequence:", ledger.sequence);
console.log("Timestamp:", new Date(ledger.closedAt * 1000).toISOString());
```

***

### getNetwork()

> **getNetwork**(): `Promise`\<`GetNetworkResponse`\>

Defined in: [src/client/stellarClient.ts:221](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/client/stellarClient.ts#L221)

Retrieves network information including the network passphrase and friendbot URL.

#### Returns

`Promise`\<`GetNetworkResponse`\>

The network information response

#### Example

```typescript
import { StellarClient } from "axionvera-sdk";

const client = new StellarClient({ network: "testnet" });
const network = await client.getNetwork();
console.log("Network passphrase:", network.networkPassphrase);
console.log("Friendbot URL:", network.friendbotUrl);
```

***

### getTransaction()

> **getTransaction**(`hash`): `Promise`\<`unknown`\>

Defined in: [src/client/stellarClient.ts:496](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/client/stellarClient.ts#L496)

Retrieves the status of a submitted transaction with automatic retry on failure.

#### Parameters

##### hash

`string`

The transaction hash to query

#### Returns

`Promise`\<`unknown`\>

The transaction status response containing current state and details

#### Example

```typescript
import { StellarClient } from "axionvera-sdk";

const client = new StellarClient({ network: "testnet" });
const txStatus = await client.getTransaction("abc123...");
console.log("Status:", txStatus.status);
```

***

### pollTransaction()

> **pollTransaction**(`hash`, `params?`): `Promise`\<`unknown`\>

Defined in: [src/client/stellarClient.ts:524](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/client/stellarClient.ts#L524)

Polls for a transaction to be confirmed or rejected, waiting until it reaches a final state.

#### Parameters

##### hash

`string`

The transaction hash to wait for

##### params?

Optional polling parameters

###### intervalMs?

`number`

Time between polls in milliseconds (default: 1000)

###### timeoutMs?

`number`

Maximum time to wait in milliseconds (default: 30000)

#### Returns

`Promise`\<`unknown`\>

The transaction result when it reaches a final state (SUCCESS or FAILED)

#### Throws

TimeoutError if the transaction does not reach a final state within the timeout

#### Example

```typescript
import { StellarClient } from "axionvera-sdk";

const client = new StellarClient({ network: "testnet" });

// Submit a transaction and wait for confirmation
const result = await client.sendTransaction(signedTx);
const finalResult = await client.pollTransaction(result.hash, {
  timeoutMs: 60000,  // Wait up to 60 seconds
  intervalMs: 2000    // Poll every 2 seconds
});

console.log("Final status:", finalResult.status);
```

***

### prepareTransaction()

> **prepareTransaction**(`tx`): `Promise`\<`Transaction`\<`Memo`\<`MemoType`\>, `Operation`[]\>\>

Defined in: [src/client/stellarClient.ts:420](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/client/stellarClient.ts#L420)

Prepares a transaction by fetching the current ledger sequence and setting the correct min sequence age.

#### Parameters

##### tx

`Transaction`\<`Memo`\<`MemoType`\>, `Operation`[]\> \| `FeeBumpTransaction`

The transaction to prepare (Transaction or FeeBumpTransaction)

#### Returns

`Promise`\<`Transaction`\<`Memo`\<`MemoType`\>, `Operation`[]\>\>

The prepared transaction with updated sequence and fee information

#### Example

```typescript
import { StellarClient, TransactionBuilder } from "axionvera-sdk";
import { Keypair } from "@stellar/stellar-sdk";

const client = new StellarClient({ network: "testnet" });
const keypair = Keypair.random();
const account = await client.getAccount(keypair.publicKey());

const tx = new TransactionBuilder(account, {
  fee: "100",
  networkPassphrase: client.networkPassphrase
})
  .setTimeout(30)
  .build();

const preparedTx = await client.prepareTransaction(tx);
console.log("Prepared sequence:", preparedTx.sequence);
```

***

### sendTransaction()

> **sendTransaction**(`tx`): `Promise`\<`TransactionSendResult`\>

Defined in: [src/client/stellarClient.ts:450](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/client/stellarClient.ts#L450)

Submits a signed transaction to the network, optionally signing with a wallet connector if configured.

#### Parameters

##### tx

`Transaction`\<`Memo`\<`MemoType`\>, `Operation`[]\> \| `FeeBumpTransaction`

The signed transaction to submit (Transaction or FeeBumpTransaction)

#### Returns

`Promise`\<`TransactionSendResult`\>

The submission result containing the transaction hash and status

#### Example

```typescript
import { StellarClient, TransactionBuilder } from "axionvera-sdk";
import { Keypair } from "@stellar/stellar-sdk";

const client = new StellarClient({ network: "testnet" });
const keypair = Keypair.random();
const account = await client.getAccount(keypair.publicKey());

const tx = new TransactionBuilder(account, {
  fee: "100",
  networkPassphrase: client.networkPassphrase
})
  .setTimeout(30)
  .build();

tx.sign(keypair);
const result = await client.sendTransaction(tx);
console.log("Transaction hash:", result.hash);
console.log("Status:", result.status);
```

***

### signWithKeypair()

> **signWithKeypair**(`tx`, `keypair`): `Promise`\<`Transaction`\<`Memo`\<`MemoType`\>, `Operation`[]\>\>

Defined in: [src/client/stellarClient.ts:568](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/client/stellarClient.ts#L568)

Signs a transaction using a local Keypair for server-side or automated signing.

#### Parameters

##### tx

`Transaction`

The transaction to sign

##### keypair

`Keypair`

The Keypair to sign with

#### Returns

`Promise`\<`Transaction`\<`Memo`\<`MemoType`\>, `Operation`[]\>\>

The signed transaction

#### Example

```typescript
import { StellarClient, TransactionBuilder } from "axionvera-sdk";
import { Keypair } from "@stellar/stellar-sdk";

const client = new StellarClient({ network: "testnet" });
const keypair = Keypair.fromSecret("S...");
const account = await client.getAccount(keypair.publicKey());

const tx = new TransactionBuilder(account, {
  fee: "100",
  networkPassphrase: client.networkPassphrase
})
  .setTimeout(30)
  .build();

const signedTx = await client.signWithKeypair(tx, keypair);
```

***

### simulateTransaction()

> **simulateTransaction**(`tx`): `Promise`\<`SimulateTransactionResponse`\>

Defined in: [src/client/stellarClient.ts:378](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/client/stellarClient.ts#L378)

Simulates a transaction without submitting it to test validity and estimate costs.

#### Parameters

##### tx

`Transaction`\<`Memo`\<`MemoType`\>, `Operation`[]\> \| `FeeBumpTransaction`

The transaction to simulate (Transaction or FeeBumpTransaction)

#### Returns

`Promise`\<`SimulateTransactionResponse`\>

The simulation result with resource costs and any diagnostic events

#### Throws

SimulationFailedError if the transaction would fail during execution

#### Example

```typescript
import { StellarClient, TransactionBuilder } from "axionvera-sdk";
import { Keypair } from "@stellar/stellar-sdk";

const client = new StellarClient({ network: "testnet" });
const keypair = Keypair.random();
const account = await client.getAccount(keypair.publicKey());

const tx = new TransactionBuilder(account, {
  fee: "100",
  networkPassphrase: client.networkPassphrase
})
  .setTimeout(30)
  .build();

const simulation = await client.simulateTransaction(tx);
console.log("CPU instructions:", simulation.results[0].cpuInstructions);
console.log("Memory bytes:", simulation.results[0].memoryBytes);
```

***

### getDefaultNetworkPassphrase()

> `static` **getDefaultNetworkPassphrase**(`network`): `string`

Defined in: [src/client/stellarClient.ts:613](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/client/stellarClient.ts#L613)

Gets the default network passphrase for a given Stellar network.

#### Parameters

##### network

`AxionveraNetwork`

The network identifier ("testnet" or "mainnet")

#### Returns

`string`

The corresponding network passphrase string

#### Example

```typescript
import { StellarClient } from "axionvera-sdk";

const testnetPassphrase = StellarClient.getDefaultNetworkPassphrase("testnet");
console.log(testnetPassphrase); // "Test SDF Network ; September 2015"

const mainnetPassphrase = StellarClient.getDefaultNetworkPassphrase("mainnet");
console.log(mainnetPassphrase); // "Public Global Stellar Network ; September 2015"
```

***

### parseTransactionXdr()

> `static` **parseTransactionXdr**(`transactionXdr`, `networkPassphrase`): `Transaction`\<`Memo`\<`MemoType`\>, `Operation`[]\> \| `FeeBumpTransaction`

Defined in: [src/client/stellarClient.ts:591](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/client/stellarClient.ts#L591)

Parses a base64-encoded transaction XDR string into a Transaction or FeeBumpTransaction object.

#### Parameters

##### transactionXdr

`string`

The base64-encoded transaction XDR string

##### networkPassphrase

`string`

The network passphrase for the transaction

#### Returns

`Transaction`\<`Memo`\<`MemoType`\>, `Operation`[]\> \| `FeeBumpTransaction`

The parsed Transaction or FeeBumpTransaction

#### Example

```typescript
import { StellarClient } from "axionvera-sdk";

const xdr = "AAAA..."; // Base64-encoded transaction XDR
const tx = StellarClient.parseTransactionXdr(
  xdr,
  "Test SDF Network ; September 2015"
);

console.log("Source account:", tx.source);
```
