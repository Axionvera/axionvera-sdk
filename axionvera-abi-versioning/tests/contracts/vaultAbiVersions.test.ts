import '../../src/contracts/vaultAbiVersions';
import '../../src/contracts/contractMigrations';
import { defaultAbiVersionRegistry } from '../../src/registry/abiVersionRegistry';
import { AbiCompatAdapter, RawContractCaller } from '../../src/adapters/abiCompatAdapter';
import { UnsupportedContractMethodError } from '../../src/errors/axionveraError';
import { VAULT_ABI_CONTRACT_ID } from '../../src/contracts/vaultAbiVersions';
import type { AbiVersionProbe } from '../../src/types/abi';

const CONTRACT_ID = 'C'.repeat(56);

function probeFor(available: string[]): AbiVersionProbe {
  return { hasMethod: async (method: string) => available.includes(method) };
}

describe('Vault ABI version registrations (integration)', () => {
  it('registers v1, v2, and v3 in order against defaultAbiVersionRegistry', () => {
    expect(defaultAbiVersionRegistry.listVersions(VAULT_ABI_CONTRACT_ID)).toEqual([
      'v1',
      'v2',
      'v3',
    ]);
    expect(defaultAbiVersionRegistry.getLatestVersion(VAULT_ABI_CONTRACT_ID)).toBe('v3');
  });

  it('detects each version from a realistic method fingerprint', async () => {
    const v1 = await defaultAbiVersionRegistry.detectVersion(
      VAULT_ABI_CONTRACT_ID,
      probeFor(['get_vault_info', 'deposit_v1', 'withdraw_v1', 'balance_of'])
    );
    expect(v1.version).toBe('v1');

    const v2 = await defaultAbiVersionRegistry.detectVersion(
      VAULT_ABI_CONTRACT_ID,
      probeFor(['get_vault_info', 'deposit', 'withdraw', 'balance_of', 'claim_rewards', 'pending_rewards'])
    );
    expect(v2.version).toBe('v2');

    const v3 = await defaultAbiVersionRegistry.detectVersion(
      VAULT_ABI_CONTRACT_ID,
      probeFor([
        'get_vault_info',
        'deposit',
        'withdraw',
        'balance_of',
        'claim_rewards',
        'pending_rewards',
        'get_fee_bps',
      ])
    );
    expect(v3.version).toBe('v3');
  });

  describe('AbiCompatAdapter against a v1-deployed Vault', () => {
    function buildV1Adapter(rawInfo: { totalAssets: bigint; totalSupply: bigint }) {
      const raw: RawContractCaller = {
        read: jest.fn(async () => rawInfo),
        write: jest.fn(async () => 'tx_hash'),
      };
      const adapter = new AbiCompatAdapter({
        name: 'vault-abi-compat-test',
        contractId: VAULT_ABI_CONTRACT_ID,
        registry: defaultAbiVersionRegistry,
        raw,
        createProbe: () => probeFor(['get_vault_info', 'deposit_v1', 'withdraw_v1', 'balance_of']),
      });
      return { adapter, raw };
    }

    it('upgrades the v1 raw result to the canonical (v3) shape by replaying registered migrations', async () => {
      const { adapter, raw } = buildV1Adapter({ totalAssets: 1_000n, totalSupply: 900n });

      const info = await adapter.read<{
        totalAssets: bigint;
        totalSupply: bigint;
        apy: number;
        lockPeriod: number;
        feeBps: number;
      }>(CONTRACT_ID, 'getVaultInfo');

      expect(raw.read).toHaveBeenCalledWith(CONTRACT_ID, 'get_vault_info');
      expect(info).toEqual({
        totalAssets: 1_000n,
        totalSupply: 900n,
        apy: 0,
        lockPeriod: 0,
        feeBps: 0,
      });
    });

    it('serializes a canonical deposit call down to the v1 raw method and args', async () => {
      const { adapter, raw } = buildV1Adapter({ totalAssets: 0n, totalSupply: 0n });

      await adapter.write(CONTRACT_ID, 'deposit', { amount: 500n, referralCode: 'friend' });

      expect(raw.write).toHaveBeenCalledWith(CONTRACT_ID, 'deposit_v1', 500n);
    });

    it('rejects a v3-only method (getFeeBps) as unsupported at v1', async () => {
      const { adapter } = buildV1Adapter({ totalAssets: 0n, totalSupply: 0n });

      await expect(adapter.read(CONTRACT_ID, 'getFeeBps')).rejects.toThrow(
        UnsupportedContractMethodError
      );
    });
  });

  it('passes the v3 raw result through unchanged (already the canonical shape)', async () => {
    const rawInfo = { totalAssets: 10n, totalSupply: 10n, apy: 5, lockPeriod: 30, feeBps: 25 };
    const raw: RawContractCaller = {
      read: jest.fn(async () => rawInfo),
      write: jest.fn(async () => 'tx_hash'),
    };
    const adapter = new AbiCompatAdapter({
      name: 'vault-abi-compat-test-v3',
      contractId: VAULT_ABI_CONTRACT_ID,
      registry: defaultAbiVersionRegistry,
      raw,
      createProbe: () =>
        probeFor([
          'get_vault_info',
          'deposit',
          'withdraw',
          'balance_of',
          'claim_rewards',
          'pending_rewards',
          'get_fee_bps',
        ]),
    });

    const info = await adapter.read(CONTRACT_ID, 'getVaultInfo');
    expect(info).toEqual(rawInfo);
  });
});
