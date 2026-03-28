import { rpc } from '@stellar/stellar-sdk';
import { StellarClient } from '../../src/client/stellarClient';
import { NetworkError, ValidationError } from '../../src/errors/axionveraError';

type MockRpcClient = {
  getHealth: () => Promise<unknown>;
  getAccount: (accountId: string) => Promise<unknown>;
  getNetwork: () => Promise<unknown>;
  getLatestLedger: () => Promise<unknown>;
  getTransaction: (hash: string) => Promise<unknown>;
};

const HEALTHY_RESPONSE = { status: 'healthy', version: '20.0.0' };
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
    getAccount: jest.fn().mockResolvedValue({
      accountId: () => VALID_ACCOUNT,
      sequence: '123456789'
    }),
    getNetwork: jest.fn().mockResolvedValue({ passphrase: 'Test SDF Network ; September 2015' }),
    getLatestLedger: jest.fn().mockResolvedValue({ sequence: 123456 }),
    getTransaction: jest.fn().mockResolvedValue({ status: 'SUCCESS' })
  };
}

describe('Retry Logic E2E Tests', () => {
  let mockRpc: jest.Mocked<MockRpcClient>;
  let client: StellarClient;

  beforeEach(() => {
    jest.clearAllMocks();
    mockRpc = createMockRpcClient();
    client = new StellarClient({
      network: 'testnet',
      rpcClient: mockRpc as unknown as rpc.Server,
      retryConfig: {
        maxRetries: 3,
        baseDelayMs: 25,
        maxDelayMs: 150,
        enabled: true
      }
    });
  });

  it('retries transient failures and eventually succeeds', async () => {
    let callCount = 0;
    mockRpc.getHealth.mockImplementation(async () => {
      callCount += 1;
      if (callCount <= 2) {
        throw statusError(500, 'Internal server error');
      }
      return HEALTHY_RESPONSE;
    });

    const result = await client.getHealth();

    expect(result).toEqual(HEALTHY_RESPONSE);
    expect(callCount).toBe(3);
  });

  it('uses exponential backoff across retries', async () => {
    const callTimes: number[] = [];
    let callCount = 0;

    mockRpc.getHealth.mockImplementation(async () => {
      callTimes.push(Date.now());
      callCount += 1;
      if (callCount <= 3) {
        throw statusError(500, 'Internal server error');
      }
      return HEALTHY_RESPONSE;
    });

    await client.getHealth();

    expect(callCount).toBe(4);
    expect(callTimes[1] - callTimes[0]).toBeGreaterThan(15);
    expect(callTimes[2] - callTimes[1]).toBeGreaterThan((callTimes[1] - callTimes[0]) * 0.7);
  });

  it('does not retry non-retryable validation errors', async () => {
    let callCount = 0;
    mockRpc.getHealth.mockImplementation(async () => {
      callCount += 1;
      throw statusError(400, 'Bad request');
    });

    await expect(client.getHealth()).rejects.toMatchObject({
      name: ValidationError.name,
      statusCode: 400
    });

    expect(callCount).toBe(1);
  });

  it('maps 404 account lookup failures to validation errors', async () => {
    let callCount = 0;
    mockRpc.getAccount.mockImplementation(async () => {
      callCount += 1;
      throw statusError(404, 'Account not found');
    });

    await expect(client.getAccount(VALID_ACCOUNT)).rejects.toMatchObject({
      name: ValidationError.name,
      statusCode: 404
    });

    expect(callCount).toBe(1);
  });

  it('honors custom maxRetries limits', async () => {
    let callCount = 0;
    const limitedClient = new StellarClient({
      network: 'testnet',
      rpcClient: mockRpc as unknown as rpc.Server,
      retryConfig: {
        maxRetries: 1,
        baseDelayMs: 10,
        enabled: true
      }
    });

    mockRpc.getHealth.mockImplementation(async () => {
      callCount += 1;
      throw statusError(500, 'Internal server error');
    });

    await expect(limitedClient.getHealth()).rejects.toMatchObject({
      name: NetworkError.name,
      statusCode: 500
    });

    expect(callCount).toBe(2);
  });

  it('does not retry when retries are disabled', async () => {
    let callCount = 0;
    const noRetryClient = new StellarClient({
      network: 'testnet',
      rpcClient: mockRpc as unknown as rpc.Server,
      retryConfig: {
        enabled: false
      }
    });

    mockRpc.getHealth.mockImplementation(async () => {
      callCount += 1;
      throw statusError(500, 'Internal server error');
    });

    await expect(noRetryClient.getHealth()).rejects.toMatchObject({
      name: NetworkError.name,
      statusCode: 500
    });

    expect(callCount).toBe(1);
  });

  it('handles concurrent retrying requests', async () => {
    let callCount = 0;
    mockRpc.getHealth.mockImplementation(async () => {
      callCount += 1;
      if (callCount <= 3) {
        throw statusError(500, 'Internal server error');
      }
      return HEALTHY_RESPONSE;
    });

    const results = await Promise.all(Array.from({ length: 5 }, () => client.getHealth()));

    results.forEach((result) => {
      expect(result).toEqual(HEALTHY_RESPONSE);
    });
    expect(callCount).toBeGreaterThan(3);
  });
});
