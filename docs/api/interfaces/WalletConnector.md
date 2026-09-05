[**Axionvera SDK v1.0.0**](../README.md)

***

[Axionvera SDK](../globals.md) / WalletConnector

# Interface: WalletConnector

Defined in: [src/wallet/walletConnector.ts:23](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/wallet/walletConnector.ts#L23)

Interface for wallet implementations that can sign transactions.
Implement this interface to integrate browser extension wallets (like Freighter) or use the provided connectors.

## Example

```typescript
import { WalletConnector } from "axionvera-sdk";

class CustomWalletConnector implements WalletConnector {
  async getPublicKey(): Promise<string> {
    // Return the connected wallet's public key
    return "GD5JPQ7VKFOVRWPOEX74JYXHHFNTFZ2JE5WZ4K2MWTROVHMWHD7KUZ2V";
  }

  async signTransaction(transactionXdr: string, networkPassphrase: string): Promise<string> {
    // Sign the transaction using your wallet
    return signedXdr;
  }
}
```

## Methods

### getPublicKey()

> **getPublicKey**(): `Promise`\<`string`\>

Defined in: [src/wallet/walletConnector.ts:33](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/wallet/walletConnector.ts#L33)

Gets the public key of the connected account.

#### Returns

`Promise`\<`string`\>

The public key as a G-prefixed string

#### Example

```typescript
const publicKey = await wallet.getPublicKey();
console.log("Connected account:", publicKey);
```

***

### signTransaction()

> **signTransaction**(`transactionXdr`, `networkPassphrase`): `Promise`\<`string`\>

Defined in: [src/wallet/walletConnector.ts:49](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/wallet/walletConnector.ts#L49)

Signs a transaction XDR string using the wallet's private key.

#### Parameters

##### transactionXdr

`string`

The base64-encoded transaction XDR to sign

##### networkPassphrase

`string`

The network passphrase for the transaction

#### Returns

`Promise`\<`string`\>

The base64-encoded signed transaction XDR

#### Example

```typescript
const signedXdr = await wallet.signTransaction(
  unsignedXdr,
  "Test SDF Network ; September 2015"
);
console.log("Signed transaction:", signedXdr);
```
