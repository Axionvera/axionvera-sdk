
import { StellarClient } from '../../src/client/stellarClient';
import { createStellarRpcClient, getDefaultClient } from '../../src/client/stellarClientFactory';
import { AxionveraError, StellarRpcNetworkError, StellarRpcResponseError, StellarRpcTimeoutError } from '../../src/errors/axionveraError';

jest.mock('../../src/client/stellarClient');

describe('StellarClientFactory', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create a new client if one does not exist in the cache', () => {
    const options = { network: 'testnet' as const, rpcUrl: 'https://soroban-testnet.stellar.org' };
    const client = createStellarRpcClient(options);
    expect(StellarClient).toHaveBeenCalledWith(options);
    expect(client).toBeInstanceOf(StellarClient);
  });

  it('should return a cached client if one exists for the same configuration', () => {
    const options = { network: 'testnet' as const, rpcUrl: 'https://soroban-testnet.stellar.org' };
    const client1 = createStellarRpcClient(options);
    const client2 = createStellarRpcClient(options);
    expect(StellarClient).toHaveBeenCalledTimes(1);
    expect(client1).toBe(client2);
  });

  it('should create a new client for a different configuration', () => {
    const options1 = { network: 'testnet' as const, rpcUrl: 'https://soroban-testnet.stellar.org' };
    const options2 = { network: 'mainnet' as const, rpcUrl: 'https://soroban-mainnet.stellar.org' };
    const client1 = createStellarRpcClient(options1);
    const client2 = createStellarRpcClient(options2);
    expect(StellarClient).toHaveBeenCalledTimes(2);
    expect(client1).not.toBe(client2);
  });

  it('should return a default testnet client', () => {
    const client = getDefaultClient();
    expect(StellarClient).toHaveBeenCalledWith({ network: 'testnet' });
    expect(client).toBeInstanceOf(StellarClient);
  });
});

describe('StellarClient', () => {
  it('should throw an error if the URL scheme is invalid for mainnet', () => {
    const options = { network: 'mainnet' as const, rpcUrl: 'http://soroban-mainnet.stellar.org' };
    expect(() => new StellarClient(options)).toThrow('RPC URL must use https for mainnet');
  });

  it('should retry on transient network failures', async () => {
    const options = { network: 'testnet' as const, rpcUrl: 'https://soroban-testnet.stellar.org' };
    const client = new StellarClient(options);
    const mockRpcCall = jest.fn()
      .mockRejectedValueOnce(new StellarRpcNetworkError('Network error'))
      .mockResolvedValueOnce({ status: 'SUCCESS' });

    client.rpc.getHealth = mockRpcCall;

    const result = await client.getHealth();

    expect(mockRpcCall).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ status: 'SUCCESS' });
  });

  it('should throw a StellarRpcNetworkError on network errors', async () => {
    const options = { network: 'testnet' as const, rpcUrl: 'https://soroban-testnet.stellar.org' };
    const client = new StellarClient(options);
    const mockRpcCall = jest.fn().mockRejectedValue(new StellarRpcNetworkError('Network error'));

    client.rpc.getHealth = mockRpcCall;

    await expect(client.getHealth()).rejects.toThrow(StellarRpcNetworkError);
  });

  it('should throw a StellarRpcResponseError on non-2xx responses', async () => {
    const options = { network: 'testnet' as const, rpcUrl: 'https://soroban-testnet.stellar.org' };
    const client = new StellarClient(options);
    const mockRpcCall = jest.fn().mockRejectedValue(new StellarRpcResponseError('Response error'));

    client.rpc.getHealth = mockRpcCall;

    await expect(client.getHealth()).rejects.toThrow(StellarRpcResponseError);
  });

  it('should throw a StellarRpcTimeoutError on timeouts', async () => {
    const options = { network: 'testnet' as const, rpcUrl: 'https://soroban-testnet.stellar.org' };
    const client = new StellarClient(options);
    const mockRpcCall = jest.fn().mockRejectedValue(new StellarRpcTimeoutError('Timeout error'));

    client.rpc.getHealth = mockRpcCall;

    await expect(client.getHealth()).rejects.toThrow(StellarRpcTimeoutError);
  });
});
