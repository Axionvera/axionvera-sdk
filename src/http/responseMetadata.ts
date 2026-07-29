/**
 * Utilities for extracting safe response metadata from HTTP / RPC responses.
 *
 * These helpers are intentionally **not** exported as part of the public API
 * surface. Consumers interact with metadata exclusively through the
 * `includeMeta` option on service methods.
 */

import type { ResponseMetadata, WithMetadata } from '../types';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Header extraction
// ---------------------------------------------------------------------------

/**
 * Extract a single header value from a headers object.
 * Handles both `Headers` (Fetch API) and plain `Record<string, string>`.
 */
function getHeader(
  headers: Headers | Record<string, string> | undefined,
  ...names: string[]
): string | undefined {
  if (!headers) return undefined;

  for (const name of names) {
    if (headers instanceof Headers) {
      const val = headers.get(name);
      if (val) return val;
    } else {
      // Plain object – try exact match first, then case-insensitive
      const lower = name.toLowerCase();
      for (const [key, value] of Object.entries(headers)) {
        if (key.toLowerCase() === lower) return value;
      }
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// Public helpers
// ---------------------------------------------------------------------------

/**
 * Generate a compact, sortable client-side request ID.
 * The ID embeds a timestamp prefix so support teams can roughly order
 * requests without decoding.
 */
export function generateRequestId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).slice(2, 10);
  return `axv-${timestamp}-${random}`;
}

/**
 * Build a {@link ResponseMetadata} object from raw request/response data.
 *
 * @param params.startTime - `Date.now()` captured before the request.
 * @param params.statusCode - HTTP status code (or a synthetic code for RPC).
 * @param params.operation - Logical operation name.
 * @param params.network - Stellar network identifier.
 * @param params.headers - Response headers (optional).
 */
export function buildResponseMetadata(params: {
  startTime: number;
  statusCode: number;
  operation: string;
  network?: string;
  headers?: Headers | Record<string, string>;
  clientRequestId?: string;
}): ResponseMetadata {
  const durationMs = Date.now() - params.startTime;
  const clientRequestId = params.clientRequestId ?? generateRequestId();

  const meta: ResponseMetadata = {
    timestamp: new Date(params.startTime).toISOString(),
    durationMs,
    clientRequestId,
    statusCode: params.statusCode,
    operation: params.operation,
  };

  if (params.network) {
    meta.network = params.network;
  }

  if (params.headers) {
    const requestId = getHeader(params.headers, 'x-request-id', 'x-amzn-requestid');
    if (requestId) meta.requestId = requestId;

    const correlationId = getHeader(params.headers, 'x-correlation-id');
    if (correlationId) meta.correlationId = correlationId;

    const traceId = getHeader(params.headers, 'traceparent', 'x-trace-id', 'x-amzn-trace-id', 'x-cloud-trace-context');
    if (traceId) meta.traceId = traceId;
  }

  return meta;
}

/**
 * Wrap a data payload together with metadata into a {@link WithMetadata}
 * envelope.
 */
export function wrapWithMetadata<T>(
  data: T,
  meta: ResponseMetadata,
): WithMetadata<T> {
  return { data, meta };
}

/**
 * Conditionally wrap the return value of a service method based on the
 * `includeMeta` flag.
 *
 * @example
 * ```ts
 * return maybeWrap(includeMeta, result, metadata);
 * // → T          when includeMeta is false / undefined
 * // → WithMetadata<T>  when includeMeta is true
 * ```
 */
export function maybeWrap<T>(
  includeMeta: boolean | undefined,
  data: T,
  meta: ResponseMetadata,
): T | WithMetadata<T> {
  if (includeMeta) {
    return wrapWithMetadata(data, meta);
  }
  return data;
}

/**
 * Build error metadata (safe subset) for use inside error paths.
 * Never includes response data – only correlation identifiers and timing.
 */
export function buildErrorMetadata(params: {
  startTime: number;
  operation: string;
  network?: string;
  statusCode?: number;
  headers?: Headers | Record<string, string>;
}): ResponseMetadata {
  return buildResponseMetadata({
    startTime: params.startTime,
    statusCode: params.statusCode ?? 0,
    operation: params.operation,
    network: params.network,
    headers: params.headers,
  });
}
