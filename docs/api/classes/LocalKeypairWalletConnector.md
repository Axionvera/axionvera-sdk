[**Axionvera SDK v1.0.0**](../README.md)

***

[Axionvera SDK](../globals.md) / LocalKeypairWalletConnector

# Class: LocalKeypairWalletConnector

Defined in: [src/wallet/walletConnector.ts:67](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/wallet/walletConnector.ts#L67)

Wallet connector implementation using a local Keypair for server-side or automated signing.
Useful for testing, development, and backend services without a browser wallet.

## Example

```typescript
import { LocalKeypairWalletConnector } from "axionvera-sdk";
import { Keypair } from "@stellar/stellar-sdk";

const keypair = Keypair.fromSecret("S...");
const wallet = new LocalKeypairWalletConnector(keypair);

const publicKey = await wallet.getPublicKey();
console.log("Public key:", publicKey);
```

## Implements

- [`WalletConnector`](../interfaces/WalletConnector.md)

## Constructors

### Constructor

> **new LocalKeypairWalletConnector**(`keypair`): `LocalKeypairWalletConnector`

Defined in: [src/wallet/walletConnector.ts:87](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/wallet/walletConnector.ts#L87)

Creates a new LocalKeypairWalletConnector with the provided Keypair.

#### Parameters

##### keypair

`Keypair`

The Keypair to use for signing transactions

#### Returns

`LocalKeypairWalletConnector`

#### Example

```typescript
import { LocalKeypairWalletConnector } from "axionvera-sdk";
import { Keypair } from "@stellar/stellar-sdk";

// From secret key
const keypair = Keypair.fromSecret("S...");
const wallet = new LocalKeypairWalletConnector(keypair);

// Or generate a new random keypair
const randomKeypair = Keypair.random();
const randomWallet = new LocalKeypairWalletConnector(randomKeypair);
```

## Methods

### getPublicKey()

> **getPublicKey**(): `Promise`\<`string`\>

Defined in: [src/wallet/walletConnector.ts:100](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/wallet/walletConnector.ts#L100)

Gets the public key from the stored Keypair.

#### Returns

`Promise`\<`string`\>

The public key as a G-prefixed string

#### Example

```typescript
const publicKey = await wallet.getPublicKey();
console.log("Public key:", publicKey);
```

#### Implementation of

[`WalletConnector`](../interfaces/WalletConnector.md).[`getPublicKey`](../interfaces/WalletConnector.md#getpublickey)

***

### signTransaction()

> **signTransaction**(`transactionXdr`, `networkPassphrase`): `Promise`\<`string`\>

Defined in: [src/wallet/walletConnector.ts:118](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/wallet/walletConnector.ts#L118)

Signs a transaction using the stored Keypair.

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
