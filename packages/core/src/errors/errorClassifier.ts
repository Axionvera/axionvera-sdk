import { AxionveraError } from './axionveraError';

export type ErrorCategory = 'retryable' | 'nonRetryable' | 'clientError' | 'serverError' | 'networkError';

export function classifyError(errorCode: number): ErrorCategory {
  if (errorCode >= 1000 && errorCode < 2000) {
    return 'networkError';
  }
  if (errorCode >= 2000 && errorCode < 3000) {
    return 'clientError';
  }
  if (errorCode >= 3000 && errorCode < 4000) {
    return 'retryable';
  }
  if (errorCode >= 4000 && errorCode < 5000) {
    return 'nonRetryable';
  }
  if (errorCode >= 5000 && errorCode < 6000) {
    return 'nonRetryable';
  }
  if (errorCode >= 6000 && errorCode < 7000) {
    return 'clientError';
  }
  if (errorCode >= 8000 && errorCode < 9000) {
    return 'retryable';
  }
  return 'nonRetryable';
}

export function isRetryable(errorCode: number): boolean {
  const category = classifyError(errorCode);
  return category === 'retryable' || category === 'networkError';
}

export function shouldRetry(error: AxionveraError): boolean {
  return error.code !== undefined && isRetryable(error.code);
}