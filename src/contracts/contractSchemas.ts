import * as v from 'valibot';
import { defaultValidationEngine } from '../validation';
import { nonEmptyStringSchema, positiveBigIntSchema } from '../validation';

/**
 * Example contract schemas, registered against {@link defaultValidationEngine}
 * under the logical contract id `"Vault"`.
 *
 * These mirror the `DepositParams` / `WithdrawParams` / `VaultInfo` shapes
 * documented for the SDK's vault integration and exist to demonstrate how a
 * contract module wires itself into the validation framework: import this
 * module once (for its registration side effects), then call
 * `defaultValidationEngine.validateParams(...)` / `validateResult(...)` at
 * the top of each contract method.
 */

export const VAULT_CONTRACT_ID = 'Vault';

export const VaultDepositParamsSchema = v.object({
  amount: positiveBigIntSchema('Deposit amount must be a positive bigint'),
  asset: v.optional(nonEmptyStringSchema('asset must be a non-empty string when provided')),
  referralCode: v.optional(
    nonEmptyStringSchema('referralCode must be a non-empty string when provided')
  ),
});

export const VaultWithdrawParamsSchema = v.object({
  amount: positiveBigIntSchema('Withdraw amount must be a positive bigint'),
  asset: v.optional(nonEmptyStringSchema('asset must be a non-empty string when provided')),
});

export const VaultInfoResultSchema = v.object({
  totalAssets: v.bigint(),
  totalSupply: v.bigint(),
  apy: v.pipe(v.number(), v.minValue(0, 'apy must not be negative')),
  lockPeriod: v.pipe(v.number(), v.integer(), v.minValue(0, 'lockPeriod must not be negative')),
});

export const VaultBalanceResultSchema = v.bigint();

defaultValidationEngine.registerSchema(VAULT_CONTRACT_ID, 'deposit', {
  params: VaultDepositParamsSchema,
  description: 'Deposits assets into the vault and receives vault shares in return.',
});

defaultValidationEngine.registerSchema(VAULT_CONTRACT_ID, 'withdraw', {
  params: VaultWithdrawParamsSchema,
  description: 'Withdraws assets from the vault by burning vault shares.',
});

defaultValidationEngine.registerSchema(VAULT_CONTRACT_ID, 'getVaultInfo', {
  result: VaultInfoResultSchema,
  description: 'Reads vault-wide metrics: total assets, total supply, APY, and lock period.',
});

defaultValidationEngine.registerSchema(VAULT_CONTRACT_ID, 'getBalance', {
  result: VaultBalanceResultSchema,
  description: "Reads a user's vault share balance.",
});
