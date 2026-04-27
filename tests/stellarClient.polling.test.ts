import { rpc } from '@stellar/stellar-sdk';
import { StellarClient } from '../src/client/stellarClient';
import { TransactionTimeoutError } from '../src/errors/axionveraError';

jest.mock('@stellar/stellar-sdk');
const mockedRpc = rpc as jest.Mocked<typeof rpc>;

describe('StellarClient transaction polling', () => {
  let mockServer: {
    getTransaction: jest.Mock;
  };
  let client: StellarClient;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();

    mockServer = {
      getTransaction: jest.fn()
    };

    mockedRpc.Server = jest.fn().mockImplementation(() => mockServer as any);
    client = new StellarClient();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns the final SUCCESS result with the included ledger', async () => {
    mockServer.getTransaction
      .mockResolvedValueOnce({ status: 'NOT_FOUND' })
      .mockResolvedValueOnce({ status: 'SUCCESS', ledger: '12345', hash: 'tx-success' });

    const resultPromise = client.pollTransaction('tx-success', {
      timeoutMs: 60_000,
      intervalMs: 3_000
    });

    await Promise.resolve();
    expect(mockServer.getTransaction).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(2_999);
    expect(mockServer.getTransaction).toHaveBeenCalledTimes(1);

    await jest.advanceTimersByTimeAsync(1);
    await expect(resultPromise).resolves.toMatchObject({
      status: 'SUCCESS',
      ledger: 12345,
      hash: 'tx-success'
    });
    expect(mockServer.getTransaction).toHaveBeenCalledTimes(2);
  });

  it('returns the final FAILED result instead of timing out', async () => {
    mockServer.getTransaction
      .mockResolvedValueOnce({ status: 'PENDING' })
      .mockResolvedValueOnce({ status: 'FAILED', ledger: 777, hash: 'tx-failed' });

    const resultPromise = client.pollTransaction('tx-failed', {
      timeoutMs: 60_000,
      intervalMs: 3_000
    });

    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(3_000);

    await expect(resultPromise).resolves.toMatchObject({
      status: 'FAILED',
      ledger: 777,
      hash: 'tx-failed'
    });
  });

  it('throws TransactionTimeoutError when a final status is never reached', async () => {
    mockServer.getTransaction.mockResolvedValue({ status: 'NOT_FOUND' });

    const resultPromise = client.pollTransaction('tx-timeout', {
      timeoutMs: 60_000,
      intervalMs: 3_000
    });
    const rejection = expect(resultPromise).rejects.toBeInstanceOf(TransactionTimeoutError);

    await Promise.resolve();
    await jest.advanceTimersByTimeAsync(60_000);
    await rejection;
  });
});
