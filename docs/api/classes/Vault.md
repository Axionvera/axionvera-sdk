[**Axionvera SDK v1.0.0**](../README.md)

***

[Axionvera SDK](../globals.md) / Vault

# Class: Vault

Defined in: src/contracts/Vault.ts:28

## Constructors

### Constructor

> **new Vault**(`config`): `Vault`

Defined in: src/contracts/Vault.ts:33

#### Parameters

##### config

[`VaultConfig`](../interfaces/VaultConfig.md)

#### Returns

`Vault`

## Methods

### claimRewards()

> **claimRewards**(`signer?`): `Promise`\<`ContractTransaction`\>

Defined in: src/contracts/Vault.ts:165

Claim pending rewards

#### Parameters

##### signer?

`any`

Optional signer (uses connected signer if not provided)

#### Returns

`Promise`\<`ContractTransaction`\>

***

### connect()

> **connect**(`signer`): `Vault`

Defined in: src/contracts/Vault.ts:46

Connect to vault with signer for write operations

#### Parameters

##### signer

`Signer`

#### Returns

`Vault`

***

### convertToAssets()

> **convertToAssets**(`shares`): `Promise`\<`BigNumber`\>

Defined in: src/contracts/Vault.ts:94

Convert shares to underlying assets

#### Parameters

##### shares

`BigNumberish`

#### Returns

`Promise`\<`BigNumber`\>

***

### convertToShares()

> **convertToShares**(`assets`): `Promise`\<`BigNumber`\>

Defined in: src/contracts/Vault.ts:101

Convert underlying assets to shares

#### Parameters

##### assets

`BigNumberish`

#### Returns

`Promise`\<`BigNumber`\>

***

### deposit()

> **deposit**(`params`, `signer?`): `Promise`\<`ContractTransaction`\>

Defined in: src/contracts/Vault.ts:110

Deposit assets into vault

#### Parameters

##### params

[`DepositParams`](../interfaces/DepositParams.md)

Deposit parameters

##### signer?

`any`

Optional signer (uses connected signer if not provided)

#### Returns

`Promise`\<`ContractTransaction`\>

***

### estimateDepositGas()

> **estimateDepositGas**(`amount`): `Promise`\<`BigNumber`\>

Defined in: src/contracts/Vault.ts:193

Estimate deposit gas cost

#### Parameters

##### amount

`BigNumberish`

#### Returns

`Promise`\<`BigNumber`\>

***

### estimateWithdrawGas()

> **estimateWithdrawGas**(`amount`): `Promise`\<`BigNumber`\>

Defined in: src/contracts/Vault.ts:200

Estimate withdraw gas cost

#### Parameters

##### amount

`BigNumberish`

#### Returns

`Promise`\<`BigNumber`\>

***

### getAssetsBalance()

> **getAssetsBalance**(`userAddress`): `Promise`\<`BigNumber`\>

Defined in: src/contracts/Vault.ts:86

Get user's underlying assets balance

#### Parameters

##### userAddress

`string`

Address of the user

#### Returns

`Promise`\<`BigNumber`\>

Converted balance in underlying asset

***

### getBalance()

> **getBalance**(`userAddress`): `Promise`\<`BigNumber`\>

Defined in: src/contracts/Vault.ts:77

Get user's vault balance

#### Parameters

##### userAddress

`string`

Address of the user

#### Returns

`Promise`\<`BigNumber`\>

User's balance in vault shares

***

### getPendingRewards()

> **getPendingRewards**(`userAddress`): `Promise`\<`BigNumber`\>

Defined in: src/contracts/Vault.ts:186

Get pending rewards for a user

#### Parameters

##### userAddress

`string`

Address of the user

#### Returns

`Promise`\<`BigNumber`\>

***

### getVaultInfo()

> **getVaultInfo**(): `Promise`\<[`VaultInfo`](../interfaces/VaultInfo.md)\>

Defined in: src/contracts/Vault.ts:56

Get vault information (total assets, total supply, APY, lock period)

#### Returns

`Promise`\<[`VaultInfo`](../interfaces/VaultInfo.md)\>

***

### withdraw()

> **withdraw**(`params`, `signer?`): `Promise`\<`ContractTransaction`\>

Defined in: src/contracts/Vault.ts:137

Withdraw assets from vault

#### Parameters

##### params

[`WithdrawParams`](../interfaces/WithdrawParams.md)

Withdraw parameters

##### signer?

`any`

Optional signer (uses connected signer if not provided)

#### Returns

`Promise`\<`ContractTransaction`\>
