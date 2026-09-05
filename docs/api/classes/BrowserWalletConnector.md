[**Axionvera SDK v1.0.0**](../README.md)

***

[Axionvera SDK](../globals.md) / BrowserWalletConnector

# Class: BrowserWalletConnector

Defined in: [src/wallet/browserWalletConnector.ts:42](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/wallet/browserWalletConnector.ts#L42)

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

Defined in: [src/wallet/browserWalletConnector.ts:44](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/wallet/browserWalletConnector.ts#L44)

Gets the public key of the connected account.

#### Returns

`Promise`\<`string`\>

The public key as a G-prefixed string

#### Example

```typescript
const publicKey = await wallet.getPublicKey();
console.log("Connected account:", publicKey);
```

#### Implementation of

[`WalletConnector`](../interfaces/WalletConnector.md).[`getPublicKey`](../interfaces/WalletConnector.md#getpublickey)

***

### signTransaction()

> **signTransaction**(`transactionXdr`, `networkPassphrase`): `Promise`\<`string`\>

Defined in: [src/wallet/browserWalletConnector.ts:50](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/wallet/browserWalletConnector.ts#L50)

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

#### Implementation of

[`WalletConnector`](../interfaces/WalletConnector.md).[`signTransaction`](../interfaces/WalletConnector.md#signtransaction)
