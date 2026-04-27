export { BaseContract } from './BaseContract';
export type { BaseContractConfig, InvokeMethodOptions } from './BaseContract';
export { VaultContract } from './VaultContract';
export type {
  VaultConfig,
  VaultInfo,
  DepositArgs,
  DepositParams,
  WithdrawArgs,
  WithdrawParams,
  ClaimArgs,
  ClaimRewardsParams,
} from './VaultContract';
// Legacy ethers.js Vault — retained for backward compat.
export { Vault } from './vault';
export { VaultABI } from './abis/VaultABI';
