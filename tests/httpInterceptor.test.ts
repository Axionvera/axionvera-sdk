import { createHttpClientWithRetry, retry, RetryConfig, DEFAULT_RETRY_CONFIG } from '../src/utils/httpInterceptor';
import axios from 'axios';
import { NetworkError, ValidationError } from '../src/errors/axionveraError';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('HTTP Interceptor', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('createHttpClientWithRetry', () => {
    it('should create axios instance with default config', () => {
      mockedAxios.create = jest.fn().mockReturnValue({
        interceptors: {
          response: {
            use: jest.fn()
          }
        }
      });

      createHttpClientWithRetry();

      expect(mockedAxios.create).toHaveBeenCalledWith({
        timeout: 30000,
      });
    });

    it('should create axios instance with custom config', () => {
      mockedAxios.create = jest.fn().mockReturnValue({
        interceptors: {
          response: {
            use: jest.fn()
          }
        }
      });

      const customConfig: Partial<RetryConfig> = {
        maxRetries: 5,
        baseDelayMs: 2000
      };

      createHttpClientWithRetry(customConfig);

      expect(mockedAxios.create).toHaveBeenCalledWith({
        timeout: 30000,
      });
    });

    it('should disable retries when enabled is false', () => {
      mockedAxios.create = jest.fn().mockReturnValue({
        interceptors: {
          response: {
            use: jest.fn()
          }
        }
      });

      createHttpClientWithRetry({ enabled: false });

      expect(mockedAxios.create).toHaveBeenCalledWith({
        timeout: 30000,
      });
    });
  });

  describe('retry function', () => {
    it('should return result on first successful attempt', async () => {
      const mockFn = jest.fn().mockResolvedValue('success');
      
      const result = await retry(mockFn);
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should retry on retryable error', async () => {
      const mockFn = jest.fn()
        .mockRejectedValueOnce({ response: { status: 500 } })
        .mockResolvedValue('success');
      
      const result = await retry(mockFn, { maxRetries: 2 });
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(2);
    });

    it('should not retry on non-retryable error', async () => {
      const mockFn = jest.fn().mockRejectedValue({ response: { status: 400 } });

      let thrown: unknown;
      try {
        await retry(mockFn, { maxRetries: 2 });
      } catch (error: unknown) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(ValidationError);
      expect(thrown).toMatchObject({ statusCode: 400 });
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should not retry on error without response', async () => {
      const mockFn = jest.fn().mockRejectedValue(new Error('Network error'));
      
      await expect(retry(mockFn, { maxRetries: 2 })).rejects.toThrow('Network error');
      expect(mockFn).toHaveBeenCalledTimes(1);
    });

    it('should fail after max retries', async () => {
      const mockFn = jest.fn().mockRejectedValue({ response: { status: 500 } });

      let thrown: unknown;
      try {
        await retry(mockFn, { maxRetries: 2 });
      } catch (error: unknown) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(NetworkError);
      expect(thrown).toMatchObject({ statusCode: 500 });
      expect(mockFn).toHaveBeenCalledTimes(3); // 1 initial + 2 retries
    });

    it('should respect exponential backoff', async () => {
      const mockFn = jest.fn()
        .mockRejectedValueOnce({ response: { status: 500 } })
        .mockRejectedValueOnce({ response: { status: 500 } })
        .mockResolvedValue('success');
      
      const startTime = Date.now();
      await retry(mockFn, { maxRetries: 2, baseDelayMs: 100 });
      const endTime = Date.now();
      
      expect(endTime - startTime).toBeGreaterThanOrEqual(100); // At least 100ms delay
      expect(mockFn).toHaveBeenCalledTimes(3);
    });

    it('should not retry when disabled', async () => {
      const mockFn = jest.fn().mockRejectedValue({ response: { status: 500 } });

      let thrown: unknown;
      try {
        await retry(mockFn, { enabled: false });
      } catch (error: unknown) {
        thrown = error;
      }

      expect(thrown).toBeInstanceOf(NetworkError);
      expect(thrown).toMatchObject({ statusCode: 500 });
      expect(mockFn).toHaveBeenCalledTimes(1);
    });
  });

  describe('DEFAULT_RETRY_CONFIG', () => {
    it('should have correct default values', () => {
      expect(DEFAULT_RETRY_CONFIG.enabled).toBe(true);
      expect(DEFAULT_RETRY_CONFIG.maxRetries).toBe(3);
      expect(DEFAULT_RETRY_CONFIG.baseDelayMs).toBe(1000);
      expect(DEFAULT_RETRY_CONFIG.maxDelayMs).toBe(8000);
      expect(DEFAULT_RETRY_CONFIG.retryableMethods).toEqual(['GET', 'PUT']);
      expect(DEFAULT_RETRY_CONFIG.retryableStatusCodes).toEqual([429, 500, 502, 503, 504]);
    });
  });
});
