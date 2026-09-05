[**Axionvera SDK v1.0.0**](../README.md)

***

[Axionvera SDK](../globals.md) / MockWalletConnector

# Class: MockWalletConnector

Defined in: [src/wallet/walletConnector.ts:148](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/wallet/walletConnector.ts#L148)

Mock wallet connector for browser sandbox testing and playground environments.
Returns a fake public key and simulates signing without requiring a real wallet.
Useful for StackBlitz demos, prototyping, and demonstrating SDK flows.

## Example

```typescript
import { MockWalletConnector } from "axionvera-sdk";

// Use with auto-generated public key
const mockWallet = new MockWalletConnector();

// Or use with a specific public key
const customMockWallet = new MockWalletConnector(
  "GD5JPQ7VKFOVRWPOEX74JYXHHFNTFZ2JE5WZ4K2MWTROVHMWHD7KUZ2V"
);

const publicKey = await mockWallet.getPublicKey();
console.log("Mock public key:", publicKey);
```

## Implements

- [`WalletConnector`](../interfaces/WalletConnector.md)

## Constructors

### Constructor

> **new MockWalletConnector**(`publicKey?`): `MockWalletConnector`

Defined in: [src/wallet/walletConnector.ts:167](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/wallet/walletConnector.ts#L167)

Creates a new MockWalletConnector with an optional fake public key.

#### Parameters

##### publicKey?

`string`

Optional fake public key. If not provided, generates a random one.

#### Returns

`MockWalletConnector`

#### Example

```typescript
import { MockWalletConnector } from "axionvera-sdk";

// Auto-generate a random public key
const wallet1 = new MockWalletConnector();

// Use a specific public key for testing
const wallet2 = new MockWalletConnector(
  "GD5JPQ7VKFOVRWPOEX74JYXHHFNTFZ2JE5WZ4K2MWTROVHMWHD7KUZ2V"
);
```

## Methods

### getPublicKey()

> **getPublicKey**(): `Promise`\<`string`\>

Defined in: [src/wallet/walletConnector.ts:180](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/wallet/walletConnector.ts#L180)

Gets the mock public key.

#### Returns

`Promise`\<`string`\>

The mock public key as a G-prefixed string

#### Example

```typescript
const publicKey = await mockWallet.getPublicKey();
console.log("Mock public key:", publicKey);
```

#### Implementation of

[`WalletConnector`](../interfaces/WalletConnector.md).[`getPublicKey`](../interfaces/WalletConnector.md#getpublickey)

***

### signTransaction()

> **signTransaction**(`transactionXdr`, `networkPassphrase`): `Promise`\<`string`\>

Defined in: [src/wallet/walletConnector.ts:201](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/wallet/walletConnector.ts#L201)

Simulates signing a transaction by returning the unsigned XDR.
Note: This is a mock implementation for testing purposes only.
The transaction will fail during actual network submission.

#### Parameters

##### transactionXdr

`string`

The base64-encoded transaction XDR

##### networkPassphrase

`string`

The network passphrase (unused in mock)

#### Returns

`Promise`\<`string`\>

The unsigned transaction XDR (simulated signing)

#### Example

```typescript
const signedXdr = await mockWallet.signTransaction(
  unsignedXdr,
  "Test SDF Network ; September 2015"
);
// Note: This returns the unsigned XDR for simulation purposes
console.log("Mock signed transaction:", signedXdr);
```

#### Implementation of

[`WalletConnector`](../interfaces/WalletConnector.md).[`signTransaction`](../interfaces/WalletConnector.md#signtransaction)
