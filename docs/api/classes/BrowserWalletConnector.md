[**Axionvera SDK v1.0.0**](../README.md)

***

[Axionvera SDK](../globals.md) / BrowserWalletConnector

# Class: BrowserWalletConnector

Defined in: [src/wallet/browserWalletConnector.ts:42](https://github.com/1sraeliteX/axionvera-sdk/blob/main/src/wallet/browserWalletConnector.ts#L42)

Interface for wallet implementations that can sign transactions.

## Implements

- [`WalletConnector`](../interfaces/WalletConnector.md)

## Constructors

### Constructor

> **new BrowserWalletConnector**(): `BrowserWalletConnector`

#### Returns

`BrowserWalletConnector`

## Methods

### getPublicKey()

> **getPublicKey**(): `Promise`\<`string`\>

Defined in: [src/wallet/browserWalletConnector.ts:44](https://github.com/1sraeliteX/axionvera-sdk/blob/main/src/wallet/browserWalletConnector.ts#L44)

Gets the public key of the connected account.

#### Returns

`Promise`\<`string`\>

The public key

#### Implementation of

[`WalletConnector`](../interfaces/WalletConnector.md).[`getPublicKey`](../interfaces/WalletConnector.md#getpublickey)

***

### signTransaction()

> **signTransaction**(`transactionXdr`, `networkPassphrase`): `Promise`\<`string`\>

Defined in: [src/wallet/browserWalletConnector.ts:50](https://github.com/1sraeliteX/axionvera-sdk/blob/main/src/wallet/browserWalletConnector.ts#L50)

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
