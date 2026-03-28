[**Axionvera SDK v0.1.0**](../README.md)

***

[Axionvera SDK](../globals.md) / WalletConnector

# Interface: WalletConnector

Defined in: [wallet/walletConnector.ts:6](https://github.com/nice-bills/axionvera-sdk/blob/4cdd845e523a767dd67f37a08a4340a0a379b245/src/wallet/walletConnector.ts#L6)

Interface for wallet implementations that can sign transactions.

## Methods

### getPublicKey()

> **getPublicKey**(): `Promise`\<`string`\>

Defined in: [wallet/walletConnector.ts:11](https://github.com/nice-bills/axionvera-sdk/blob/4cdd845e523a767dd67f37a08a4340a0a379b245/src/wallet/walletConnector.ts#L11)

Gets the public key of the connected account.

#### Returns

`Promise`\<`string`\>

The public key

***

### signTransaction()

> **signTransaction**(`transactionXdr`, `networkPassphrase`): `Promise`\<`string`\>

Defined in: [wallet/walletConnector.ts:19](https://github.com/nice-bills/axionvera-sdk/blob/4cdd845e523a767dd67f37a08a4340a0a379b245/src/wallet/walletConnector.ts#L19)

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
