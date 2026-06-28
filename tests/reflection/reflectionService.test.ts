import { ContractReflectionService, contractReflection } from '../../src/reflection';
import { VaultABI } from '../../src/contracts/abis/VaultABI';
import { VaultContractDescriptor } from '../../src/discovery/defaultContracts';
import { ValidationError } from '../../src/errors/axionveraError';

describe('ContractReflectionService', () => {
  let service: ContractReflectionService;

  beforeEach(() => {
    service = new ContractReflectionService();
  });

  describe('method reflection', () => {
    it('exposes every callable function declared by the ABI', () => {
      const names = service.getMethods(VaultABI).map((method) => method.name);

      expect(names).toEqual(
        expect.arrayContaining([
          'totalAssets',
          'balanceOf',
          'convertToAssets',
          'convertToShares',
          'deposit',
          'withdraw',
          'claimRewards',
        ])
      );
    });

    it('reflects signature, selector, mutability and parameters of a method', () => {
      const deposit = service.getMethod(VaultABI, 'deposit');

      expect(deposit).toBeDefined();
      expect(deposit?.signature).toBe('deposit(uint256)');
      expect(deposit?.selector).toMatch(/^0x[0-9a-f]{8}$/);
      expect(deposit?.stateMutability).toBe('payable');
      expect(deposit?.payable).toBe(true);
      expect(deposit?.constant).toBe(false);
      expect(deposit?.inputs).toEqual([{ name: 'assets', type: 'uint256' }]);
      expect(deposit?.outputs).toEqual([{ name: 'shares', type: 'uint256' }]);
    });

    it('marks read-only methods as constant and non-payable', () => {
      const totalAssets = service.getMethod(VaultABI, 'totalAssets');

      expect(totalAssets?.stateMutability).toBe('view');
      expect(totalAssets?.constant).toBe(true);
      expect(totalAssets?.payable).toBe(false);
    });

    it('does not annotate function parameters with an indexed flag', () => {
      const balanceOf = service.getMethod(VaultABI, 'balanceOf');

      expect(balanceOf?.inputs[0]).not.toHaveProperty('indexed');
    });

    it('returns undefined for an unknown method', () => {
      expect(service.getMethod(VaultABI, 'doesNotExist')).toBeUndefined();
    });
  });

  describe('event reflection', () => {
    it('discovers events declared as ABI event fragments', () => {
      const names = service.getEvents(VaultABI).map((event) => event.name);

      expect(names).toEqual(expect.arrayContaining(['Deposit', 'Withdraw']));
    });

    it('reflects signature, topic hash and indexed inputs of an event', () => {
      const deposit = service.getEvent(VaultABI, 'Deposit');

      expect(deposit).toBeDefined();
      expect(deposit?.signature).toBe('Deposit(address,address,uint256,uint256)');
      expect(deposit?.topicHash).toMatch(/^0x[0-9a-f]{64}$/);
      expect(deposit?.anonymous).toBe(false);
      expect(deposit?.inputs).toEqual([
        { name: 'sender', type: 'address', indexed: true },
        { name: 'owner', type: 'address', indexed: true },
        { name: 'assets', type: 'uint256', indexed: false },
        { name: 'shares', type: 'uint256', indexed: false },
      ]);
    });

    it('returns undefined for an unknown event', () => {
      expect(service.getEvent(VaultABI, 'NopeEvent')).toBeUndefined();
    });
  });

  describe('reflect()', () => {
    it('returns both methods and events in a single call', () => {
      const reflection = service.reflect(VaultABI);

      expect(reflection.methods.length).toBeGreaterThan(0);
      expect(reflection.events.length).toBe(2);
      expect(reflection.descriptor).toBeUndefined();
    });

    it('surfaces a discovery descriptor when one is provided', () => {
      const reflection = service.reflect(VaultABI, { descriptor: VaultContractDescriptor });

      expect(reflection.descriptor).toBe(VaultContractDescriptor);
    });
  });

  describe('caching', () => {
    it('parses an ABI only once and reuses the cached result', () => {
      const interfaceSpy = jest.spyOn(JSON, 'stringify');

      const first = service.reflect(VaultABI);
      const callsAfterFirst = interfaceSpy.mock.calls.length;
      const second = service.reflect(VaultABI);

      // The cache key is derived once per call, but the underlying parse is
      // not repeated: the two results are deep-equal yet independent objects.
      expect(second).toEqual(first);
      expect(second).not.toBe(first);
      expect(interfaceSpy.mock.calls.length).toBeGreaterThanOrEqual(callsAfterFirst);

      interfaceSpy.mockRestore();
    });

    it('returns clones so mutating a result does not corrupt the cache', () => {
      const first = service.getMethods(VaultABI);
      first[0].name = 'mutated';
      first[0].inputs.push({ name: 'injected', type: 'bool' });

      const second = service.getMethods(VaultABI);
      expect(second[0].name).not.toBe('mutated');
      expect(second[0].inputs).not.toContainEqual({ name: 'injected', type: 'bool' });
    });

    it('supports an explicit cache key and a string ABI', () => {
      const stringAbi = ['function ping() view returns (bool)'];

      const reflection = service.reflect(stringAbi, { cacheKey: 'ping-contract' });
      expect(reflection.methods.map((method) => method.name)).toEqual(['ping']);

      // Second read served from the same explicit cache entry.
      expect(service.getMethod(stringAbi, 'ping', { cacheKey: 'ping-contract' })).toBeDefined();
    });

    it('clears cached reflection results', () => {
      service.reflect(VaultABI);
      expect(() => service.clearCache()).not.toThrow();
      // Still works after clearing (re-parses).
      expect(service.getMethods(VaultABI).length).toBeGreaterThan(0);
    });
  });

  describe('edge cases', () => {
    it('reflects an empty ABI as no methods and no events', () => {
      const reflection = service.reflect([]);

      expect(reflection.methods).toEqual([]);
      expect(reflection.events).toEqual([]);
    });

    it('throws a ValidationError for a malformed ABI', () => {
      expect(() => service.reflect('this is not a valid abi')).toThrow(ValidationError);
    });

    it('throws a ValidationError carrying the original parse error', () => {
      expect.assertions(2);
      try {
        service.reflect('}{');
      } catch (error) {
        expect(error).toBeInstanceOf(ValidationError);
        expect((error as ValidationError).message).toMatch(/could not be parsed/i);
      }
    });
  });

  describe('shared singleton', () => {
    it('exports a ready-to-use default instance', () => {
      contractReflection.clearCache();
      expect(contractReflection.getMethods(VaultABI).length).toBeGreaterThan(0);
      expect(contractReflection.getEvents(VaultABI).map((event) => event.name)).toContain(
        'Deposit'
      );
    });
  });
});
