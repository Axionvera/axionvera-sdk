import { AbiCompatAdapter, RawContractCaller } from '../../src/adapters/abiCompatAdapter';
import { AbiVersionRegistry } from '../../src/registry/abiVersionRegistry';
import {
  AbiVersionDetectionError,
  UnsupportedContractMethodError,
} from '../../src/errors/axionveraError';
import type { AbiVersionProbe } from '../../src/types/abi';

const CONTRACT_ID = 'C'.repeat(56);

function buildRegistry(): AbiVersionRegistry {
  const registry = new AbiVersionRegistry();

  registry.register({
    contractId: 'Vault',
    version: 'v1',
    fingerprintMethods: ['get_vault_info_v1'],
    methods: {
      getVaultInfo: {
        rawMethod: 'get_vault_info_v1',
        deserializeResult: (raw) => ({ ...(raw as object), apy: 0, lockPeriod: 0 }),
      },
      deposit: {
        rawMethod: 'deposit_v1',
        serializeArgs: (params) => [(params as { amount: bigint }).amount],
      },
    },
  });

  registry.register({
    contractId: 'Vault',
    version: 'v2',
    fingerprintMethods: ['claim_rewards'],
    methods: {
      getVaultInfo: { rawMethod: 'get_vault_info' },
      deposit: {
        rawMethod: 'deposit',
        serializeArgs: (params) => [(params as { amount: bigint }).amount],
      },
      claimRewards: { rawMethod: 'claim_rewards' },
    },
  });

  return registry;
}

function buildRawCaller(overrides: Partial<RawContractCaller> = {}): RawContractCaller {
  return {
    read: jest.fn(async () => ({ totalAssets: 100n, totalSupply: 100n })),
    write: jest.fn(async () => 'tx_hash'),
    ...overrides,
  };
}

function probeFor(available: string[]): AbiVersionProbe {
  return { hasMethod: async (method: string) => available.includes(method) };
}

describe('AbiCompatAdapter', () => {
  it('detects the deployed version once and reuses it across calls', async () => {
    const registry = buildRegistry();
    const raw = buildRawCaller();
    const createProbe = jest.fn(() => probeFor(['claim_rewards', 'get_vault_info', 'deposit']));

    const adapter = new AbiCompatAdapter({
      name: 'vault-abi-compat',
      contractId: 'Vault',
      registry,
      raw,
      createProbe,
    });

    await adapter.read(CONTRACT_ID, 'getVaultInfo');
    await adapter.read(CONTRACT_ID, 'getVaultInfo');

    expect(createProbe).toHaveBeenCalledTimes(1);
    expect(raw.read).toHaveBeenCalledTimes(2);
    expect(raw.read).toHaveBeenCalledWith(CONTRACT_ID, 'get_vault_info');
  });

  it('translates a v1 raw result into the canonical shape via deserializeResult', async () => {
    const registry = buildRegistry();
    const raw = buildRawCaller({
      read: jest.fn(async () => ({ totalAssets: 50n, totalSupply: 50n })),
    });
    const createProbe = () => probeFor(['get_vault_info_v1']);

    const adapter = new AbiCompatAdapter({
      name: 'vault-abi-compat',
      contractId: 'Vault',
      registry,
      raw,
      createProbe,
    });

    const info = await adapter.read<{ totalAssets: bigint; apy: number; lockPeriod: number }>(
      CONTRACT_ID,
      'getVaultInfo'
    );

    expect(raw.read).toHaveBeenCalledWith(CONTRACT_ID, 'get_vault_info_v1');
    expect(info).toEqual({ totalAssets: 50n, totalSupply: 50n, apy: 0, lockPeriod: 0 });
  });

  it('serializes canonical write args down to the version-specific raw call', async () => {
    const registry = buildRegistry();
    const raw = buildRawCaller();
    const createProbe = () => probeFor(['get_vault_info_v1', 'deposit_v1']);

    const adapter = new AbiCompatAdapter({
      name: 'vault-abi-compat',
      contractId: 'Vault',
      registry,
      raw,
      createProbe,
    });

    await adapter.write(CONTRACT_ID, 'deposit', { amount: 1000n, referralCode: 'ABC' });

    expect(raw.write).toHaveBeenCalledWith(CONTRACT_ID, 'deposit_v1', 1000n);
  });

  it('throws UnsupportedContractMethodError for a method not present at the detected version', async () => {
    const registry = buildRegistry();
    const raw = buildRawCaller();
    // Only v1 fingerprint methods present -> resolves to v1, which has no claimRewards.
    const createProbe = () => probeFor(['get_vault_info_v1']);

    const adapter = new AbiCompatAdapter({
      name: 'vault-abi-compat',
      contractId: 'Vault',
      registry,
      raw,
      createProbe,
    });

    await expect(adapter.write(CONTRACT_ID, 'claimRewards')).rejects.toThrow(
      UnsupportedContractMethodError
    );
  });

  it('falls back to fallbackVersion when detection is inconclusive', async () => {
    const registry = buildRegistry();
    const raw = buildRawCaller();
    const createProbe = () => probeFor([]); // nothing matches any fingerprint

    const adapter = new AbiCompatAdapter({
      name: 'vault-abi-compat',
      contractId: 'Vault',
      registry,
      raw,
      createProbe,
      fallbackVersion: 'v2',
    });

    await adapter.read(CONTRACT_ID, 'getVaultInfo');
    expect(raw.read).toHaveBeenCalledWith(CONTRACT_ID, 'get_vault_info');
  });

  it('throws AbiVersionDetectionError when detection fails and there is no fallback', async () => {
    const registry = buildRegistry();
    const raw = buildRawCaller();
    const createProbe = () => probeFor([]);

    const adapter = new AbiCompatAdapter({
      name: 'vault-abi-compat',
      contractId: 'Vault',
      registry,
      raw,
      createProbe,
    });

    await expect(adapter.read(CONTRACT_ID, 'getVaultInfo')).rejects.toThrow(
      AbiVersionDetectionError
    );
  });

  it('invalidate() forces re-detection on the next call', async () => {
    const registry = buildRegistry();
    const raw = buildRawCaller();
    const createProbe = jest.fn(() => probeFor(['claim_rewards', 'get_vault_info', 'deposit']));

    const adapter = new AbiCompatAdapter({
      name: 'vault-abi-compat',
      contractId: 'Vault',
      registry,
      raw,
      createProbe,
    });

    await adapter.read(CONTRACT_ID, 'getVaultInfo');
    adapter.invalidate(CONTRACT_ID);
    await adapter.read(CONTRACT_ID, 'getVaultInfo');

    expect(createProbe).toHaveBeenCalledTimes(2);
  });

  it('supports() accepts well-formed Soroban contract addresses', async () => {
    const registry = buildRegistry();
    const adapter = new AbiCompatAdapter({
      name: 'vault-abi-compat',
      contractId: 'Vault',
      registry,
      raw: buildRawCaller(),
      createProbe: () => probeFor([]),
    });

    await expect(adapter.supports(CONTRACT_ID)).resolves.toBe(true);
    await expect(adapter.supports('not-a-contract-id')).resolves.toBe(false);
  });
});
