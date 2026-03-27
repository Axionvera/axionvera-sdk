[**Axionvera SDK v0.1.0**](../README.md)

***

[Axionvera SDK](../globals.md) / LocalKeypairWalletConnector

# Class: LocalKeypairWalletConnector

Defined in: [wallet/walletConnector.ts:26](https://github.com/nice-bills/axionvera-sdk/blob/4cdd845e523a767dd67f37a08a4340a0a379b245/src/wallet/walletConnector.ts#L26)

Wallet connector implementation using a local Keypair.
Useful for testing and development without a browser wallet.

## Implements

- [`WalletConnector`](../interfaces/WalletConnector.md)

## Constructors

### Constructor

> **new LocalKeypairWalletConnector**(`keypair`): `LocalKeypairWalletConnector`

Defined in: [wallet/walletConnector.ts:33](https://github.com/nice-bills/axionvera-sdk/blob/4cdd845e523a767dd67f37a08a4340a0a379b245/src/wallet/walletConnector.ts#L33)

Creates a new LocalKeypairWalletConnector.

#### Parameters

##### keypair

`Keypair`

The Keypair to use for signing

#### Returns

`LocalKeypairWalletConnector`

## Methods

### getPublicKey()

> **getPublicKey**(): `Promise`\<`string`\>

Defined in: [wallet/walletConnector.ts:38](https://github.com/nice-bills/axionvera-sdk/blob/4cdd845e523a767dd67f37a08a4340a0a379b245/src/wallet/walletConnector.ts#L38)

Gets the public key of the connected account.

#### Returns

`Promise`\<`string`\>

The public key

#### Implementation of

[`WalletConnector`](../interfaces/WalletConnector.md).[`getPublicKey`](../interfaces/WalletConnector.md#getpublickey)

***

### signTransaction()

> **signTransaction**(`transactionXdr`, `networkPassphrase`): `Promise`\<`string`\>

Defined in: [wallet/walletConnector.ts:43](https://github.com/nice-bills/axionvera-sdk/blob/4cdd845e523a767dd67f37a08a4340a0a379b245/src/wallet/walletConnector.ts#L43)

Signs a transaction XDR string.

#### Parameters

##### transactionXdr

`string`

The base64-encoded transaction XDR

##### networkPassphrase

`string`

The network passphrase

#### Returns

`Promise`\<`string`\>

The base64-encoded signed transaction XDR

#### Implementation of

[`WalletConnector`](../interfaces/WalletConnector.md).[`signTransaction`](../interfaces/WalletConnector.md#signtransaction)
