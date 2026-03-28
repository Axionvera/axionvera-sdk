import {
  AuthenticationError,
  AxionveraError,
  NetworkError,
  RateLimitError,
  ValidationError,
  toAxionveraError
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
