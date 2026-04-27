# HTTP Interceptor with Exponential Backoff and Retries

This feature adds automatic retry functionality to the Axionvera SDK to make it resilient against temporary network blips and backend rate limits.

## Features

- **Automatic Retries**: Configurable retry logic for failed HTTP requests
- **Exponential Backoff**: Implements exponential backoff algorithm (1s, 2s, 4s, etc.)
- **Retry-After Support**: Respects the standard `Retry-After` header on 429 (Too Many Requests) responses
- **Idempotent Operations Only**: Only retries safe operations (GET, PUT)
- **Configurable**: Full control over retry behavior via configuration
- **Status Code Filtering**: Retries on specific HTTP status codes (429, 5xx)

## Usage

### Basic Usage (Default Configuration)

```typescript
import { StellarClient } from 'axionvera-sdk';

// Uses default retry configuration
const client = new StellarClient();

// These methods will automatically retry on failure
await client.getHealth();
await client.getNetwork();
await client.getLatestLedger();
await client.getAccount(publicKey);
await client.getTransaction(hash);
```

### Custom Retry Configuration

```typescript
import { StellarClient } from 'axionvera-sdk';

const client = new StellarClient({
  retryConfig: {
    enabled: true,           // Enable/disable retries
    maxRetries: 5,           // Maximum number of retry attempts
    baseDelayMs: 500,        // Initial delay in milliseconds
    maxDelayMs: 10000,       // Maximum delay in milliseconds
    retryableMethods: ['GET', 'PUT'], // HTTP methods to retry
    retryableStatusCodes: [429, 500, 502, 503, 504] // Status codes to retry
  }
});
```

### Disable Retries

```typescript
const client = new StellarClient({
  retryConfig: {
    enabled: false
  }
});
```

## Default Configuration

```typescript
{
  enabled: true,
  maxRetries: 3,
  baseDelayMs: 1000,     // Start with 1 second delay
  maxDelayMs: 8000,      // Maximum delay of 8 seconds
  retryableMethods: ['GET', 'PUT'],
  retryableStatusCodes: [429, 500, 502, 503, 504]
}
```

## Exponential Backoff Algorithm

The delay between retries follows this logic:

1. **Priority Header**: If a `429 Too Many Requests` response includes a `Retry-After` header, the SDK pauses execution for the exact duration specified (supporting both seconds and HTTP-date formats), capped at `maxDelayMs` for safety.
2. **Fallback Backoff**: If the header is missing or for other status codes, it uses exponential backoff:
   - Attempt 1: 1 second (1000ms)
   - Attempt 2: 2 seconds (2000ms)
   - Attempt 3: 4 seconds (4000ms)
   - Attempt 4: 8 seconds (8000ms, capped at `maxDelayMs`)

A 20% random jitter is applied to exponential backoff calculations to prevent "thundering herd" issues.

## Which Operations Are Retried?

Only **idempotent** operations are automatically retried:

- ✅ `getHealth()` - GET request
- ✅ `getNetwork()` - GET request
- ✅ `getLatestLedger()` - GET request
- ✅ `getAccount()` - GET request
- ✅ `getTransaction()` - GET request

These operations are **not** retried (non-idempotent):

- ❌ `simulateTransaction()` - POST request
- ❌ `prepareTransaction()` - POST request
- ❌ `sendTransaction()` - POST request

## Advanced Usage

### Using the Retry Utility Directly

```typescript
import { retry, RetryConfig } from 'axionvera-sdk';

const customRetryConfig: Partial<RetryConfig> = {
  maxRetries: 3,
  baseDelayMs: 1000,
  enabled: true
};

const result = await retry(async () => {
  // Your custom async operation
  const response = await fetch('https://api.example.com/data');
  if (!response.ok) {
    throw { response: { status: response.status } };
  }
  return response.json();
}, customRetryConfig);
```

### Creating Custom HTTP Client

```typescript
import { createHttpClientWithRetry } from 'axionvera-sdk';

const httpClient = createHttpClientWithRetry({
  maxRetries: 5,
  baseDelayMs: 2000
});

// Use with axios interceptors
const response = await httpClient.get('https://api.example.com/data');
```

## Error Handling

When all retries are exhausted, the original error is thrown. You can catch and handle these errors:

```typescript
try {
  const health = await client.getHealth();
  console.log('Success:', health);
} catch (error) {
  if (error.response?.status === 429) {
    console.log('Rate limit exceeded even after retries');
  } else if (error.response?.status >= 500) {
    console.log('Server error after retries');
  } else {
    console.log('Other error:', error.message);
  }
}
```

## Configuration Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `enabled` | boolean | `true` | Enable or disable retry logic |
| `maxRetries` | number | `3` | Maximum number of retry attempts |
| `baseDelayMs` | number | `1000` | Initial delay in milliseconds |
| `maxDelayMs` | number | `8000` | Maximum delay in milliseconds |
| `retryableMethods` | string[] | `['GET', 'PUT']` | HTTP methods to retry |
| `retryableStatusCodes` | number[] | `[429, 500, 502, 503, 504]` | HTTP status codes to retry |

## Implementation Details

- Uses Axios for HTTP client functionality
- Implements exponential backoff with jitter
- Respects HTTP method idempotency
- Configurable via `StellarClientOptions`
- Fully tested with Jest test suite
- TypeScript types included

## Testing

The retry functionality is fully tested:

```bash
npm test
```

Test files:
- `tests/httpInterceptor.test.ts` - Core retry logic tests
- `tests/stellarClient.retry.test.ts` - StellarClient integration tests
