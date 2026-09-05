import { describe, it, expect, vi } from 'vitest';
import {
  SorobanContractInvoker,
  type SorobanInvokerRequest,
  buildSorobanInvokeRequest,
  type SorobanInvokeRequestInput
} from './soroban';
import { AxionveraClient, type RpcTransport } from './client';
import { ContractError, NetworkError, ValidationError } from './errors';
import { VaultContract } from './contracts/vault';

// For testing with mocked simulation, see ./testing/mockSimulationAdapter.ts

function makeRequest(overrides: Partial<SorobanInvokerRequest> = {}): SorobanInvokerRequest {
  return {
    contractId: 'CABCDEF0000000000000000000000000000000000000000000000000000000001',
    method: 'get_info',
    args: [],
    ...overrides
  };
}

function createMockTransport() {
  const call = vi.fn();
  const transport: RpcTransport = { call: call as RpcTransport['call'] };
  return { transport, call };
}

const TESTNET_CONFIG = {
  network: 'testnet' as const,
  rpcUrl: 'https://soroban-testnet.stellar.org',
  horizonUrl: 'https://horizon-testnet.stellar.org',
  networkPassphrase: 'Test SDF Network ; September 2015'
};

describe('SorobanContractInvoker', () => {
  // ── Construction ────────────────────────────────────────────

  describe('constructor', () => {
    it('throws ValidationError when neither client nor transport is provided', () => {
      expect(() => new SorobanContractInvoker({})).toThrow(ValidationError);
    });

    it('uses the client transport and network config when a client is given', () => {
      const { transport } = createMockTransport();
      const client = new AxionveraClient({ transport });

      const invoker = new SorobanContractInvoker({ client });

      expect(invoker.getNetworkConfig()).toEqual(client.getNetworkConfig());
    });

    it('uses the provided transport when only a transport is given', () => {
      const { transport } = createMockTransport();

      const invoker = new SorobanContractInvoker({ transport });

      expect(invoker.getNetworkConfig()).toBeUndefined();
    });

    it('prefers an explicit networkConfig over the client network config', () => {
      const { transport } = createMockTransport();
      const client = new AxionveraClient({ transport });

      const invoker = new SorobanContractInvoker({ client, networkConfig: TESTNET_CONFIG });

      expect(invoker.getNetworkConfig()).toEqual(TESTNET_CONFIG);
    });

    it('uses the explicit networkConfig when only a transport is given', () => {
      const { transport } = createMockTransport();

      const invoker = new SorobanContractInvoker({ transport, networkConfig: TESTNET_CONFIG });

      expect(invoker.getNetworkConfig()).toEqual(TESTNET_CONFIG);
    });
  });

  // ── read() happy path ───────────────────────────────────────

  describe('read', () => {
    it('routes read requests to the simulateTransaction RPC method', async () => {
      const { transport, call } = createMockTransport();
      call.mockResolvedValue({ totalDeposits: 100n });

      const invoker = new SorobanContractInvoker({ transport });
      const request = makeRequest();

      const result = await invoker.read<{ totalDeposits: bigint }>(request);

      expect(call).toHaveBeenCalledTimes(1);
      expect(call).toHaveBeenCalledWith('simulateTransaction', request);
      expect(result).toEqual({ totalDeposits: 100n });
    });

    it('preserves contractId, method, and args on read', async () => {
      const { transport, call } = createMockTransport();
      call.mockResolvedValue('ok');

      const invoker = new SorobanContractInvoker({ transport });
      const request = makeRequest({ method: 'get_balance', args: ['GLEARNER'] });

      await invoker.read(request);

      const sent = call.mock.calls[0][1] as SorobanInvokerRequest;
      expect(sent.contractId).toBe(request.contractId);
      expect(sent.method).toBe('get_balance');
      expect(sent.args).toEqual(['GLEARNER']);
    });

    it('routes read through the client transport when built from a client', async () => {
      const { transport, call } = createMockTransport();
      call.mockResolvedValue({ status: 'success' });
      const client = new AxionveraClient({ transport });

      const invoker = new SorobanContractInvoker({ client });
      await invoker.read(makeRequest());

      expect(call).toHaveBeenCalledWith('simulateTransaction', expect.anything());
    });
  });

  // ── invoke() happy path ─────────────────────────────────────

  describe('invoke', () => {
    it('routes invoke requests to the sendTransaction RPC method', async () => {
      const { transport, call } = createMockTransport();
      call.mockResolvedValue({ hash: 'tx123', status: 'success' });

      const invoker = new SorobanContractInvoker({ transport });
      const request = makeRequest({ method: 'deposit', args: ['GUSER', '100'] });

      const result = await invoker.invoke<{ hash: string; status: string }>(request);

      expect(call).toHaveBeenCalledTimes(1);
      expect(call).toHaveBeenCalledWith('sendTransaction', request);
      expect(result).toEqual({ hash: 'tx123', status: 'success' });
    });

    it('preserves contractId, method, and args on invoke', async () => {
      const { transport, call } = createMockTransport();
      call.mockResolvedValue(null);

      const invoker = new SorobanContractInvoker({ transport });
      const request = makeRequest({ method: 'withdraw', args: ['GUSER', '50'] });

      await invoker.invoke(request);

      const sent = call.mock.calls[0][1] as SorobanInvokerRequest;
      expect(sent.contractId).toBe(request.contractId);
      expect(sent.method).toBe('withdraw');
      expect(sent.args).toEqual(['GUSER', '50']);
    });
  });

  // ── Invalid input ───────────────────────────────────────────

  describe('input validation', () => {
    it('throws ValidationError when the read request is missing', async () => {
      const { transport } = createMockTransport();
      const invoker = new SorobanContractInvoker({ transport });

      await expect(invoker.read(undefined as unknown as SorobanInvokerRequest)).rejects.toThrow(
        ValidationError
      );
    });

    it('throws ValidationError on an empty contractId for read', async () => {
      const { transport } = createMockTransport();
      const invoker = new SorobanContractInvoker({ transport });

      await expect(invoker.read(makeRequest({ contractId: '   ' }))).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError on an empty method for read', async () => {
      const { transport } = createMockTransport();
      const invoker = new SorobanContractInvoker({ transport });

      await expect(invoker.read(makeRequest({ method: '' }))).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError when args is not an array for read', async () => {
      const { transport } = createMockTransport();
      const invoker = new SorobanContractInvoker({ transport });

      const bad = { contractId: 'C1', method: 'get_info', args: 'not-an-array' };
      await expect(invoker.read(bad as unknown as SorobanInvokerRequest)).rejects.toThrow(
        ValidationError
      );
    });

    it('throws ValidationError on an empty contractId for invoke', async () => {
      const { transport } = createMockTransport();
      const invoker = new SorobanContractInvoker({ transport });

      await expect(invoker.invoke(makeRequest({ contractId: '' }))).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError on an empty method for invoke', async () => {
      const { transport } = createMockTransport();
      const invoker = new SorobanContractInvoker({ transport });

      await expect(invoker.invoke(makeRequest({ method: '   ' }))).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError when args is missing for invoke', async () => {
      const { transport } = createMockTransport();
      const invoker = new SorobanContractInvoker({ transport });

      const bad = { contractId: 'C1', method: 'deposit' };
      await expect(invoker.invoke(bad as unknown as SorobanInvokerRequest)).rejects.toThrow(
        ValidationError
      );
    });
  });

  // ── Error mapping ───────────────────────────────────────────

  describe('error handling', () => {
    it('propagates a NetworkError thrown by the transport', async () => {
      const { transport, call } = createMockTransport();
      const error = new NetworkError('RPC request failed with HTTP 500');
      call.mockRejectedValue(error);

      const invoker = new SorobanContractInvoker({ transport });

      await expect(invoker.invoke(makeRequest())).rejects.toBe(error);
    });

    it('surfaces contract-level failures as ContractError', async () => {
      const { transport, call } = createMockTransport();
      call.mockRejectedValue(new Error('contract invocation trapped: host error'));

      const invoker = new SorobanContractInvoker({ transport });

      await expect(invoker.read(makeRequest())).rejects.toThrow(ContractError);
    });

    it('surfaces generic transport failures as NetworkError', async () => {
      const { transport, call } = createMockTransport();
      call.mockRejectedValue(new Error('socket hang up'));

      const invoker = new SorobanContractInvoker({ transport });

      await expect(invoker.invoke(makeRequest())).rejects.toThrow(NetworkError);
    });

    it('preserves the original cause on mapped errors', async () => {
      const { transport, call } = createMockTransport();
      const cause = new Error('contract WASM trap');
      call.mockRejectedValue(cause);

      const invoker = new SorobanContractInvoker({ transport });

      try {
        await invoker.invoke(makeRequest());
        expect.unreachable('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(ContractError);
        expect((err as ContractError).cause).toBe(cause);
      }
    });
  });

  // ── VaultContract wiring ────────────────────────────────────

  describe('VaultContract wiring', () => {
    it('routes VaultContract reads through simulateTransaction', async () => {
      const { transport, call } = createMockTransport();
      call.mockResolvedValue({ contractId: 'CVAULT' });
      const client = new AxionveraClient({ transport });
      const invoker = new SorobanContractInvoker({ client });

      const vault = new VaultContract({ contractId: 'CVAULT', invoker });
      await vault.getInfo();

      expect(call).toHaveBeenCalledWith(
        'simulateTransaction',
        expect.objectContaining({ contractId: 'CVAULT', method: 'get_info' })
      );
    });

    it('routes VaultContract writes through sendTransaction', async () => {
      const { transport, call } = createMockTransport();
      call.mockResolvedValue({ status: 'success' });
      const client = new AxionveraClient({ transport });
      const invoker = new SorobanContractInvoker({ client });

      const vault = new VaultContract({ contractId: 'CVAULT', invoker });
      await vault.deposit('GUSER', 100);

      expect(call).toHaveBeenCalledWith(
        'sendTransaction',
        expect.objectContaining({ contractId: 'CVAULT', method: 'deposit' })
      );
    });
  });

  // ── buildSorobanInvokeRequest ───────────────────────────────────

  describe('buildSorobanInvokeRequest', () => {
    const validInput: SorobanInvokeRequestInput = {
      contractId: 'CABCDEF0000000000000000000000000000000000000000000000000000000001',
      method: 'deposit',
      args: ['GUSER', 100],
      sourceAccount: 'GSOURCE'
    };

    describe('happy path', () => {
      it('builds a valid request with all fields', () => {
        const result = buildSorobanInvokeRequest(validInput);

        expect(result.contractId).toBe(validInput.contractId);
        expect(result.method).toBe(validInput.method);
        expect(result.args).toEqual(validInput.args);
        expect(result.sourceAccount).toBe(validInput.sourceAccount);
      });

      it('builds a valid request without args', () => {
        const input = { contractId: 'C1', method: 'get_info' };
        const result = buildSorobanInvokeRequest(input);

        expect(result.contractId).toBe('C1');
        expect(result.method).toBe('get_info');
        expect(result.args).toEqual([]);
        expect(result.sourceAccount).toBeUndefined();
      });

      it('builds a valid request without sourceAccount', () => {
        const input = { contractId: 'C1', method: 'deposit', args: ['user'] };
        const result = buildSorobanInvokeRequest(input);

        expect(result.contractId).toBe('C1');
        expect(result.method).toBe('deposit');
        expect(result.args).toEqual(['user']);
        expect(result.sourceAccount).toBeUndefined();
      });

      it('trims whitespace from contractId and method', () => {
        const input = { contractId: '  C1  ', method: '  get_info  ' };
        const result = buildSorobanInvokeRequest(input);

        expect(result.contractId).toBe('C1');
        expect(result.method).toBe('get_info');
      });

      it('preserves argument order', () => {
        const input = { contractId: 'C1', method: 'transfer', args: ['from', 'to', 100, 'memo'] };
        const result = buildSorobanInvokeRequest(input);

        expect(result.args).toEqual(['from', 'to', 100, 'memo']);
      });
    });

    describe('contractId validation', () => {
      it('throws ValidationError when contractId is empty string', () => {
        const input = { contractId: '', method: 'get_info' };

        expect(() => buildSorobanInvokeRequest(input)).toThrow(ValidationError);
        expect(() => buildSorobanInvokeRequest(input)).toThrow('contractId must be a non-empty string');
      });

      it('throws ValidationError when contractId is only whitespace', () => {
        const input = { contractId: '   ', method: 'get_info' };

        expect(() => buildSorobanInvokeRequest(input)).toThrow(ValidationError);
      });

      it('throws ValidationError when contractId is not a string', () => {
        const input = { contractId: 123 as any, method: 'get_info' };

        expect(() => buildSorobanInvokeRequest(input)).toThrow(ValidationError);
      });
    });

    describe('method validation', () => {
      it('throws ValidationError when method is empty string', () => {
        const input = { contractId: 'C1', method: '' };

        expect(() => buildSorobanInvokeRequest(input)).toThrow(ValidationError);
        expect(() => buildSorobanInvokeRequest(input)).toThrow('method must be a non-empty string');
      });

      it('throws ValidationError when method is only whitespace', () => {
        const input = { contractId: 'C1', method: '   ' };

        expect(() => buildSorobanInvokeRequest(input)).toThrow(ValidationError);
      });

      it('throws ValidationError when method is not a string', () => {
        const input = { contractId: 'C1', method: null as any };

        expect(() => buildSorobanInvokeRequest(input)).toThrow(ValidationError);
      });
    });

    describe('args validation', () => {
      it('throws ValidationError when args is not an array', () => {
        const input = { contractId: 'C1', method: 'deposit', args: 'not-an-array' as any };

        expect(() => buildSorobanInvokeRequest(input)).toThrow(ValidationError);
        expect(() => buildSorobanInvokeRequest(input)).toThrow('args must be an array when provided');
      });

      it('accepts empty array for args', () => {
        const input = { contractId: 'C1', method: 'get_info', args: [] };
        const result = buildSorobanInvokeRequest(input);

        expect(result.args).toEqual([]);
      });

      it('accepts array with mixed types', () => {
        const input = { contractId: 'C1', method: 'complex', args: ['string', 123, true, null] };
        const result = buildSorobanInvokeRequest(input);

        expect(result.args).toEqual(['string', 123, true, null]);
      });
    });

    describe('sourceAccount validation', () => {
      it('throws ValidationError when sourceAccount is not a string', () => {
        const input = { contractId: 'C1', method: 'deposit', sourceAccount: 123 as any };

        expect(() => buildSorobanInvokeRequest(input)).toThrow(ValidationError);
        expect(() => buildSorobanInvokeRequest(input)).toThrow('sourceAccount must be a string when provided');
      });

      it('accepts valid string sourceAccount', () => {
        const input = { contractId: 'C1', method: 'deposit', sourceAccount: 'GACCOUNT' };
        const result = buildSorobanInvokeRequest(input);

        expect(result.sourceAccount).toBe('GACCOUNT');
      });

      it('does not include sourceAccount when not provided', () => {
        const input = { contractId: 'C1', method: 'deposit' };
        const result = buildSorobanInvokeRequest(input);

        expect('sourceAccount' in result).toBe(false);
      });
    });
  });

  // ── Mock Simulation Adapter Integration ────────────────────────

  describe('Mock Simulation Adapter Integration', () => {
    it('integrates mock simulation adapter with SorobanInvokeRequest', async () => {
      const { MockSimulationAdapter } = await import('./testing');
      
      const adapter = new MockSimulationAdapter({
        responses: [
          {
            method: 'deposit',
            response: {
              status: 'success' as const,
              hash: 'simulated-deposit-hash',
              result: { amount: '100' },
              fee: 100n
            }
          }
        ]
      });

      const request: SorobanInvokeRequest = {
        contractId: 'C123...',
        method: 'deposit',
        args: ['GUSER', '100']
      };

      const result = await adapter.simulate(request);

      expect(result.status).toBe('success');
      expect(result.hash).toBe('simulated-deposit-hash');
      expect(result.result).toEqual({ amount: '100' });
    });

    it('validates SorobanInvokeRequest before simulation', async () => {
      const { MockSimulationAdapter } = await import('./testing');
      
      const adapter = new MockSimulationAdapter({
        defaultResponse: { status: 'success' as const, hash: 'hash' }
      });

      const validRequest = buildSorobanInvokeRequest({
        contractId: 'C123...',
        method: 'deposit',
        args: ['GUSER', '100']
      });

      const result = await adapter.simulate(validRequest);
      expect(result.status).toBe('success');
    });

    it('handles simulation failures with proper error types', async () => {
      const { MockSimulationAdapter } = await import('./testing');
      
      const adapter = new MockSimulationAdapter({
        responses: [
          {
            method: 'withdraw',
            response: {
              status: 'failure' as const,
              error: { message: 'Insufficient balance', code: 1 }
            }
          }
        ]
      });

      const request: SorobanInvokeRequest = {
        contractId: 'C123...',
        method: 'withdraw',
        args: ['GUSER', '1000']
      };

      const result = await adapter.simulate(request);

      expect(result.status).toBe('failure');
      expect(result.error?.message).toBe('Insufficient balance');
    });
  });
});
