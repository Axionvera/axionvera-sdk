import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AxionveraClient, FetchRpcTransport, type RpcTransport } from './client';
import { NetworkError } from './errors';
import type { TransactionResult } from './types';

function jsonRpcResult<T>(id: number, result: T) {
  return { jsonrpc: '2.0' as const, id, result };
}

function jsonRpcError(id: number, code: number, message: string) {
  return { jsonrpc: '2.0' as const, id, error: { code, message } };
}

function jsonRpcNoResult(id: number) {
  return { jsonrpc: '2.0' as const, id };
}

describe('FetchRpcTransport', () => {
  const RPC_URL = 'https://rpc.stellar.example';

  let fetchFn: ReturnType<typeof vi.fn>;
  let transport: FetchRpcTransport;

  beforeEach(() => {
    fetchFn = vi.fn();
    transport = new FetchRpcTransport(RPC_URL, fetchFn);
  });

  // ── Happy path ──────────────────────────────────────────────

  describe('successful RPC responses', () => {
    it('returns the result value on a successful call', async () => {
      fetchFn.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(jsonRpcResult(1, { status: 'healthy' }))
      });

      const result = await transport.call('getHealth');

      expect(result).toEqual({ status: 'healthy' });
    });

    it('returns typed results for generic calls', async () => {
      const txHash = 'abc123';
      fetchFn.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(jsonRpcResult(1, { hash: txHash, status: 'success' }))
      });

      const result = await transport.call<{ hash: string; status: string }>('getTransaction', {
        hash: txHash
      });

      expect(result.hash).toBe(txHash);
      expect(result.status).toBe('success');
    });
  });

  // ── Request payload validation ──────────────────────────────

  describe('request payload', () => {
    it('sends POST to the configured rpcUrl', async () => {
      fetchFn.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(jsonRpcResult(1, null))
      });

      await transport.call('testMethod');

      expect(fetchFn).toHaveBeenCalledTimes(1);
      expect(fetchFn).toHaveBeenCalledWith(
        RPC_URL,
        expect.objectContaining({ method: 'POST' })
      );
    });

    it('includes jsonrpc 2.0 in the payload', async () => {
      fetchFn.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(jsonRpcResult(1, null))
      });

      await transport.call('testMethod');

      const body = JSON.parse(fetchFn.mock.calls[0][1].body);
      expect(body.jsonrpc).toBe('2.0');
    });

    it('includes the method name in the payload', async () => {
      fetchFn.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(jsonRpcResult(1, null))
      });

      await transport.call('getHealth');

      const body = JSON.parse(fetchFn.mock.calls[0][1].body);
      expect(body.method).toBe('getHealth');
    });

    it('includes params in the payload when provided', async () => {
      fetchFn.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(jsonRpcResult(1, null))
      });

      const params = { hash: 'tx123' };
      await transport.call('getTransaction', params);

      const body = JSON.parse(fetchFn.mock.calls[0][1].body);
      expect(body.params).toEqual(params);
    });

    it('includes content-type application/json header', async () => {
      fetchFn.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(jsonRpcResult(1, null))
      });

      await transport.call('testMethod');

      const headers = fetchFn.mock.calls[0][1].headers;
      expect(headers['content-type']).toBe('application/json');
    });

    it('omits params key when no params are passed', async () => {
      fetchFn.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(jsonRpcResult(1, null))
      });

      await transport.call('getHealth');

      const body = JSON.parse(fetchFn.mock.calls[0][1].body);
      expect(body.params).toBeUndefined();
    });
  });

  // ── Request ID increments ───────────────────────────────────

  describe('request IDs', () => {
    it('starts at 1 for the first request', async () => {
      fetchFn.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(jsonRpcResult(1, null))
      });

      await transport.call('test');

      const body = JSON.parse(fetchFn.mock.calls[0][1].body);
      expect(body.id).toBe(1);
    });

    it('increments across consecutive calls', async () => {
      fetchFn.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(jsonRpcResult(1, null))
      });

      await transport.call('test');
      await transport.call('test');
      await transport.call('test');

      const ids = fetchFn.mock.calls.map((call: [string, { body: string }]) => {
        return JSON.parse(call[1].body).id;
      });

      expect(ids).toEqual([1, 2, 3]);
    });

    it('increments even across failed requests', async () => {
      fetchFn
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(jsonRpcResult(1, null))
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 500,
          json: () => Promise.resolve({})
        })
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          json: () => Promise.resolve(jsonRpcResult(3, null))
        });

      await transport.call('test');
      await expect(transport.call('test')).rejects.toThrow();
      await transport.call('test');

      const ids = fetchFn.mock.calls.map((call: [string, { body: string }]) => {
        return JSON.parse(call[1].body).id;
      });

      expect(ids).toEqual([1, 2, 3]);
    });
  });

  // ── HTTP errors ─────────────────────────────────────────────

  describe('HTTP errors', () => {
    it('throws NetworkError on HTTP 500', async () => {
      fetchFn.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({})
      });

      await expect(transport.call('test')).rejects.toThrow(NetworkError);
      await expect(transport.call('test')).rejects.toThrow('RPC request failed with HTTP 500');
    });

    it('throws NetworkError on HTTP 404', async () => {
      fetchFn.mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({})
      });

      await expect(transport.call('test')).rejects.toThrow(NetworkError);
      await expect(transport.call('test')).rejects.toThrow('RPC request failed with HTTP 404');
    });

    it('throws NetworkError on HTTP 400', async () => {
      fetchFn.mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({})
      });

      await expect(transport.call('test')).rejects.toThrow(NetworkError);
      await expect(transport.call('test')).rejects.toThrow('RPC request failed with HTTP 400');
    });

    it('throws NetworkError on HTTP 429 (rate limited)', async () => {
      fetchFn.mockResolvedValue({
        ok: false,
        status: 429,
        json: () => Promise.resolve({})
      });

      await expect(transport.call('test')).rejects.toThrow(NetworkError);
    });

    it('throws NetworkError with NETWORK_ERROR code', async () => {
      fetchFn.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({})
      });

      try {
        await transport.call('test');
        expect.unreachable('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(NetworkError);
        expect((err as NetworkError).code).toBe('NETWORK_ERROR');
      }
    });
  });

  // ── JSON-RPC errors ─────────────────────────────────────────

  describe('JSON-RPC errors', () => {
    it('throws NetworkError when response contains error field', async () => {
      fetchFn.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(jsonRpcError(1, -32601, 'Method not found'))
      });

      await expect(transport.call('nonExistentMethod')).rejects.toThrow(NetworkError);
      await expect(transport.call('nonExistentMethod')).rejects.toThrow('Method not found');
    });

    it('throws NetworkError with the full JSON-RPC error object as cause', async () => {
      const errorObj = { code: -32600, message: 'Invalid Request', data: { details: 'some extra info' } };
      fetchFn.mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve({
            jsonrpc: '2.0',
            id: 1,
            error: errorObj
          })
      });

      try {
        await transport.call('badMethod');
        expect.unreachable('should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(NetworkError);
        expect((err as NetworkError).cause).toEqual(errorObj);
      }
    });

    it('throws NetworkError for internal JSON-RPC error', async () => {
      fetchFn.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(jsonRpcError(1, -32603, 'Internal error'))
      });

      await expect(transport.call('test')).rejects.toThrow('Internal error');
    });
  });

  // ── Missing result ──────────────────────────────────────────

  describe('missing result', () => {
    it('throws NetworkError when result key is absent', async () => {
      fetchFn.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(jsonRpcNoResult(1))
      });

      await expect(transport.call('test')).rejects.toThrow(NetworkError);
      await expect(transport.call('test')).rejects.toThrow(
        'RPC response for test did not include a result'
      );
    });

    it('includes the method name in the missing result error', async () => {
      fetchFn.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(jsonRpcNoResult(1))
      });

      await expect(transport.call('getHealth')).rejects.toThrow('getHealth');
    });
  });

  // ── Edge cases ──────────────────────────────────────────────

  describe('edge cases', () => {
    it('handles null result values', async () => {
      fetchFn.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(jsonRpcResult(1, null))
      });

      const result = await transport.call('test');
      expect(result).toBeNull();
    });

    it('handles empty object result', async () => {
      fetchFn.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(jsonRpcResult(1, {}))
      });

      const result = await transport.call('test');
      expect(result).toEqual({});
    });

    it('handles string result values', async () => {
      fetchFn.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(jsonRpcResult(1, 'hello'))
      });

      const result = await transport.call('test');
      expect(result).toBe('hello');
    });

    it('handles fetch throwing a network error', async () => {
      fetchFn.mockRejectedValue(new TypeError('Failed to fetch'));

      await expect(transport.call('test')).rejects.toThrow('Failed to fetch');
    });

    it('handles JSON parse errors from malformed response', async () => {
      fetchFn.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.reject(new SyntaxError('Unexpected token'))
      });

      await expect(transport.call('test')).rejects.toThrow(SyntaxError);
    });

    it('works with the default fetch when no custom fetchFn is provided', async () => {
      const realTransport = new FetchRpcTransport(RPC_URL);
      // Verify it was constructed (we cannot call it without mocking global fetch in a unit test)
      expect(realTransport).toBeInstanceOf(FetchRpcTransport);
    });
  });
});

describe('AxionveraClient', () => {
  const TX_HASH = 'abc123';

  function createMockTransport() {
    const call = vi.fn();
    const transport: RpcTransport = {
      call: call as RpcTransport['call']
    };
    return { transport, call };
  }

  // ── Network config ──────────────────────────────────────────

  describe('getNetworkConfig', () => {
    it('returns the resolved testnet config by default', () => {
      const client = new AxionveraClient();

      expect(client.getNetworkConfig()).toEqual({
        network: 'testnet',
        rpcUrl: 'https://soroban-testnet.stellar.org',
        horizonUrl: 'https://horizon-testnet.stellar.org',
        networkPassphrase: 'Test SDF Network ; September 2015'
      });
    });

    it('returns the resolved config for a known network preset', () => {
      const client = new AxionveraClient({ network: 'mainnet' });

      const config = client.getNetworkConfig();

      expect(config.network).toBe('mainnet');
      expect(config.rpcUrl).toBe('https://soroban-rpc.mainnet.stellar.gateway.fm');
      expect(config.networkPassphrase).toBe('Public Global Stellar Network ; September 2015');
    });

    it('applies explicit overrides on top of the network preset', () => {
      const client = new AxionveraClient({
        network: 'testnet',
        rpcUrl: 'https://custom-rpc.example.com',
        networkPassphrase: 'Custom Passphrase ; 2026'
      });

      expect(client.getNetworkConfig()).toEqual({
        network: 'testnet',
        rpcUrl: 'https://custom-rpc.example.com',
        horizonUrl: 'https://horizon-testnet.stellar.org',
        networkPassphrase: 'Custom Passphrase ; 2026'
      });
    });
  });

  // ── Health ──────────────────────────────────────────────────

  describe('getHealth', () => {
    it('calls the transport with getHealth and returns the result', async () => {
      const { transport, call } = createMockTransport();
      call.mockResolvedValue({ status: 'healthy' });

      const client = new AxionveraClient({ transport });
      const result = await client.getHealth();

      expect(call).toHaveBeenCalledTimes(1);
      expect(call).toHaveBeenCalledWith('getHealth');
      expect(result).toEqual({ status: 'healthy' });
    });

    it('propagates transport errors', async () => {
      const { transport, call } = createMockTransport();
      const error = new NetworkError('RPC request failed with HTTP 500');
      call.mockRejectedValue(error);

      const client = new AxionveraClient({ transport });

      await expect(client.getHealth()).rejects.toBe(error);
    });
  });

  // ── Transaction lookup ──────────────────────────────────────

  describe('getTransaction', () => {
    it('calls the transport with getTransaction and the hash param', async () => {
      const { transport, call } = createMockTransport();
      const tx: TransactionResult = { hash: TX_HASH, status: 'success' };
      call.mockResolvedValue(tx);

      const client = new AxionveraClient({ transport });
      const result = await client.getTransaction(TX_HASH);

      expect(call).toHaveBeenCalledTimes(1);
      expect(call).toHaveBeenCalledWith('getTransaction', { hash: TX_HASH });
      expect(result).toEqual(tx);
    });

    it('passes the hash through to the transport verbatim', async () => {
      const { transport, call } = createMockTransport();
      call.mockResolvedValue({ hash: TX_HASH, status: 'not_found' });

      const client = new AxionveraClient({ transport });
      await client.getTransaction(TX_HASH);

      expect(call).toHaveBeenCalledWith('getTransaction', { hash: TX_HASH });
    });

    it('propagates transport errors', async () => {
      const { transport, call } = createMockTransport();
      const error = new NetworkError('RPC response for getTransaction did not include a result');
      call.mockRejectedValue(error);

      const client = new AxionveraClient({ transport });

      await expect(client.getTransaction(TX_HASH)).rejects.toBe(error);
    });
  });

  // ── Transport injection ─────────────────────────────────────

  describe('transport', () => {
    it('uses the injected transport instead of creating one', async () => {
      const { transport, call } = createMockTransport();
      call.mockResolvedValue({ status: 'healthy' });

      const client = new AxionveraClient({ transport });

      expect(client.transport).toBe(transport);

      await client.getHealth();
      expect(call).toHaveBeenCalledTimes(1);
    });

    it('defaults to a FetchRpcTransport when no transport is provided', () => {
      const client = new AxionveraClient();

      expect(client.transport).toBeInstanceOf(FetchRpcTransport);
    });
  });
});
