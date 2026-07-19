import { defaultAbiVersionRegistry } from '../registry/abiVersionRegistry';
import { defaultMigrationRegistry } from '../migrations/migrationRegistry';
import type { MigrationContext } from '../types/migration';
import { VAULT_MIGRATION_CONTRACT_ID, type VaultStateV1, type VaultStateV2, type VaultStateV3 } from './contractMigrations';

/**
 * Vault ABI version compatibility, registered against
 * {@link defaultAbiVersionRegistry} for the logical contract id `"Vault"`
 * (see `VAULT_ABI_CONTRACT_ID`, which is the same id used by
 * `contractMigrations.ts` and `contractSchemas.ts`, since all three describe
 * the same logical contract from different angles).
 *
 * The three ABI versions mirror the on-chain history already captured by
 * {@link VaultStateV1}/{@link VaultStateV2}/{@link VaultStateV3}:
 * - **v1**: base vault — deposit/withdraw/balance only. `get_vault_info`
 *   returns just `{ totalAssets, totalSupply }`.
 * - **v2**: adds a rewards program (`claim_rewards`, `pending_rewards`) and
 *   `apy`/`lockPeriod` fields on `get_vault_info`.
 * - **v3** (current/latest): adds a protocol fee, surfaced both as a new
 *   `feeBps` field on `get_vault_info` and via a dedicated `get_fee_bps` read.
 *
 * Canonical (latest-shape) result for `getVaultInfo` is always the v3 shape.
 * Older versions get there by replaying the same {@link defaultMigrationRegistry}
 * steps already registered for persisted state — one raw RPC call becomes
 * one migration-chain application, rather than a second hand-maintained set
 * of upgrade functions.
 */

export const VAULT_ABI_CONTRACT_ID = VAULT_MIGRATION_CONTRACT_ID;

const NOOP_MIGRATION_CONTEXT: MigrationContext = {
  contractId: VAULT_ABI_CONTRACT_ID,
  dryRun: false,
};

/** Upgrades a Vault state object from `fromVersion` to the latest registered migration version (`v3`), by replaying registered migration steps. */
async function upgradeVaultState(
  state: VaultStateV1 | VaultStateV2 | VaultStateV3,
  fromVersion: 'v1' | 'v2' | 'v3'
): Promise<VaultStateV3> {
  const latest = 'v3';
  if (fromVersion === latest) return state as VaultStateV3;

  const plan = defaultMigrationRegistry.resolvePath(VAULT_ABI_CONTRACT_ID, fromVersion, latest);
  let current: unknown = state;
  for (const step of plan.steps) {
    // Sequential by design: each step's output is the next step's input.
    // eslint-disable-next-line no-await-in-loop
    current = await step.migrate(current, NOOP_MIGRATION_CONTEXT);
  }
  return current as VaultStateV3;
}

defaultAbiVersionRegistry.register({
  contractId: VAULT_ABI_CONTRACT_ID,
  version: 'v1',
  description: 'Base vault: deposit, withdraw, balance. No rewards program, no protocol fee.',
  fingerprintMethods: ['get_vault_info', 'deposit_v1'],
  methods: {
    getVaultInfo: {
      rawMethod: 'get_vault_info',
      deserializeResult: (raw) => upgradeVaultState(raw as VaultStateV1, 'v1'),
    },
    getBalance: {
      rawMethod: 'balance_of',
    },
    deposit: {
      rawMethod: 'deposit_v1',
      // v1 only accepts a bare amount — drop referralCode/asset if the
      // canonical caller supplied them.
      serializeArgs: (params) => [(params as { amount: bigint }).amount],
    },
    withdraw: {
      rawMethod: 'withdraw_v1',
      serializeArgs: (params) => [(params as { amount: bigint }).amount],
    },
  },
});

defaultAbiVersionRegistry.register({
  contractId: VAULT_ABI_CONTRACT_ID,
  version: 'v2',
  description: 'Adds the rewards program: claimRewards / pendingRewards, apy, lockPeriod.',
  fingerprintMethods: ['claim_rewards'],
  methods: {
    getVaultInfo: {
      rawMethod: 'get_vault_info',
      deserializeResult: (raw) => upgradeVaultState(raw as VaultStateV2, 'v2'),
    },
    getBalance: {
      rawMethod: 'balance_of',
    },
    deposit: {
      rawMethod: 'deposit',
      serializeArgs: (params) => [(params as { amount: bigint }).amount],
    },
    withdraw: {
      rawMethod: 'withdraw',
      serializeArgs: (params) => [(params as { amount: bigint }).amount],
    },
    claimRewards: {
      rawMethod: 'claim_rewards',
    },
    getPendingRewards: {
      rawMethod: 'pending_rewards',
    },
  },
});

defaultAbiVersionRegistry.register({
  contractId: VAULT_ABI_CONTRACT_ID,
  version: 'v3',
  description: 'Current version: adds the protocol fee (feeBps) surfaced on get_vault_info and via get_fee_bps.',
  fingerprintMethods: ['get_fee_bps'],
  methods: {
    getVaultInfo: {
      rawMethod: 'get_vault_info',
      // Already the canonical (v3) shape — no upgrade needed.
    },
    getBalance: {
      rawMethod: 'balance_of',
    },
    deposit: {
      rawMethod: 'deposit',
      serializeArgs: (params) => [(params as { amount: bigint }).amount],
    },
    withdraw: {
      rawMethod: 'withdraw',
      serializeArgs: (params) => [(params as { amount: bigint }).amount],
    },
    claimRewards: {
      rawMethod: 'claim_rewards',
    },
    getPendingRewards: {
      rawMethod: 'pending_rewards',
    },
    getFeeBps: {
      rawMethod: 'get_fee_bps',
    },
  },
});
