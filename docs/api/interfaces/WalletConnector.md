[**Axionvera SDK v1.0.0**](../README.md)

***

[Axionvera SDK](../globals.md) / WalletConnector

# Interface: WalletConnector

Defined in: [src/wallet/walletConnector.ts:6](https://github.com/1sraeliteX/axionvera-sdk/blob/main/src/wallet/walletConnector.ts#L6)

Interface for wallet implementations that can sign transactions.

## Methods

### getPublicKey()

> **getPublicKey**(): `Promise`\<`string`\>

Defined in: [src/wallet/walletConnector.ts:11](https://github.com/1sraeliteX/axionvera-sdk/blob/main/src/wallet/walletConnector.ts#L11)

Gets the public key of the connected account.

#### Returns

`Promise`\<`string`\>

The public key

***

### signTransaction()

> **signTransaction**(`transactionXdr`, `networkPassphrase`): `Promise`\<`string`\>

Defined in: [src/wallet/walletConnector.ts:19](https://github.com/1sraeliteX/axionvera-sdk/blob/main/src/wallet/walletConnector.ts#L19)

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
