import { rpc } from '@stellar/stellar-sdk';
import { StellarClient } from '../../src/client/stellarClient';
import { NetworkError, ValidationError } from '../../src/errors/axionveraError';

type MockRpcClient = {
  getHealth: () => Promise<unknown>;
  getNetwork: () => Promise<unknown>;
  getLatestLedger: () => Promise<unknown>;
  getAccount: (accountId: string) => Promise<unknown>;
  getTransaction: (hash: string) => Promise<unknown>;
  simulateTransaction: (tx: unknown) => Promise<unknown>;
  prepareTransaction: (tx: unknown) => Promise<any>;
  sendTransaction: (tx: unknown) => Promise<unknown>;
};

const HEALTHY_RESPONSE = { status: 'healthy', version: '20.0.0' };
const NETWORK_RESPONSE = {
  friendbot_url: 'https://friendbot.stellar.org',
  passphrase: 'Test SDF Network ; September 2015',
  protocol_version: 20
};
const LEDGER_RESPONSE = { id: '12345', protocol_version: 20, sequence: 123456 };
const VALID_ACCOUNT = 'GD5JPQ7VKFOVRWPOEX74JYXHHFNTFZ2JE5WZ4K2MWTROVHMWHD7KUZ2V';

function statusError(status: number, message = 'Request failed'): Error {
  return {
    name: 'AxiosError',
    message,
    response: {
      status,
      data: { error: message }
    }
  } as unknown as Error;
}

function createMockRpcClient(): jest.Mocked<MockRpcClient> {
  return {
    getHealth: jest.fn().mockResolvedValue(HEALTHY_RESPONSE),
    getNetwork: jest.fn().mockResolvedValue(NETWORK_RESPONSE),
    getLatestLedger: jest.fn().mockResolvedValue(LEDGER_RESPONSE),
    getAccount: jest.fn().mockResolvedValue({
      accountId: () => VALID_ACCOUNT,
      sequence: '123456789'
    }),
    getTransaction: jest.fn().mockResolvedValue({ status: 'SUCCESS', latest_ledger: 123456 }),
    simulateTransaction: jest.fn().mockResolvedValue({
      transaction_data: 'AAAAAgAAAAA...',
      results: [{}],
      cost: { cpu_insns: 123, mem_bytes: 456 }
    }),
    prepareTransaction: jest.fn().mockResolvedValue({ toXDR: () => 'AAAAAgAAAAA==' }),
    sendTransaction: jest.fn().mockResolvedValue({
      hash: 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456',
      status: 'PENDING'
    })
  };
}

describe('StellarClient E2E Workflows', () => {
  let mockRpc: jest.Mocked<MockRpcClient>;
  let client: StellarClient;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRpc = createMockRpcClient();
    client = new StellarClient({
      network: 'testnet',
      rpcClient: mockRpc as unknown as rpc.Server,
      retryConfig: {
        maxRetries: 2,
        baseDelayMs: 25,
        enabled: true
      }
    });
  });

  it('executes basic SDK read workflows', async () => {
    const health = await client.getHealth();
    const network = await client.getNetwork();
    const ledger = await client.getLatestLedger();

    expect(health).toEqual(HEALTHY_RESPONSE);
    expect(network).toEqual(NETWORK_RESPONSE);
    expect(ledger).toEqual(LEDGER_RESPONSE);
  });

  it('executes account and transaction lookups', async () => {
    const account = await client.getAccount(VALID_ACCOUNT);
    const tx = await client.getTransaction('mock-tx');

    expect(account.accountId()).toBe(VALID_ACCOUNT);
    expect(tx).toEqual(expect.objectContaining({ status: 'SUCCESS' }));
  });

  it('executes simulation, preparation, and submission workflow', async () => {
    const mockTransaction = { toXDR: () => 'AAAAAgAAAAA==' } as any;

    const simulation = await client.simulateTransaction(mockTransaction);
    const prepared = await client.prepareTransaction(mockTransaction);
    const sent = await client.sendTransaction(mockTransaction);

    expect((simulation as any).transaction_data).toBeDefined();
    expect(prepared).toBeDefined();
    expect(prepared.toXDR).toBeDefined();
    expect(sent.hash).toBeDefined();
    expect(sent.status).toBeDefined();
  });

  it('polls transaction status until found', async () => {
    mockRpc.getTransaction
      .mockResolvedValueOnce({ status: 'NOT_FOUND' })
      .mockResolvedValueOnce({ status: 'SUCCESS', latest_ledger: 123456 });

    const result = await client.pollTransaction('mock-hash', {
      timeoutMs: 1000,
      intervalMs: 10
    });

    expect(result).toEqual(expect.objectContaining({ status: 'SUCCESS' }));
  });

  it('retries transient health failures', async () => {
    let callCount = 0;
    mockRpc.getHealth.mockImplementation(async () => {
      callCount += 1;
      if (callCount <= 1) {
        throw statusError(500, 'Internal server error');
      }
      return HEALTHY_RESPONSE;
    });

    const result = await client.getHealth();

    expect(result).toEqual(HEALTHY_RESPONSE);
    expect(callCount).toBe(2);
  });

  it('maps non-retryable errors to validation errors', async () => {
    mockRpc.getAccount.mockRejectedValueOnce(statusError(404, 'Account not found'));

    await expect(client.getAccount(VALID_ACCOUNT)).rejects.toMatchObject({
      name: ValidationError.name,
      statusCode: 404
    });
  });

  it('handles concurrency bursts with consistent responses', async () => {
    const results = await Promise.all(Array.from({ length: 10 }, () => client.getHealth()));

    expect(results).toHaveLength(10);
    results.forEach((result) => {
      expect(result).toEqual(HEALTHY_RESPONSE);
    });
  });

  it('throws network error on polling timeout', async () => {
    mockRpc.getTransaction.mockResolvedValue({ status: 'NOT_FOUND' });

    await expect(
      client.pollTransaction('mock-hash', {
        timeoutMs: 50,
        intervalMs: 10
      })
    ).rejects.toMatchObject({
      name: NetworkError.name
    });
  });
});
