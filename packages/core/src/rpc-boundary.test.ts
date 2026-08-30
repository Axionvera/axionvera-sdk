import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AxionveraClient, FetchRpcTransport } from './client';
import { NetworkError } from './errors';

/**
 * RPC Boundary Tests
 * 
 * These tests verify the SDK's interaction with the Soroban RPC layer
 * without making real network calls. They ensure that method names,
 * payload shapes, and error mappings are correct for "live-mode" operations.
 */
describe('RPC Boundary Tests (Offline)', () => {
  const RPC_URL = 'https://rpc.stellar.example';
  const TX_XDR = 'AAAAAgAAAAD9...';
  const TX_HASH = 'd5a8d5a8d5a8d5a8d5a8d5a8d5a8d5a8d5a8d5a8d5a8d5a8d5a8d5a8d5a8d5a8';

  let fetchFn: ReturnType<typeof vi.fn>;
  let client: AxionveraClient;

  beforeEach(() => {
    fetchFn = vi.fn();
    const transport = new FetchRpcTransport(RPC_URL, fetchFn);
    client = new AxionveraClient({ transport });
  });

  describe('Method Names & Payload Shapes', () => {
    it('sends correct payload for getHealth', async () => {
      fetchFn.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ jsonrpc: '2.0', id: 1, result: { status: 'healthy' } })
      });

      await client.getHealth();

      const body = JSON.parse(fetchFn.mock.calls[0][1].body);
      expect(body.method).toBe('getHealth');
      expect(body.params).toBeUndefined();
    });

    it('sends correct payload for getTransaction', async () => {
      fetchFn.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ 
          jsonrpc: '2.0', 
          id: 1, 
          result: { hash: TX_HASH, status: 'success' } 
        })
      });

      await client.getTransaction(TX_HASH);

      const body = JSON.parse(fetchFn.mock.calls[0][1].body);
      expect(body.method).toBe('getTransaction');
      expect(body.params).toEqual({ hash: TX_HASH });
    });

    it('sends correct payload for sendTransaction (submission)', async () => {
      fetchFn.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ 
          jsonrpc: '2.0', 
          id: 1, 
          result: { hash: TX_HASH, status: 'pending' } 
        })
      });

      await client.sendTransaction(TX_XDR);

      const body = JSON.parse(fetchFn.mock.calls[0][1].body);
      expect(body.method).toBe('sendTransaction');
      expect(body.params).toEqual({ transaction: TX_XDR });
    });

    it('sends correct payload for simulateTransaction', async () => {
      fetchFn.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ 
          jsonrpc: '2.0', 
          id: 1, 
          result: { status: 'success', cost: { cpuInsns: '1000' } } 
        })
      });

      await client.simulateTransaction(TX_XDR);

      const body = JSON.parse(fetchFn.mock.calls[0][1].body);
      expect(body.method).toBe('simulateTransaction');
      expect(body.params).toEqual({ transaction: TX_XDR });
    });
  });

  describe('Error Mapping', () => {
    it('maps RPC error -32601 (Method not found) to NetworkError', async () => {
      fetchFn.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ 
          jsonrpc: '2.0', 
          id: 1, 
          error: { code: -32601, message: 'Method not found' } 
        })
      });

      await expect(client.getHealth()).rejects.toThrow(NetworkError);
      await expect(client.getHealth()).rejects.toThrow('Method not found');
    });

    it('maps RPC error -32600 (Invalid Request) to NetworkError with details', async () => {
      const errorObj = { code: -32600, message: 'Invalid Request', data: { details: 'bad params' } };
      fetchFn.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ 
          jsonrpc: '2.0', 
          id: 1, 
          error: errorObj 
        })
      });

      try {
        await client.sendTransaction('invalid-xdr');
      } catch (err) {
        expect(err).toBeInstanceOf(NetworkError);
        expect((err as NetworkError).cause).toEqual(errorObj);
      }
    });

    it('handles HTTP 429 Rate Limit error', async () => {
      fetchFn.mockResolvedValue({
        ok: false,
        status: 429,
        json: () => Promise.resolve({})
      });

      await expect(client.getHealth()).rejects.toThrow(NetworkError);
      await expect(client.getHealth()).rejects.toThrow('HTTP 429');
    });
  });

  describe('Transaction Hash Handling', () => {
    it('correctly handles transaction hash in lookup responses', async () => {
      const mockResult = {
        hash: TX_HASH,
        status: 'success',
        ledger: 100
      };

      fetchFn.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ jsonrpc: '2.0', id: 1, result: mockResult })
      });

      const result = await client.getTransaction(TX_HASH);
      expect(result.hash).toBe(TX_HASH);
      expect(result.status).toBe('success');
      expect(result.ledger).toBe(100);
    });
  });
});
