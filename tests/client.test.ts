 
import { StellarClient } from '../src/client/stellarClient';
import { AxionveraError, InsecureNetworkError, NetworkError, RpcError, TimeoutError } from '../src/errors/axionveraError';

describe('StellarClient', () => {
  describe('Security Guard (HTTP in Production)', () => {
    const originalNodeEnv = process.env.NODE_ENV;

    afterEach(() => {
      process.env.NODE_ENV = originalNodeEnv;
      jest.clearAllMocks();
    });

    it('should throw InsecureNetworkError for HTTP non-localhost in production without allowHttp', () => {
      process.env.NODE_ENV = 'production';
      const options = { network: 'mainnet' as const, rpcUrl: 'http://soroban-mainnet.stellar.org' };
      expect(() => new StellarClient(options)).toThrow(InsecureNetworkError);
      expect(() => new StellarClient(options)).toThrow('Insecure RPC connection in production');
    });

    it('should allow HTTP in production when allowHttp is true', () => {
      process.env.NODE_ENV = 'production';
      const options = { network: 'mainnet' as const, rpcUrl: 'http://soroban-mainnet.stellar.org', allowHttp: true };
      expect(() => new StellarClient(options)).not.toThrow();
    });

    it('should allow HTTP to localhost in production even without allowHttp', () => {
      process.env.NODE_ENV = 'production';
      const options = { rpcUrl: 'http://localhost:8000' };
      expect(() => new StellarClient(options)).not.toThrow();
    });

    it('should allow HTTP to 127.0.0.1 in production even without allowHttp', () => {
      process.env.NODE_ENV = 'production';
      const options = { rpcUrl: 'http://127.0.0.1:8000' };
      expect(() => new StellarClient(options)).not.toThrow();
    });

    it('should allow HTTP to ::1 in production even without allowHttp', () => {
      process.env.NODE_ENV = 'production';
      const options = { rpcUrl: 'http://[::1]:8000' };
      expect(() => new StellarClient(options)).not.toThrow();
    });

    it('should allow HTTPS in production', () => {
      process.env.NODE_ENV = 'production';
      const options = { network: 'mainnet' as const, rpcUrl: 'https://soroban-mainnet.stellar.org' };
      expect(() => new StellarClient(options)).not.toThrow();
    });

    it('should allow HTTP in non-production environments (test/dev)', () => {
      process.env.NODE_ENV = 'test';
      const options = { network: 'mainnet' as const, rpcUrl: 'http://soroban-mainnet.stellar.org' };
      expect(() => new StellarClient(options)).not.toThrow();
    });

    it('should throw AxionveraError if RPC URL missing protocol', () => {
      process.env.NODE_ENV = 'production';
      const options = { rpcUrl: 'soroban-mainnet.stellar.org' };
      expect(() => new StellarClient(options)).toThrow(AxionveraError);
      expect(() => new StellarClient(options)).toThrow('must include a protocol');
    });
  });

  it('should retry on transient network failures', async () => {
    const options = { network: 'testnet' as const, rpcUrl: 'https://soroban-testnet.stellar.org' };
    const client = new StellarClient(options);
    const mockRpcCall = jest.fn()
      .mockRejectedValueOnce(new NetworkError('Network error', { statusCode: 500 }))
      .mockResolvedValueOnce({ status: 'SUCCESS' });

    client.rpc.getHealth = mockRpcCall;

    const result = await client.getHealth();

    expect(mockRpcCall).toHaveBeenCalledTimes(2);
    expect(result).toEqual({ status: 'SUCCESS' });
  });

  it('should throw a NetworkError on network errors', async () => {
    const options = { network: 'testnet' as const, rpcUrl: 'https://soroban-testnet.stellar.org' };
    const client = new StellarClient(options);
    const mockRpcCall = jest.fn().mockRejectedValue(new NetworkError('Network error'));

    client.rpc.getHealth = mockRpcCall;

    await expect(client.getHealth()).rejects.toThrow(NetworkError);
  });

  it('should throw a RpcError on non-2xx responses', async () => {
    const options = { network: 'testnet' as const, rpcUrl: 'https://soroban-testnet.stellar.org' };
    const client = new StellarClient(options);
    const mockRpcCall = jest.fn().mockRejectedValue(new RpcError('Response error'));

    client.rpc.getHealth = mockRpcCall;

    await expect(client.getHealth()).rejects.toThrow(RpcError);
  });

  it('should throw a TimeoutError on timeouts', async () => {
    const options = { network: 'testnet' as const, rpcUrl: 'https://soroban-testnet.stellar.org' };
    const client = new StellarClient(options);
    const mockRpcCall = jest.fn().mockRejectedValue(new TimeoutError('Timeout error'));

    client.rpc.getHealth = mockRpcCall;

    await expect(client.getHealth()).rejects.toThrow(TimeoutError);
  });
});
