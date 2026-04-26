import {
  AxionveraError,
  RPCValidationMismatchError,
  toAxionveraError,
} from '../src/errors/axionveraError';
import {
  validateRpcResponse,
  GetHealthResponseSchema,
  SimulateTransactionResponseSchema,
  GetTransactionResponseSchema,
} from '../src/utils/rpcSchemas';
import { StellarClient } from '../src/client/stellarClient';

jest.mock('@stellar/stellar-sdk', () => {
  const originalModule = jest.requireActual('@stellar/stellar-sdk');
  return {
    ...originalModule,
    rpc: {
      ...originalModule.rpc,
      Server: jest.fn().mockImplementation(() => ({
        getHealth: jest.fn(),
        getNetwork: jest.fn(),
        getLatestLedger: jest.fn(),
        getAccount: jest.fn(),
        simulateTransaction: jest.fn(),
        prepareTransaction: jest.fn(),
        sendTransaction: jest.fn(),
        getTransaction: jest.fn(),
      })),
    },
  };
});

describe('RPCValidationMismatchError', () => {
  it('extends AxionveraError', () => {
    const err = new RPCValidationMismatchError('test', {
      rpcMethod: 'getHealth',
      receivedShape: {},
    });
    expect(err).toBeInstanceOf(AxionveraError);
    expect(err).toBeInstanceOf(RPCValidationMismatchError);
  });

  it('carries rpcMethod and receivedShape properties', () => {
    const shape = { foo: 'bar' };
    const err = new RPCValidationMismatchError('test', {
      rpcMethod: 'getTransaction',
      receivedShape: shape,
    });
    expect(err.rpcMethod).toBe('getTransaction');
    expect(err.receivedShape).toBe(shape);
  });

  it('has the correct name via new.target.name', () => {
    const err = new RPCValidationMismatchError('test', {
      rpcMethod: 'getHealth',
      receivedShape: null,
    });
    expect(err.name).toBe('RPCValidationMismatchError');
  });

  it('passes through toAxionveraError unchanged', () => {
    const err = new RPCValidationMismatchError('test', {
      rpcMethod: 'getHealth',
      receivedShape: null,
    });
    expect(toAxionveraError(err)).toBe(err);
  });
});

describe('validateRpcResponse helper', () => {
  it('returns parsed output when schema matches', () => {
    const result = validateRpcResponse(GetHealthResponseSchema, { status: 'healthy' }, 'getHealth');
    expect(result.status).toBe('healthy');
  });

  it('throws RPCValidationMismatchError when schema fails', () => {
    expect(() =>
      validateRpcResponse(GetHealthResponseSchema, { status: 42 }, 'getHealth')
    ).toThrow(RPCValidationMismatchError);
  });

  it('includes rpcMethod in thrown error', () => {
    try {
      validateRpcResponse(GetHealthResponseSchema, {}, 'getHealth');
    } catch (e) {
      expect(e).toBeInstanceOf(RPCValidationMismatchError);
      expect((e as RPCValidationMismatchError).rpcMethod).toBe('getHealth');
    }
  });

  it('includes receivedShape in thrown error', () => {
    const bad = { unexpected: true };
    try {
      validateRpcResponse(GetHealthResponseSchema, bad, 'getHealth');
    } catch (e) {
      expect((e as RPCValidationMismatchError).receivedShape).toBe(bad);
    }
  });

  it('error message references the rpcMethod name', () => {
    try {
      validateRpcResponse(GetHealthResponseSchema, {}, 'getHealth');
    } catch (e) {
      expect((e as RPCValidationMismatchError).message).toContain('"getHealth"');
    }
  });
});

describe('GetHealthResponseSchema', () => {
  it('accepts { status: "healthy" }', () => {
    const result = validateRpcResponse(GetHealthResponseSchema, { status: 'healthy' }, 'getHealth');
    expect(result.status).toBe('healthy');
  });

  it('accepts extra unknown fields (loose object)', () => {
    expect(() =>
      validateRpcResponse(GetHealthResponseSchema, { status: 'healthy', version: '20.0.0' }, 'getHealth')
    ).not.toThrow();
  });

  it('rejects response missing status field', () => {
    expect(() =>
      validateRpcResponse(GetHealthResponseSchema, {}, 'getHealth')
    ).toThrow(RPCValidationMismatchError);
  });

  it('rejects response with status as non-string', () => {
    expect(() =>
      validateRpcResponse(GetHealthResponseSchema, { status: 1 }, 'getHealth')
    ).toThrow(RPCValidationMismatchError);
  });
});

describe('SimulateTransactionResponseSchema', () => {
  it('accepts a success response with latestLedger', () => {
    expect(() =>
      validateRpcResponse(
        SimulateTransactionResponseSchema,
        { latestLedger: 100, results: [], events: [] },
        'simulateTransaction'
      )
    ).not.toThrow();
  });

  it('accepts an error response with latestLedger and error string', () => {
    expect(() =>
      validateRpcResponse(
        SimulateTransactionResponseSchema,
        { latestLedger: 100, error: 'simulation failed' },
        'simulateTransaction'
      )
    ).not.toThrow();
  });

  it('rejects a response missing latestLedger', () => {
    expect(() =>
      validateRpcResponse(
        SimulateTransactionResponseSchema,
        { results: [] },
        'simulateTransaction'
      )
    ).toThrow(RPCValidationMismatchError);
  });

  it('rejects a response with latestLedger as string', () => {
    expect(() =>
      validateRpcResponse(
        SimulateTransactionResponseSchema,
        { latestLedger: '100' },
        'simulateTransaction'
      )
    ).toThrow(RPCValidationMismatchError);
  });
});

describe('GetTransactionResponseSchema', () => {
  it('accepts status SUCCESS with latestLedger', () => {
    expect(() =>
      validateRpcResponse(
        GetTransactionResponseSchema,
        { status: 'SUCCESS', latestLedger: 100 },
        'getTransaction'
      )
    ).not.toThrow();
  });

  it('accepts status FAILED with latestLedger', () => {
    expect(() =>
      validateRpcResponse(
        GetTransactionResponseSchema,
        { status: 'FAILED', latestLedger: 100 },
        'getTransaction'
      )
    ).not.toThrow();
  });

  it('accepts status NOT_FOUND with latestLedger', () => {
    expect(() =>
      validateRpcResponse(
        GetTransactionResponseSchema,
        { status: 'NOT_FOUND', latestLedger: 100 },
        'getTransaction'
      )
    ).not.toThrow();
  });

  it('rejects an unknown status string', () => {
    expect(() =>
      validateRpcResponse(
        GetTransactionResponseSchema,
        { status: 'PENDING', latestLedger: 100 },
        'getTransaction'
      )
    ).toThrow(RPCValidationMismatchError);
  });

  it('rejects missing latestLedger', () => {
    expect(() =>
      validateRpcResponse(
        GetTransactionResponseSchema,
        { status: 'SUCCESS' },
        'getTransaction'
      )
    ).toThrow(RPCValidationMismatchError);
  });
});

describe('StellarClient RPC validation integration', () => {
  let client: StellarClient;
  let mockRpc: Record<string, jest.Mock>;

  beforeEach(() => {
    client = new StellarClient({ network: 'testnet' });
    mockRpc = client.rpc as unknown as Record<string, jest.Mock>;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getHealth()', () => {
    it('resolves normally with a valid response shape', async () => {
      mockRpc['getHealth'].mockResolvedValue({ status: 'healthy' });
      const result = await client.getHealth();
      expect(result.status).toBe('healthy');
    });

    it('throws RPCValidationMismatchError when response is empty', async () => {
      mockRpc['getHealth'].mockResolvedValue({});
      await expect(client.getHealth()).rejects.toBeInstanceOf(RPCValidationMismatchError);
    });

    it('throws RPCValidationMismatchError when status is a number', async () => {
      mockRpc['getHealth'].mockResolvedValue({ status: 42 });
      await expect(client.getHealth()).rejects.toBeInstanceOf(RPCValidationMismatchError);
    });

    it('thrown error carries rpcMethod "getHealth"', async () => {
      mockRpc['getHealth'].mockResolvedValue({});
      try {
        await client.getHealth();
      } catch (e) {
        expect((e as RPCValidationMismatchError).rpcMethod).toBe('getHealth');
      }
    });
  });

  describe('simulateTransaction()', () => {
    it('resolves with a valid success shape', async () => {
      const mockResponse = { latestLedger: 42, results: [], events: [] };
      mockRpc['simulateTransaction'].mockResolvedValue(mockResponse);
      const fakeTx = {} as any;
      const result = await client.simulateTransaction(fakeTx);
      expect(result).toBe(mockResponse);
    });

    it('throws RPCValidationMismatchError when latestLedger is missing', async () => {
      mockRpc['simulateTransaction'].mockResolvedValue({ results: [] });
      const fakeTx = {} as any;
      await expect(client.simulateTransaction(fakeTx)).rejects.toBeInstanceOf(RPCValidationMismatchError);
    });
  });

  describe('getTransaction()', () => {
    it('resolves with status SUCCESS', async () => {
      mockRpc['getTransaction'].mockResolvedValue({ status: 'SUCCESS', latestLedger: 200 });
      const result = await client.getTransaction('abc123');
      expect(result.status).toBe('SUCCESS');
      expect(result.latestLedger).toBe(200);
    });

    it('resolves with status NOT_FOUND', async () => {
      mockRpc['getTransaction'].mockResolvedValue({ status: 'NOT_FOUND', latestLedger: 200 });
      const result = await client.getTransaction('abc123');
      expect(result.status).toBe('NOT_FOUND');
    });

    it('throws RPCValidationMismatchError when status is an unknown string', async () => {
      mockRpc['getTransaction'].mockResolvedValue({ status: 'PENDING', latestLedger: 200 });
      await expect(client.getTransaction('abc123')).rejects.toBeInstanceOf(RPCValidationMismatchError);
    });

    it('thrown error is also instanceof AxionveraError', async () => {
      mockRpc['getTransaction'].mockResolvedValue({ status: 'PENDING', latestLedger: 200 });
      await expect(client.getTransaction('abc123')).rejects.toBeInstanceOf(AxionveraError);
    });
  });
});
