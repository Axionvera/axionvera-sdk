import { AbiVersionRegistry } from '../../src/registry/abiVersionRegistry';
import { UnsupportedAbiVersionError } from '../../src/errors/axionveraError';
import type { AbiVersionProbe } from '../../src/types/abi';

function makeProbe(available: string[], explicitVersion?: string): AbiVersionProbe {
  return {
    hasMethod: async (rawMethod: string) => available.includes(rawMethod),
    ...(explicitVersion !== undefined
      ? { readExplicitVersion: async () => explicitVersion }
      : {}),
  };
}

describe('AbiVersionRegistry', () => {
  let registry: AbiVersionRegistry;

  beforeEach(() => {
    registry = new AbiVersionRegistry();
  });

  describe('registration', () => {
    it('has no versions registered by default', () => {
      expect(registry.listVersions('Vault')).toEqual([]);
      expect(registry.get('Vault', 'v1')).toBeUndefined();
      expect(registry.getLatestVersion('Vault')).toBeUndefined();
    });

    it('registers a version and makes it discoverable', () => {
      registry.register({ contractId: 'Vault', version: 'v1', methods: {} });

      expect(registry.has('Vault', 'v1')).toBe(true);
      expect(registry.get('Vault', 'v1')?.version).toBe('v1');
    });

    it('keeps versions for different contracts independent', () => {
      registry.register({ contractId: 'Vault', version: 'v1', methods: {} });
      expect(registry.has('OtherContract', 'v1')).toBe(false);
    });

    it('tracks registration order and reports the latest as the most recently registered', () => {
      registry.register({ contractId: 'Vault', version: 'v1', methods: {} });
      registry.register({ contractId: 'Vault', version: 'v2', methods: {} });
      registry.register({ contractId: 'Vault', version: 'v3', methods: {} });

      expect(registry.listVersions('Vault')).toEqual(['v1', 'v2', 'v3']);
      expect(registry.getLatestVersion('Vault')).toBe('v3');
    });

    it('re-registering an existing version overwrites it without duplicating the order entry', () => {
      registry.register({ contractId: 'Vault', version: 'v1', description: 'first', methods: {} });
      registry.register({ contractId: 'Vault', version: 'v1', description: 'second', methods: {} });

      expect(registry.listVersions('Vault')).toEqual(['v1']);
      expect(registry.get('Vault', 'v1')?.description).toBe('second');
    });

    it('unregisters a version and removes it from the listing', () => {
      registry.register({ contractId: 'Vault', version: 'v1', methods: {} });
      registry.register({ contractId: 'Vault', version: 'v2', methods: {} });

      expect(registry.unregister('Vault', 'v1')).toBe(true);
      expect(registry.listVersions('Vault')).toEqual(['v2']);
      expect(registry.getLatestVersion('Vault')).toBe('v2');
    });

    it('unregister returns false for an unregistered version or contract', () => {
      expect(registry.unregister('Vault', 'v1')).toBe(false);
      registry.register({ contractId: 'Vault', version: 'v1', methods: {} });
      expect(registry.unregister('Vault', 'v99')).toBe(false);
    });
  });

  describe('require', () => {
    it('returns the descriptor when registered', () => {
      registry.register({ contractId: 'Vault', version: 'v1', methods: {} });
      expect(registry.require('Vault', 'v1').version).toBe('v1');
    });

    it('throws UnsupportedAbiVersionError with the registered versions listed', () => {
      registry.register({ contractId: 'Vault', version: 'v1', methods: {} });
      registry.register({ contractId: 'Vault', version: 'v2', methods: {} });

      expect(() => registry.require('Vault', 'v99')).toThrow(UnsupportedAbiVersionError);
      try {
        registry.require('Vault', 'v99');
        fail('expected require to throw');
      } catch (err) {
        expect(err).toBeInstanceOf(UnsupportedAbiVersionError);
        const typed = err as UnsupportedAbiVersionError;
        expect(typed.contractId).toBe('Vault');
        expect(typed.version).toBe('v99');
        expect(typed.availableVersions).toEqual(['v1', 'v2']);
      }
    });
  });

  describe('detectVersion', () => {
    beforeEach(() => {
      registry.register({
        contractId: 'Vault',
        version: 'v1',
        fingerprintMethods: ['get_vault_info'],
        methods: { getVaultInfo: { rawMethod: 'get_vault_info' } },
      });
      registry.register({
        contractId: 'Vault',
        version: 'v2',
        fingerprintMethods: ['claim_rewards'],
        methods: {
          getVaultInfo: { rawMethod: 'get_vault_info' },
          claimRewards: { rawMethod: 'claim_rewards' },
        },
      });
      registry.register({
        contractId: 'Vault',
        version: 'v3',
        fingerprintMethods: ['get_fee_bps'],
        methods: {
          getVaultInfo: { rawMethod: 'get_vault_info' },
          claimRewards: { rawMethod: 'claim_rewards' },
          getFeeBps: { rawMethod: 'get_fee_bps' },
        },
      });
    });

    it('trusts an explicit version tag when it is registered', async () => {
      const probe = makeProbe(['get_vault_info', 'claim_rewards', 'get_fee_bps'], 'v1');
      const result = await registry.detectVersion('Vault', probe);

      expect(result).toEqual({ version: 'v1', confidence: 'explicit', matchedMethods: [] });
    });

    it('falls back to fingerprinting when the explicit tag is not a registered version', async () => {
      const probe = makeProbe(['get_vault_info', 'claim_rewards'], 'v-unknown');
      const result = await registry.detectVersion('Vault', probe);

      expect(result.confidence).toBe('inferred');
      expect(result.version).toBe('v2');
    });

    it('infers the newest version whose fingerprint fully matches', async () => {
      const probe = makeProbe(['get_vault_info', 'claim_rewards', 'get_fee_bps']);
      const result = await registry.detectVersion('Vault', probe);

      expect(result.version).toBe('v3');
      expect(result.confidence).toBe('inferred');
      expect(result.matchedMethods).toEqual(['get_fee_bps']);
    });

    it('infers an older version when newer fingerprint methods are absent', async () => {
      const probe = makeProbe(['get_vault_info', 'claim_rewards']);
      const result = await registry.detectVersion('Vault', probe);

      expect(result.version).toBe('v2');
    });

    it('infers the oldest version when only its methods are present', async () => {
      const probe = makeProbe(['get_vault_info']);
      const result = await registry.detectVersion('Vault', probe);

      expect(result.version).toBe('v1');
    });

    it('returns unknown confidence when nothing matches', async () => {
      const probe = makeProbe([]);
      const result = await registry.detectVersion('Vault', probe);

      expect(result).toEqual({ version: undefined, confidence: 'unknown', matchedMethods: [] });
    });

    it('returns unknown confidence for a contract with no registered versions', async () => {
      const probe = makeProbe(['anything']);
      const result = await registry.detectVersion('OtherContract', probe);

      expect(result.confidence).toBe('unknown');
    });
  });
});
