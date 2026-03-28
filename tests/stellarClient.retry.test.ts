import { StellarClient } from '../src/client/stellarClient';
import { rpc } from '@stellar/stellar-sdk';
import { NetworkError } from '../src/errors/axionveraError';

jest.mock('@stellar/stellar-sdk');
const mockedRpc = rpc as jest.Mocked<typeof rpc>;

describe('StellarClient Retry Functionality', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('retry configuration', () => {
    it('should use default retry config when none provided', () => {
      const mockServer = {
        getHealth: jest.fn(),
        getNetwork: jest.fn(),
        getLatestLedger: jest.fn(),
        getAccount: jest.fn(),
        getTransaction: jest.fn(),
        simulateTransaction: jest.fn(),
        prepareTransaction: jest.fn(),
        sendTransaction: jest.fn(),
      };

      mockedRpc.Server = jest.fn().mockImplementation(() => mockServer);

      const client = new StellarClient();

      expect(client.retryConfig).toEqual({});
    });

    it('should use custom retry config when provided', () => {
      const mockServer = {
        getHealth: jest.fn(),
        getNetwork: jest.fn(),
        getLatestLedger: jest.fn(),
        getAccount: jest.fn(),
        getTransaction: jest.fn(),
        simulateTransaction: jest.fn(),
        prepareTransaction: jest.fn(),
        sendTransaction: jest.fn(),
      };

      mockedRpc.Server = jest.fn().mockImplementation(() => mockServer);

      const customRetryConfig = {
        maxRetries: 5,
        baseDelayMs: 2000,
        enabled: true
      };

      const client = new StellarClient({ retryConfig: customRetryConfig });

      expect(client.retryConfig).toEqual(customRetryConfig);
    });

    it('should disable retries when enabled is false', () => {
      const mockServer = {
        getHealth: jest.fn(),
        getNetwork: jest.fn(),
        getLatestLedger: jest.fn(),
        getAccount: jest.fn(),
        getTransaction: jest.fn(),
        simulateTransaction: jest.fn(),
        prepareTransaction: jest.fn(),
        sendTransaction: jest.fn(),
      };

      mockedRpc.Server = jest.fn().mockImplementation(() => mockServer);

      const client = new StellarClient({ retryConfig: { enabled: false } });

      expect(client.retryConfig.enabled).toBe(false);
    });
  });

  describe('retry behavior on idempotent operations', () => {
    let mockServer: any;
    let client: StellarClient;

    beforeEach(() => {
      mockServer = {
        getHealth: jest.fn(),
        getNetwork: jest.fn(),
        getLatestLedger: jest.fn(),
        getAccount: jest.fn(),
        getTransaction: jest.fn(),
        simulateTransaction: jest.fn(),
        prepareTransaction: jest.fn(),
        sendTransaction: jest.fn(),
      };

      mockedRpc.Server = jest.fn().mockImplementation(() => mockServer);
      client = new StellarClient({ retryConfig: { maxRetries: 2 } });
    });

    it('should retry getHealth on failure', async () => {
      const error = { response: { status: 500 } };
      mockServer.getHealth
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce('success');

      const result = await client.getHealth();

      expect(result).toBe('success');
      expect(mockServer.getHealth).toHaveBeenCalledTimes(2);
    });

    it('should retry getNetwork on failure', async () => {
      const error = { response: { status: 429 } };
      mockServer.getNetwork
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce('success');

      const result = await client.getNetwork();

      expect(result).toBe('success');
      expect(mockServer.getNetwork).toHaveBeenCalledTimes(2);
    });

    it('should retry getLatestLedger on failure', async () => {
      const error = { response: { status: 503 } };
      mockServer.getLatestLedger
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce('success');

      const result = await client.getLatestLedger();

      expect(result).toBe('success');
      expect(mockServer.getLatestLedger).toHaveBeenCalledTimes(2);
    });

    it('should retry getAccount on failure', async () => {
      const error = { response: { status: 502 } };
      mockServer.getAccount
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce('success');

      const result = await client.getAccount('test-key');

      expect(result).toBe('success');
      expect(mockServer.getAccount).toHaveBeenCalledTimes(2);
    });

    it('should retry getTransaction on failure', async () => {
      const error = { response: { status: 504 } };
      mockServer.getTransaction
        .mockRejectedValueOnce(error)
        .mockResolvedValueOnce('success');

      const result = await client.getTransaction('test-hash');

      expect(result).toBe('success');
      expect(mockServer.getTransaction).toHaveBeenCalledTimes(2);
    });
  });

  describe('no retry on non-idempotent operations', () => {
    let mockServer: any;
    let client: StellarClient;

    beforeEach(() => {
      mockServer = {
        simulateTransaction: jest.fn(),
        prepareTransaction: jest.fn(),
        sendTransaction: jest.fn(),
      };

      mockedRpc.Server = jest.fn().mockImplementation(() => mockServer);
      client = new StellarClient();
    });

    it('should not retry simulateTransaction', async () => {
      const error = { response: { status: 500 } };
      mockServer.simulateTransaction.mockRejectedValue(error);

      let thrown: unknown;
      try {
        await client.simulateTransaction({} as any);
      } catch (err: unknown) {
        thrown = err;
      }

      expect(thrown).toBeInstanceOf(NetworkError);
      expect(thrown).toMatchObject({ statusCode: 500 });
      expect(mockServer.simulateTransaction).toHaveBeenCalledTimes(1);
    });

    it('should not retry prepareTransaction', async () => {
      const error = { response: { status: 500 } };
      mockServer.prepareTransaction.mockRejectedValue(error);

      let thrown: unknown;
      try {
        await client.prepareTransaction({} as any);
      } catch (err: unknown) {
        thrown = err;
      }

      expect(thrown).toBeInstanceOf(NetworkError);
      expect(thrown).toMatchObject({ statusCode: 500 });
      expect(mockServer.prepareTransaction).toHaveBeenCalledTimes(1);
    });

    it('should not retry sendTransaction', async () => {
      const error = { response: { status: 500 } };
      mockServer.sendTransaction.mockRejectedValue(error);

      let thrown: unknown;
      try {
        await client.sendTransaction({} as any);
      } catch (err: unknown) {
        thrown = err;
      }

      expect(thrown).toBeInstanceOf(NetworkError);
      expect(thrown).toMatchObject({ statusCode: 500 });
      expect(mockServer.sendTransaction).toHaveBeenCalledTimes(1);
    });
  });
});
