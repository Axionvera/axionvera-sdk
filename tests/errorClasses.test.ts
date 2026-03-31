import {
  AuthenticationError,
  AxionveraError,
  NetworkError,
  RateLimitError,
  ValidationError,
  TransactionError,
  RpcError,
  ContractError,
  TimeoutError,
  InsufficientFundsError,
  InvalidSignatureError,
  SimulationError,
  toAxionveraError,
  normalizeRpcError,
  normalizeTransactionError,
  normalizeContractError,
  normalizeSimulationError
} from '../src/errors/axionveraError';

describe('Axionvera error mapping', () => {
  it('maps 401 responses to AuthenticationError', () => {
    const error = toAxionveraError({
      response: {
        status: 401,
        headers: {
          'x-request-id': 'req-auth-1'
        }
      }
    });

    expect(error).toBeInstanceOf(AuthenticationError);
    expect(error.statusCode).toBe(401);
    expect(error.requestId).toBe('req-auth-1');
  });

  it('maps 429 responses to RateLimitError', () => {
    const error = toAxionveraError({
      response: {
        status: 429,
        headers: {
          'x-request-id': 'req-rate-1'
        }
      }
    });

    expect(error).toBeInstanceOf(RateLimitError);
    expect(error.statusCode).toBe(429);
    expect(error.requestId).toBe('req-rate-1');
  });

  it('maps 400 responses to ValidationError', () => {
    const error = toAxionveraError({
      response: {
        status: 400
      }
    });

    expect(error).toBeInstanceOf(ValidationError);
    expect(error.statusCode).toBe(400);
  });

  it('maps timeout/network codes to NetworkError when response is missing', () => {
    const error = toAxionveraError({
      code: 'ECONNABORTED',
      message: 'timeout exceeded'
    });

    expect(error).toBeInstanceOf(NetworkError);
    expect(error.statusCode).toBeUndefined();
    expect(error.message).toBe('timeout exceeded');
  });

  it('returns existing AxionveraError instances unchanged', () => {
    const existing = new ValidationError('Already typed', {
      statusCode: 422,
      requestId: 'req-existing'
    });

    const mapped = toAxionveraError(existing);

    expect(mapped).toBe(existing);
    expect(mapped).toBeInstanceOf(AxionveraError);
    expect(mapped.statusCode).toBe(422);
    expect(mapped.requestId).toBe('req-existing');
  });
});

describe('New error classes', () => {
  it('TransactionError extends AxionveraError', () => {
    const error = new TransactionError('Transaction failed');
    expect(error).toBeInstanceOf(AxionveraError);
    expect(error).toBeInstanceOf(TransactionError);
    expect(error.message).toBe('Transaction failed');
  });

  it('RpcError extends AxionveraError', () => {
    const error = new RpcError('RPC failed');
    expect(error).toBeInstanceOf(AxionveraError);
    expect(error).toBeInstanceOf(RpcError);
    expect(error.message).toBe('RPC failed');
  });

  it('ContractError extends AxionveraError', () => {
    const error = new ContractError('Contract failed');
    expect(error).toBeInstanceOf(AxionveraError);
    expect(error).toBeInstanceOf(ContractError);
    expect(error.message).toBe('Contract failed');
  });

  it('TimeoutError extends AxionveraError', () => {
    const error = new TimeoutError('Operation timed out');
    expect(error).toBeInstanceOf(AxionveraError);
    expect(error).toBeInstanceOf(TimeoutError);
    expect(error.message).toBe('Operation timed out');
  });

  it('InsufficientFundsError extends AxionveraError', () => {
    const error = new InsufficientFundsError('Not enough funds');
    expect(error).toBeInstanceOf(AxionveraError);
    expect(error).toBeInstanceOf(InsufficientFundsError);
    expect(error.message).toBe('Not enough funds');
  });

  it('InvalidSignatureError extends AxionveraError', () => {
    const error = new InvalidSignatureError('Invalid signature');
    expect(error).toBeInstanceOf(AxionveraError);
    expect(error).toBeInstanceOf(InvalidSignatureError);
    expect(error.message).toBe('Invalid signature');
  });

  it('SimulationError extends AxionveraError', () => {
    const error = new SimulationError('Simulation failed');
    expect(error).toBeInstanceOf(AxionveraError);
    expect(error).toBeInstanceOf(SimulationError);
    expect(error.message).toBe('Simulation failed');
  });
});

describe('Error normalization functions', () => {
  it('normalizeRpcError handles timeout errors', () => {
    const error = normalizeRpcError({ code: 'TIMEOUT', message: 'Request timed out' }, 'getHealth');
    expect(error).toBeInstanceOf(TimeoutError);
    expect(error.message).toBe('Request timed out');
  });

  it('normalizeRpcError handles network errors', () => {
    const error = normalizeRpcError({ code: 'NETWORK', message: 'Network error' }, 'getAccount');
    expect(error).toBeInstanceOf(NetworkError);
    expect(error.message).toBe('Network error');
  });

  it('normalizeRpcError returns RpcError for other cases', () => {
    const error = normalizeRpcError({ message: 'Some RPC error' }, 'getTransaction');
    expect(error).toBeInstanceOf(RpcError);
    expect(error.message).toBe('Some RPC error');
  });

  it('normalizeTransactionError handles insufficient funds', () => {
    const error = normalizeTransactionError({ message: 'insufficient funds for transaction' }, 'hash123');
    expect(error).toBeInstanceOf(InsufficientFundsError);
    expect(error.message).toBe('Insufficient funds for transaction (hash123)');
  });

  it('normalizeTransactionError handles invalid signature', () => {
    const error = normalizeTransactionError({ message: 'invalid signature' }, 'hash456');
    expect(error).toBeInstanceOf(InvalidSignatureError);
    expect(error.message).toBe('Invalid signature for transaction (hash456)');
  });

  it('normalizeTransactionError returns TransactionError for other cases', () => {
    const error = normalizeTransactionError({ message: 'Some transaction error' });
    expect(error).toBeInstanceOf(TransactionError);
    expect(error.message).toBe('Some transaction error');
  });

  it('normalizeContractError creates ContractError', () => {
    const error = normalizeContractError({ message: 'Contract reverted' }, 'contract123', 'deposit');
    expect(error).toBeInstanceOf(ContractError);
    expect(error.message).toBe('Contract call failed: deposit on contract123');
  });

  it('normalizeSimulationError creates SimulationError', () => {
    const error = normalizeSimulationError({ message: 'Simulation failed' });
    expect(error).toBeInstanceOf(SimulationError);
    expect(error.message).toBe('Simulation failed');
  });
});
