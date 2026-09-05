[**Axionvera SDK v1.0.0**](../README.md)

***

[Axionvera SDK](../globals.md) / FaucetClient

# Class: FaucetClient

Defined in: [src/client/faucetClient.ts:9](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/client/faucetClient.ts#L9)

Client for interacting with Stellar Friendbot faucets.
Useful for automated account funding on Testnet and Futurenet.

## Constructors

### Constructor

> **new FaucetClient**(`client`): `FaucetClient`

Defined in: [src/client/faucetClient.ts:14](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/client/faucetClient.ts#L14)

Creates a new FaucetClient.

#### Parameters

##### client

[`StellarClient`](StellarClient.md)

An instance of StellarClient to detect the current network.

#### Returns

`FaucetClient`

## Methods

### fundAccount()

> **fundAccount**(`publicKey`): `Promise`\<`void`\>

Defined in: [src/client/faucetClient.ts:23](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/client/faucetClient.ts#L23)

Funds an account using Friendbot.

#### Parameters

##### publicKey

`string`

The public key of the account to fund.

#### Returns

`Promise`\<`void`\>

#### Throws

If executed on Mainnet or if the network is unsupported.

#### Throws

If Friendbot rejects the request due to rate limiting (HTTP 429).
