import { rpc } from '@stellar/stellar-sdk';
import {
  ExportedState,
  HYDRATION_STATE_VERSION,
  StellarClient,
} from '../src/client/stellarClient';

jest.mock('@stellar/stellar-sdk');
const mockedRpc = rpc as jest.Mocked<typeof rpc>;

interface MockServer {
  getHealth: jest.Mock;
  getNetwork: jest.Mock;
  getLatestLedger: jest.Mock;
  getAccount: jest.Mock;
  getTransaction: jest.Mock;
  simulateTransaction: jest.Mock;
  prepareTransaction: jest.Mock;
  sendTransaction: jest.Mock;
}

function buildMockServer(): MockServer {
  return {
    getHealth: jest.fn(),
    getNetwork: jest.fn(),
    getLatestLedger: jest.fn(),
    getAccount: jest.fn(),
    getTransaction: jest.fn(),
    simulateTransaction: jest.fn(),
    prepareTransaction: jest.fn(),
    sendTransaction: jest.fn(),
  };
}

function buildClient(server: MockServer): StellarClient {
  mockedRpc.Server = jest.fn().mockImplementation(() => server) as never;
  return new StellarClient({ network: 'testnet' });
}

describe('StellarClient state hydration/dehydration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('trackTransaction()', () => {
    it('registers a polling transaction and resolves on terminal status', async () => {
      const server = buildMockServer();
      server.getTransaction
        .mockResolvedValueOnce({ status: 'NOT_FOUND' })
        .mockResolvedValueOnce({ status: 'SUCCESS' });

      const client = buildClient(server);

      const tracked = client.trackTransaction({
        hash: 'abc123',
        intervalMs: 5,
        timeoutMs: 1_000,
      });

      // While pending the tx is in the registry.
      expect(client.getPendingTransactions().map((t) => t.hash)).toEqual(['abc123']);

      const result = await tracked.promise;
      expect((result as { status: string }).status).toBe('SUCCESS');

      // After resolution the registry empties.
      expect(client.getPendingTransactions()).toHaveLength(0);
    });

    it('returns the existing entry for a duplicate hash', () => {
      const server = buildMockServer();
      server.getTransaction.mockResolvedValue({ status: 'NOT_FOUND' });

      const client = buildClient(server);
      const a = client.trackTransaction({ hash: 'dup', intervalMs: 5, timeoutMs: 50 });
      const b = client.trackTransaction({ hash: 'dup', intervalMs: 5, timeoutMs: 50 });
      expect(b).toBe(a);

      a.cancel();
    });

    it('cancel() stops the poll and clears the entry from the registry', async () => {
      const server = buildMockServer();
      server.getTransaction.mockResolvedValue({ status: 'NOT_FOUND' });

      const client = buildClient(server);
      const tracked = client.trackTransaction({
        hash: 'cancelme',
        intervalMs: 5,
        timeoutMs: 5_000,
      });

      tracked.cancel();
      await expect(tracked.promise).rejects.toThrow(/cancelled/i);
      expect(client.getPendingTransactions()).toHaveLength(0);
    });
  });

  describe('exportState()', () => {
    it('returns an empty pending list when no transactions are tracked', () => {
      const server = buildMockServer();
      const client = buildClient(server);

      const state = client.exportState();
      expect(state.version).toBe(HYDRATION_STATE_VERSION);
      expect(state.pending).toEqual([]);
      expect(typeof state.exportedAt).toBe('string');
    });

    it('captures pending transactions with their simulation context', () => {
      const server = buildMockServer();
      server.getTransaction.mockResolvedValue({ status: 'NOT_FOUND' });
      const client = buildClient(server);

      const tracked = client.trackTransaction({
        hash: 'vault-deposit-1',
        intervalMs: 5,
        timeoutMs: 5_000,
        label: 'Vault deposit',
        simulationContext: {
          source: 'GABCDE',
          amount: '100',
          contract: 'CCONTRACT',
          nested: { quote: { fee: 100, slippage: 0.5 } },
        },
      });

      const state = client.exportState();
      expect(state.pending).toHaveLength(1);
      expect(state.pending[0].hash).toBe('vault-deposit-1');
      expect(state.pending[0].label).toBe('Vault deposit');
      expect(state.pending[0].simulationContext?.source).toBe('GABCDE');
      expect(state.pending[0].simulationContext?.nested).toEqual({
        quote: { fee: 100, slippage: 0.5 },
      });
      expect(typeof state.pending[0].submittedAt).toBe('string');
      expect(typeof state.pending[0].deadline).toBe('string');

      tracked.cancel();
    });

    it('encodes nested Date instances as { __date: ISO } markers', () => {
      const server = buildMockServer();
      server.getTransaction.mockResolvedValue({ status: 'NOT_FOUND' });
      const client = buildClient(server);

      const submittedAt = new Date('2026-04-26T10:00:00.000Z');
      const tracked = client.trackTransaction({
        hash: 'with-dates',
        intervalMs: 5,
        timeoutMs: 5_000,
        simulationContext: {
          quote: { fetchedAt: submittedAt, prices: [1, 2, 3] },
        },
      });

      const state = client.exportState();
      const encoded = state.pending[0].simulationContext as {
        quote: { fetchedAt: { __date: string }; prices: number[] };
      };
      expect(encoded.quote.fetchedAt).toEqual({
        __date: '2026-04-26T10:00:00.000Z',
      });
      expect(encoded.quote.prices).toEqual([1, 2, 3]);

      tracked.cancel();
    });
  });

  describe('importState()', () => {
    it('round-trips through JSON.stringify/parse and restarts polling', async () => {
      const server = buildMockServer();
      server.getTransaction.mockResolvedValue({ status: 'NOT_FOUND' });
      const original = buildClient(server);

      const fetchedAt = new Date('2026-04-26T10:00:00.000Z');
      const tracked = original.trackTransaction({
        hash: 'survive-refresh',
        intervalMs: 5,
        timeoutMs: 60_000,
        label: 'Vault deposit',
        simulationContext: { quote: { fetchedAt, fee: 7 } },
      });

      const json = JSON.stringify(original.exportState());
      tracked.cancel();
      await tracked.promise.catch(() => undefined);

      // Simulate a fresh page-load: brand-new client.
      const server2 = buildMockServer();
      server2.getTransaction.mockResolvedValue({ status: 'NOT_FOUND' });
      const reborn = buildClient(server2);

      const restored = reborn.importState(json);

      expect(restored).toHaveLength(1);
      expect(restored[0].hash).toBe('survive-refresh');
      expect(restored[0].label).toBe('Vault deposit');
      expect(restored[0].submittedAt).toBeInstanceOf(Date);
      expect(restored[0].deadline).toBeInstanceOf(Date);

      const ctx = restored[0].simulationContext as {
        quote: { fetchedAt: Date; fee: number };
      };
      expect(ctx.quote.fetchedAt).toBeInstanceOf(Date);
      expect(ctx.quote.fetchedAt.toISOString()).toBe('2026-04-26T10:00:00.000Z');
      expect(ctx.quote.fee).toBe(7);

      // Polling is live again.
      expect(reborn.getPendingTransactions().map((t) => t.hash)).toEqual(['survive-refresh']);

      restored[0].cancel();
      await restored[0].promise.catch(() => undefined);
    });

    it('drops entries whose deadline has already passed', () => {
      const server = buildMockServer();
      const client = buildClient(server);

      const expired: ExportedState = {
        version: HYDRATION_STATE_VERSION,
        exportedAt: new Date().toISOString(),
        pending: [
          {
            hash: 'expired',
            submittedAt: new Date(Date.now() - 60_000).toISOString(),
            deadline: new Date(Date.now() - 1_000).toISOString(),
            intervalMs: 1_000,
          },
        ],
      };

      const restored = client.importState(expired);
      expect(restored).toHaveLength(0);
      expect(client.getPendingTransactions()).toHaveLength(0);
    });

    it('is idempotent — re-importing the same state does not duplicate polls', () => {
      const server = buildMockServer();
      server.getTransaction.mockResolvedValue({ status: 'NOT_FOUND' });
      const client = buildClient(server);

      const tracked = client.trackTransaction({
        hash: 'idem',
        intervalMs: 5,
        timeoutMs: 60_000,
      });

      const state = client.exportState();
      const restored = client.importState(state);

      expect(restored[0]).toBe(tracked);
      expect(client.getPendingTransactions()).toHaveLength(1);

      tracked.cancel();
    });

    it('rejects unsupported state versions', () => {
      const server = buildMockServer();
      const client = buildClient(server);

      expect(() =>
        client.importState({
          version: 999,
          exportedAt: new Date().toISOString(),
          pending: [],
        } as unknown as ExportedState),
      ).toThrow(/Unsupported hydration state version/);
    });

    it('rejects malformed state shapes', () => {
      const server = buildMockServer();
      const client = buildClient(server);

      expect(() =>
        client.importState({
          version: HYDRATION_STATE_VERSION,
          exportedAt: new Date().toISOString(),
          pending: 'nope' as unknown as never,
        }),
      ).toThrow(/`pending` must be an array/);
    });

    it('skips entries with empty/missing hashes silently', () => {
      const server = buildMockServer();
      const client = buildClient(server);

      const state: ExportedState = {
        version: HYDRATION_STATE_VERSION,
        exportedAt: new Date().toISOString(),
        pending: [
          {
            hash: '',
            submittedAt: new Date().toISOString(),
            deadline: new Date(Date.now() + 60_000).toISOString(),
            intervalMs: 1_000,
          },
        ],
      };

      expect(client.importState(state)).toHaveLength(0);
    });
  });

  describe('pollTransaction() integration', () => {
    it('appears in exportState() while in-flight and disappears after resolution', async () => {
      const server = buildMockServer();
      server.getTransaction
        .mockImplementationOnce(async () => {
          // Snapshot the registry mid-poll.
          midSnapshot = client.exportState();
          return { status: 'NOT_FOUND' };
        })
        .mockResolvedValueOnce({ status: 'SUCCESS' });

      let midSnapshot: ExportedState | undefined;
      const client = buildClient(server);

      await client.pollTransaction('mid', { intervalMs: 5, timeoutMs: 1_000 });

      expect(midSnapshot?.pending.map((p) => p.hash)).toEqual(['mid']);
      expect(client.exportState().pending).toHaveLength(0);
    });
  });
});
