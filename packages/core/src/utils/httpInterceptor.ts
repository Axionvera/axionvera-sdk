import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios';
import { getErrorStatusCode, toAxionveraError } from '../errors/axionveraError';
import { Logger } from './logger';

/**
 * Configuration for retry behavior.
 */
export interface RetryConfig {
  /** Whether retries are enabled */
  enabled: boolean;
  /** Maximum number of retry attempts */
  maxRetries: number;
  /** Base delay between retries in milliseconds */
  baseDelayMs: number;
  /** Maximum delay between retries in milliseconds */
  maxDelayMs: number;
  /** HTTP methods that should be retried */
  retryableMethods: string[];
  /** HTTP status codes that should trigger a retry */
  retryableStatusCodes: number[];
}

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  enabled: true,
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 8000,
  retryableMethods: ['GET', 'PUT'],
  retryableStatusCodes: [429, 500, 502, 503, 504]
};

// Internal logger instance
const logger = new Logger('info');

function calculateDelay(attemptNumber: number, baseDelayMs: number, maxDelayMs: number): number {
  const delay = baseDelayMs * Math.pow(2, attemptNumber - 1);
  const jitter = delay * 0.2 * (Math.random() - 0.5);
  return Math.min(delay + jitter, maxDelayMs);
}

/**
 * Extracts the delay from the Retry-After header if present.
 * Supports both decimal integer (seconds) and HTTP-date formats.
 */
function getRetryAfterDelay(error: unknown): number | undefined {
  const headers = (error as any)?.response?.headers;
  if (!headers) return undefined;

  // Axios normalizes headers to lowercase
  const retryAfter = headers['retry-after'];
  if (!retryAfter) return undefined;

  // Retry-After can be seconds (integer)
  const seconds = parseInt(retryAfter, 10);
  if (!isNaN(seconds)) {
    return seconds * 1000;
  }

  // Or an HTTP-date
  const date = Date.parse(retryAfter);
  if (!isNaN(date)) {
    return Math.max(0, date - Date.now());
  }

  return undefined;
}

function isRetryableRequest(config: AxiosRequestConfig, retryConfig: RetryConfig): boolean {
  const method = config.method?.toUpperCase();
  return method ? retryConfig.retryableMethods.includes(method) : false;
}

function isRetryableError(error: unknown, retryConfig: RetryConfig): boolean {
  const statusCode = getErrorStatusCode(error);
  if (statusCode === undefined) {
    return false;
  }

  return retryConfig.retryableStatusCodes.includes(statusCode);
}

function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Creates an Axios client with automatic retry interceptors.
 * @param retryConfig - Configuration for retry behavior
 * @returns An Axios instance with retry interceptors
 */
export function createHttpClientWithRetry(
  retryConfig: Partial<RetryConfig> = {}
): AxiosInstance {
  const config = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };

  const client = axios.create({
    timeout: 30000,
  });

  if (!config.enabled) {
    return client;
  }

  client.interceptors.response.use(
    (response: AxiosResponse) => response,
    async (error: AxiosError) => {
      const originalRequest = error.config as AxiosRequestConfig & { _retryCount?: number };

      if (!isRetryableRequest(originalRequest, config) || !isRetryableError(error, config)) {
        return Promise.reject(toAxionveraError(error));
      }

      originalRequest._retryCount = originalRequest._retryCount ?? 0;

      if (originalRequest._retryCount >= config.maxRetries) {
        return Promise.reject(toAxionveraError(error));
      }

      originalRequest._retryCount++;

      const statusCode = getErrorStatusCode(error);
      const retryAfterDelay = getRetryAfterDelay(error);

      // Use Retry-After if 429, but cap it at maxDelayMs for safety
      const delayMs = (statusCode === 429 && retryAfterDelay !== undefined)
        ? Math.min(retryAfterDelay, config.maxDelayMs)
        : calculateDelay(originalRequest._retryCount, config.baseDelayMs, config.maxDelayMs);
      
      logger.info('Retrying request', {
        attempt: originalRequest._retryCount,
        delay: delayMs,
        url: originalRequest.url,
        method: originalRequest.method,
        error: error instanceof Error ? error.message : String(error),
      });

      await delay(delayMs);

      return client(originalRequest);
    }
  );

  return client;
}

/**
 * Executes a function with automatic retries on failure.
 * Uses exponential backoff between retry attempts.
 * @param fn - The function to execute
 * @param retryConfig - Configuration for retry behavior
 * @returns The result of the function
 * @throws The last error if all retries are exhausted
 */
export async function retry<T>(
  fn: () => Promise<T>,
  retryConfig: Partial<RetryConfig> = {}
): Promise<T> {
  const config = { ...DEFAULT_RETRY_CONFIG, ...retryConfig };

  if (!config.enabled) {
    try {
      return await fn();
    } catch (error: unknown) {
      throw toAxionveraError(error);
    }
  }

  let lastError: unknown;

  for (let attempt = 1; attempt <= config.maxRetries + 1; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error;

      const statusCode = getErrorStatusCode(error);
      const isRetryable = statusCode !== undefined && config.retryableStatusCodes.includes(statusCode);

      if (!isRetryable || attempt > config.maxRetries) {
        throw toAxionveraError(error);
      }

      const retryAfterDelay = getRetryAfterDelay(error);

      // Use Retry-After if 429, but cap it at maxDelayMs for safety
      const delayMs = (statusCode === 429 && retryAfterDelay !== undefined)
        ? Math.min(retryAfterDelay, config.maxDelayMs)
        : calculateDelay(attempt, config.baseDelayMs, config.maxDelayMs);

      await delay(delayMs);
    }
  }

  throw toAxionveraError(lastError);
}
