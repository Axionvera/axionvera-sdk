import * as v from 'valibot';
import { defaultMigrationRegistry, defaultMigrationStateValidator } from '../migrations';
import type { MigrationStepDefinition } from '../types';
import { nonNegativeBigIntSchema } from '../validation';

/**
 * Example contract state migrations, registered against
 * {@link defaultMigrationRegistry} / {@link defaultMigrationStateValidator}
 * for the logical contract id `"Vault"`.
 *
 * These demonstrate how a contract module wires itself into the migration
 * toolkit: define one {@link MigrationStepDefinition} per version bump,
 * register a state schema per version, then drive the chain with a
 * `MigrationRunner` (see `CONTRACT_MIGRATION_TOOLKIT.md` for end-to-end
 * usage). The state shapes below are illustrative, not the SDK's real Vault
 * on-chain state.
 */

export const VAULT_MIGRATION_CONTRACT_ID = 'Vault';

export interface VaultStateV1 {
  totalAssets: bigint;
  totalSupply: bigint;
}

export interface VaultStateV2 extends VaultStateV1 {
  apy: number;
  lockPeriod: number;
}

export interface VaultStateV3 extends VaultStateV2 {
  feeBps: number;
}

export const VaultStateV1Schema = v.object({
  totalAssets: nonNegativeBigIntSchema('totalAssets must be a non-negative bigint'),
  totalSupply: nonNegativeBigIntSchema('totalSupply must be a non-negative bigint'),
});

export const VaultStateV2Schema = v.object({
  totalAssets: nonNegativeBigIntSchema('totalAssets must be a non-negative bigint'),
  totalSupply: nonNegativeBigIntSchema('totalSupply must be a non-negative bigint'),
  apy: v.pipe(v.number(), v.minValue(0, 'apy must not be negative')),
  lockPeriod: v.pipe(v.number(), v.integer(), v.minValue(0, 'lockPeriod must not be negative')),
});

export const VaultStateV3Schema = v.object({
  totalAssets: nonNegativeBigIntSchema('totalAssets must be a non-negative bigint'),
  totalSupply: nonNegativeBigIntSchema('totalSupply must be a non-negative bigint'),
  apy: v.pipe(v.number(), v.minValue(0, 'apy must not be negative')),
  lockPeriod: v.pipe(v.number(), v.integer(), v.minValue(0, 'lockPeriod must not be negative')),
  feeBps: v.pipe(
    v.number(),
    v.integer(),
    v.minValue(0, 'feeBps must not be negative'),
    v.maxValue(10_000, 'feeBps must not exceed 10000 (100%)')
  ),
});

defaultMigrationStateValidator.registerStateSchema(
  VAULT_MIGRATION_CONTRACT_ID,
  'v1',
  VaultStateV1Schema
);
defaultMigrationStateValidator.registerStateSchema(
  VAULT_MIGRATION_CONTRACT_ID,
  'v2',
  VaultStateV2Schema
);
defaultMigrationStateValidator.registerStateSchema(
  VAULT_MIGRATION_CONTRACT_ID,
  'v3',
  VaultStateV3Schema
);

export const vaultV1ToV2Migration: MigrationStepDefinition<VaultStateV1, VaultStateV2> = {
  id: 'vault-v1-to-v2',
  fromVersion: 'v1',
  toVersion: 'v2',
  description: 'Adds the apy/lockPeriod fields introduced in VaultStateV2, defaulting to 0.',
  migrate: (state) => ({ ...state, apy: 0, lockPeriod: 0 }),
  rollback: (state) => {
    const { apy, lockPeriod, ...rest } = state;
    void apy;
    void lockPeriod;
    return rest;
  },
};

export const vaultV2ToV3Migration: MigrationStepDefinition<VaultStateV2, VaultStateV3> = {
  id: 'vault-v2-to-v3',
  fromVersion: 'v2',
  toVersion: 'v3',
  description: 'Adds the feeBps field introduced in VaultStateV3, defaulting to 0.',
  migrate: (state) => ({ ...state, feeBps: 0 }),
  rollback: (state) => {
    const { feeBps, ...rest } = state;
    void feeBps;
    return rest;
  },
};

defaultMigrationRegistry.register(VAULT_MIGRATION_CONTRACT_ID, vaultV1ToV2Migration);
defaultMigrationRegistry.register(VAULT_MIGRATION_CONTRACT_ID, vaultV2ToV3Migration);
