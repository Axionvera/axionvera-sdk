[**Axionvera SDK v1.0.0**](../README.md)

***

[Axionvera SDK](../globals.md) / Vault

# Class: Vault

Defined in: [src/contracts/vault.ts:28](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/contracts/vault.ts#L28)

## Constructors

### Constructor

> **new Vault**(`config`): `Vault`

Defined in: [src/contracts/vault.ts:33](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/contracts/vault.ts#L33)

#### Parameters

##### config

[`VaultConfig`](../interfaces/VaultConfig.md)

#### Returns

`Vault`

## Methods

### claimRewards()

> **claimRewards**(`signer?`): `Promise`\<`ContractTransaction`\>

Defined in: [src/contracts/vault.ts:303](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/contracts/vault.ts#L303)

Claims pending rewards for the connected user.

#### Parameters

##### signer?

`Signer`

Optional signer for the transaction (uses connected signer if not provided)

#### Returns

`Promise`\<`ContractTransaction`\>

The contract transaction object

#### Throws

ValidationError if no signer is available

#### Example

```typescript
import { Vault } from "axionvera-sdk";

const vault = new Vault({
  contractAddress: "0x123...",
  provider: signer
});

const tx = await vault.claimRewards();
await tx.wait();
console.log("Rewards claimed");
```

***

### connect()

> **connect**(`signer`): `Vault`

Defined in: [src/contracts/vault.ts:61](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/contracts/vault.ts#L61)

Connects the vault instance with a signer for write operations.

#### Parameters

##### signer

`Signer`

The signer to use for transactions

#### Returns

`Vault`

A new Vault instance connected with the signer

#### Example

```typescript
import { Vault } from "axionvera-sdk";
import { ethers } from "ethers";

const vault = new Vault({
  contractAddress: "0x123...",
  provider: provider
});

const signer = wallet.getSigner();
const vaultWithSigner = vault.connect(signer);
```

***

### convertToAssets()

> **convertToAssets**(`shares`): `Promise`\<`bigint`\>

Defined in: [src/contracts/vault.ts:163](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/contracts/vault.ts#L163)

Converts a given amount of vault shares to the equivalent amount of underlying assets.

#### Parameters

##### shares

`bigint`

The amount of shares to convert as bigint

#### Returns

`Promise`\<`bigint`\>

The equivalent amount of underlying assets as a bigint

#### Example

```typescript
import { Vault } from "axionvera-sdk";

const vault = new Vault({
  contractAddress: "0x123...",
  provider: provider
});

const assets = await vault.convertToAssets(100n);
console.log("Assets for 100 shares:", assets);
```

***

### convertToShares()

> **convertToShares**(`assets`): `Promise`\<`bigint`\>

Defined in: [src/contracts/vault.ts:185](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/contracts/vault.ts#L185)

Converts a given amount of underlying assets to the equivalent amount of vault shares.

#### Parameters

##### assets

`bigint`

The amount of assets to convert as bigint

#### Returns

`Promise`\<`bigint`\>

The equivalent amount of vault shares as a bigint

#### Example

```typescript
import { Vault } from "axionvera-sdk";

const vault = new Vault({
  contractAddress: "0x123...",
  provider: provider
});

const shares = await vault.convertToShares(100n);
console.log("Shares for 100 assets:", shares);
```

***

### deposit()

> **deposit**(`params`, `signer?`): `Promise`\<`ContractTransaction`\>

Defined in: [src/contracts/vault.ts:214](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/contracts/vault.ts#L214)

Deposits assets into the vault and receives vault shares in return.

#### Parameters

##### params

[`DepositParams`](../interfaces/DepositParams.md)

Deposit parameters including amount as bigint and optional asset/referral

##### signer?

`Signer`

Optional signer for the transaction (uses connected signer if not provided)

#### Returns

`Promise`\<`ContractTransaction`\>

The contract transaction object

#### Throws

ValidationError if no signer is available

#### Throws

InsufficientFundsError if the user has insufficient funds

#### Example

```typescript
import { Vault } from "axionvera-sdk";

const vault = new Vault({
  contractAddress: "0x123...",
  provider: signer
});

const tx = await vault.deposit({
  amount: 1000000000000000000n // 1 ETH in wei
});

await tx.wait();
console.log("Deposit confirmed");
```

***

### estimateDepositGas()

> **estimateDepositGas**(`amount`): `Promise`\<`bigint`\>

Defined in: [src/contracts/vault.ts:359](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/contracts/vault.ts#L359)

Estimates the gas cost for a deposit transaction.

#### Parameters

##### amount

`bigint`

The amount to deposit as bigint

#### Returns

`Promise`\<`bigint`\>

The estimated gas cost as a bigint

#### Example

```typescript
import { Vault } from "axionvera-sdk";

const vault = new Vault({
  contractAddress: "0x123...",
  provider: provider
});

const gasEstimate = await vault.estimateDepositGas(1000000000000000000n);
console.log("Estimated gas:", gasEstimate);
```

***

### estimateWithdrawGas()

> **estimateWithdrawGas**(`amount`): `Promise`\<`bigint`\>

Defined in: [src/contracts/vault.ts:381](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/contracts/vault.ts#L381)

Estimates the gas cost for a withdrawal transaction.

#### Parameters

##### amount

`bigint`

The amount to withdraw as bigint

#### Returns

`Promise`\<`bigint`\>

The estimated gas cost as a bigint

#### Example

```typescript
import { Vault } from "axionvera-sdk";

const vault = new Vault({
  contractAddress: "0x123...",
  provider: provider
});

const gasEstimate = await vault.estimateWithdrawGas(1000000000000000000n);
console.log("Estimated gas:", gasEstimate);
```

***

### getAssetsBalance()

> **getAssetsBalance**(`userAddress`): `Promise`\<`bigint`\>

Defined in: [src/contracts/vault.ts:141](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/contracts/vault.ts#L141)

Retrieves the user's balance converted to underlying assets.

#### Parameters

##### userAddress

`string`

The wallet address of the user

#### Returns

`Promise`\<`bigint`\>

The user's balance as a bigint of underlying assets

#### Example

```typescript
import { Vault } from "axionvera-sdk";

const vault = new Vault({
  contractAddress: "0x123...",
  provider: provider
});

const assetBalance = await vault.getAssetsBalance("0xuser...");
console.log("Underlying assets:", assetBalance);
```

***

### getBalance()

> **getBalance**(`userAddress`): `Promise`\<`bigint`\>

Defined in: [src/contracts/vault.ts:119](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/contracts/vault.ts#L119)

Retrieves the user's vault balance in shares.

#### Parameters

##### userAddress

`string`

The wallet address of the user

#### Returns

`Promise`\<`bigint`\>

The user's balance as a bigint of vault shares

#### Example

```typescript
import { Vault } from "axionvera-sdk";

const vault = new Vault({
  contractAddress: "0x123...",
  provider: provider
});

const balance = await vault.getBalance("0xuser...");
console.log("Vault shares:", balance);
```

***

### getPendingRewards()

> **getPendingRewards**(`userAddress`): `Promise`\<`bigint`\>

Defined in: [src/contracts/vault.ts:337](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/contracts/vault.ts#L337)

Retrieves the pending rewards for a specific user.

#### Parameters

##### userAddress

`string`

The wallet address of the user

#### Returns

`Promise`\<`bigint`\>

The pending rewards amount as a bigint

#### Example

```typescript
import { Vault } from "axionvera-sdk";

const vault = new Vault({
  contractAddress: "0x123...",
  provider: provider
});

const rewards = await vault.getPendingRewards("0xuser...");
console.log("Pending rewards:", rewards);
```

***

### getVaultInfo()

> **getVaultInfo**(): `Promise`\<[`VaultInfo`](../interfaces/VaultInfo.md)\>

Defined in: [src/contracts/vault.ts:86](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/contracts/vault.ts#L86)

Retrieves vault information including total assets, total supply, APY, and lock period.

#### Returns

`Promise`\<[`VaultInfo`](../interfaces/VaultInfo.md)\>

Vault information object with metrics

#### Example

```typescript
import { Vault } from "axionvera-sdk";

const vault = new Vault({
  contractAddress: "0x123...",
  provider: provider
});

const info = await vault.getVaultInfo();
console.log("Total assets:", info.totalAssets.toString());
console.log("APY:", info.apy);
console.log("Lock period:", info.lockPeriod);
```

***

### withdraw()

> **withdraw**(`params`, `signer?`): `Promise`\<`ContractTransaction`\>

Defined in: [src/contracts/vault.ts:260](https://github.com/Listoncrypt/axionvera-sdk/blob/924107f0c10e2b8e3cb36af7363f52ccf5d19f5f/src/contracts/vault.ts#L260)

Withdraws assets from the vault by burning vault shares.

#### Parameters

##### params

[`WithdrawParams`](../interfaces/WithdrawParams.md)

Withdraw parameters including amount as bigint and optional asset

##### signer?

`Signer`

Optional signer for the transaction (uses connected signer if not provided)

#### Returns

`Promise`\<`ContractTransaction`\>

The contract transaction object

#### Throws

ValidationError if no signer is available

#### Throws

InsufficientFundsError if the user has insufficient vault shares

#### Example

```typescript
import { Vault } from "axionvera-sdk";

const vault = new Vault({
  contractAddress: "0x123...",
  provider: signer
});

const tx = await vault.withdraw({
  amount: 1000000000000000000n // 1 ETH in wei
});

await tx.wait();
console.log("Withdrawal confirmed");
```
