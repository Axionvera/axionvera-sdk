type ErrorHeaderContainer = {
  get?: (name: string) => string | undefined;
  [key: string]: unknown;
};

type ErrorResponseLike = {
  status?: unknown;
  headers?: ErrorHeaderContainer;
  data?: unknown;
};

type ErrorLike = {
  message?: unknown;
  code?: unknown;
  status?: unknown;
  requestId?: unknown;
  response?: ErrorResponseLike;
};

export type AxionveraErrorOptions = {
  statusCode?: number;
  requestId?: string;
  originalError?: unknown;
};

export class AxionveraError extends Error {
  readonly statusCode?: number;
  readonly requestId?: string;
  readonly originalError?: unknown;

  constructor(message: string, options: AxionveraErrorOptions = {}) {
    super(message);
    this.name = new.target.name;
    this.statusCode = options.statusCode;
    this.requestId = options.requestId;
    this.originalError = options.originalError;
  }
}

export class NetworkError extends AxionveraError {}

export class AuthenticationError extends AxionveraError {}

export class RateLimitError extends AxionveraError {}

export class ValidationError extends AxionveraError {}

export class StellarRpcNetworkError extends AxionveraError {}

export class StellarRpcResponseError extends AxionveraError {}

export class StellarRpcTimeoutError extends AxionveraError {}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asErrorLike(error: unknown): ErrorLike {
  return isObject(error) ? (error as ErrorLike) : {};
}

function getHeaderValue(headers: ErrorHeaderContainer | undefined, key: string): string | undefined {
  if (!headers) {
    return undefined;
  }

  if (typeof headers.get === "function") {
    const headerValue = headers.get(key) ?? headers.get(key.toLowerCase());
    if (typeof headerValue === "string") {
      return headerValue;
    }
  }

  const direct = headers[key] ?? headers[key.toLowerCase()] ?? headers[key.toUpperCase()];
  return typeof direct === "string" ? direct : undefined;
}

function getMessageFromResponseData(data: unknown): string | undefined {
  if (typeof data === "string") {
    return data;
  }

  if (!isObject(data)) {
    return undefined;
  }

  const message = data.message;
  if (typeof message === "string" && message.trim().length > 0) {
    return message;
  }

  const error = data.error;
  if (typeof error === "string" && error.trim().length > 0) {
    return error;
  }

  return undefined;
}

export function getErrorStatusCode(error: unknown): number | undefined {
  if (error instanceof AxionveraError) {
    return error.statusCode;
  }

  const errorLike = asErrorLike(error);
  const responseStatus = errorLike.response?.status;
  if (typeof responseStatus === "number") {
    return responseStatus;
  }

  if (typeof errorLike.status === "number") {
    return errorLike.status;
  }

  return undefined;
}

export function getErrorRequestId(error: unknown): string | undefined {
  if (error instanceof AxionveraError) {
    return error.requestId;
  }

  const errorLike = asErrorLike(error);
  const headers = errorLike.response?.headers;

  return (
    getHeaderValue(headers, "x-request-id") ??
    getHeaderValue(headers, "x-requestid") ??
    getHeaderValue(headers, "request-id") ??
    getHeaderValue(headers, "x-correlation-id") ??
    (typeof errorLike.requestId === "string" ? errorLike.requestId : undefined)
  );
}

function getErrorMessage(error: unknown, fallbackMessage: string): string {
  if (error instanceof Error && error.message.trim().length > 0) {
    return error.message;
  }

  const errorLike = asErrorLike(error);
  if (typeof errorLike.message === "string" && errorLike.message.trim().length > 0) {
    return errorLike.message;
  }

  const messageFromResponse = getMessageFromResponseData(errorLike.response?.data);
  if (messageFromResponse) {
    return messageFromResponse;
  }

  return fallbackMessage;
}

function isNetworkCode(errorCode: unknown): boolean {
  if (typeof errorCode !== "string") {
    return false;
  }

  return [
    "ECONNABORTED",
    "ECONNRESET",
    "ENOTFOUND",
    "ETIMEDOUT",
    "ERR_NETWORK"
  ].includes(errorCode);
}

export function toAxionveraError(error: unknown, fallbackMessage = "API request failed"): AxionveraError {
  if (error instanceof AxionveraError) {
    return error;
  }

  const statusCode = getErrorStatusCode(error);
  const requestId = getErrorRequestId(error);
  const message = getErrorMessage(error, fallbackMessage);
  const errorLike = asErrorLike(error);

  const options: AxionveraErrorOptions = {
    statusCode,
    requestId,
    originalError: error
  };

  if (errorLike.code === 'ETIMEDOUT') {
    return new StellarRpcTimeoutError(message, options);
  }

  if (isNetworkCode(errorLike.code)) {
    return new StellarRpcNetworkError(message, options);
  }

  if (statusCode !== undefined && statusCode >= 400) {
    return new StellarRpcResponseError(message, options);
  }

  if (statusCode === 401 || statusCode === 403) {
    return new AuthenticationError(message, options);
  }

  if (statusCode === 429) {
    return new RateLimitError(message, options);
  }

  if (statusCode !== undefined && statusCode >= 400 && statusCode < 500) {
    return new ValidationError(message, options);
  }

  if (statusCode === undefined || statusCode >= 500 || isNetworkCode(errorLike.code)) {
    return new NetworkError(message, options);
  }

  return new AxionveraError(message, options);
}
