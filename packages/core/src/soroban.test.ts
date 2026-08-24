import { describe, it, expect, vi } from 'vitest';
import { SorobanContractInvoker, type SorobanInvokerRequest } from './soroban';
import { AxionveraClient, type RpcTransport } from './client';
import { ContractError, NetworkError, ValidationError } from './errors';
import { VaultContract } from './contracts/vault';

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
});
