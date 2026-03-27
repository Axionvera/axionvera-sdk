[**Axionvera SDK v0.1.0**](../README.md)

***

[Axionvera SDK](../globals.md) / VaultContract

# Class: VaultContract

Defined in: [contracts/vault.ts:47](https://github.com/nice-bills/axionvera-sdk/blob/4cdd845e523a767dd67f37a08a4340a0a379b245/src/contracts/vault.ts#L47)

High-level API for interacting with Axionvera Vault contracts.

Handles the full transaction lifecycle: building, simulating,
signing, and submitting transactions to the vault contract.

## Example

```typescript
import { StellarClient, VaultContract, LocalKeypairWalletConnector } from "axionvera-sdk";
import { Keypair } from "@stellar/stellar-sdk";

const client = new StellarClient({ network: "testnet" });
const wallet = new LocalKeypairWalletConnector(Keypair.fromSecret("..."));
const vault = new VaultContract({
  client,
  contractId: "CONTRACT_ID...",
  wallet
});

await vault.deposit({ amount: 1000n });
```

## Constructors

### Constructor

> **new VaultContract**(`params`): `VaultContract`

Defined in: [contracts/vault.ts:62](https://github.com/nice-bills/axionvera-sdk/blob/4cdd845e523a767dd67f37a08a4340a0a379b245/src/contracts/vault.ts#L62)

Creates a new VaultContract instance.

#### Parameters

##### params

Constructor parameters

###### client

[`StellarClient`](StellarClient.md)

The StellarClient instance for RPC communication

###### contractId

`string`

The deployed vault contract ID

###### options?

`VaultContractOptions`

Optional configuration for method names

###### wallet?

[`WalletConnector`](../interfaces/WalletConnector.md)

Optional wallet connector for signing transactions

#### Returns

`VaultContract`

## Properties

### contractId

> `readonly` **contractId**: `string`

Defined in: [contracts/vault.ts:49](https://github.com/nice-bills/axionvera-sdk/blob/4cdd845e523a767dd67f37a08a4340a0a379b245/src/contracts/vault.ts#L49)

The deployed vault contract ID on the network.

## Methods

### claimRewards()

> **claimRewards**(`params?`): `Promise`\<`unknown`\>

Defined in: [contracts/vault.ts:122](https://github.com/nice-bills/axionvera-sdk/blob/4cdd845e523a767dd67f37a08a4340a0a379b245/src/contracts/vault.ts#L122)

Claims accumulated rewards from the vault.

#### Parameters

##### params?

Optional parameters

###### from?

`string`

The source account (defaults to wallet public key)

#### Returns

`Promise`\<`unknown`\>

The transaction result

***

### deposit()

> **deposit**(`params`): `Promise`\<`unknown`\>

Defined in: [contracts/vault.ts:87](https://github.com/nice-bills/axionvera-sdk/blob/4cdd845e523a767dd67f37a08a4340a0a379b245/src/contracts/vault.ts#L87)

Deposits assets into the vault.

#### Parameters

##### params

Deposit parameters

###### amount

`bigint`

The amount to deposit

###### from?

`string`

The source account (defaults to wallet public key)

#### Returns

`Promise`\<`unknown`\>

The transaction result

***

### getBalance()

> **getBalance**(`params`): `Promise`\<`unknown`\>

Defined in: [contracts/vault.ts:136](https://github.com/nice-bills/axionvera-sdk/blob/4cdd845e523a767dd67f37a08a4340a0a379b245/src/contracts/vault.ts#L136)

Gets the balance of an account in the vault.

#### Parameters

##### params

Query parameters

###### account?

`string`

The account to query (defaults to wallet public key)

#### Returns

`Promise`\<`unknown`\>

The account balance

***

### withdraw()

> **withdraw**(`params`): `Promise`\<`unknown`\>

Defined in: [contracts/vault.ts:105](https://github.com/nice-bills/axionvera-sdk/blob/4cdd845e523a767dd67f37a08a4340a0a379b245/src/contracts/vault.ts#L105)

Withdraws assets from the vault.

#### Parameters

##### params

Withdraw parameters

###### amount

`bigint`

The amount to withdraw

###### from?

`string`

The source account (defaults to wallet public key)

#### Returns

`Promise`\<`unknown`\>

The transaction result
