# RPC Boundary Testing

This document explains how to perform boundary testing for the Axionvera SDK's interaction with Soroban RPC nodes without making real network calls.

## Overview

Boundary testing ensures that the SDK constructs RPC requests correctly (method names, payload shapes, headers) and handles RPC responses (success results, error codes, timeouts) as expected. By using mocked transports, contributors can run these tests in offline environments.

## Core Concepts

### 1. `FetchRpcTransport` Injection

The SDK uses `FetchRpcTransport` to handle all JSON-RPC 2.0 communication. You can inject a custom `fetch` implementation to intercept outgoing requests:

```typescript
const mockFetch = vi.fn().mockResolvedValue({
  ok: true,
  status: 200,
  json: () => Promise.resolve({
    jsonrpc: '2.0',
    id: 1,
    result: { status: 'healthy' }
  })
});

const transport = new FetchRpcTransport('https://rpc.example.com', mockFetch);
const client = new AxionveraClient({ transport });
```

### 2. Verifying Payload Shapes

When testing boundary conditions, verify the `body` of the intercepted request:

```typescript
it('sends correct payload for getTransaction', async () => {
  await client.getTransaction('tx_123');
  
  const body = JSON.parse(mockFetch.mock.calls[0][1].body);
  expect(body.method).toBe('getTransaction');
  expect(body.params).toEqual({ hash: 'tx_123' });
});
```

### 3. Testing RPC Errors

Soroban RPC errors (e.g., `-32601 Method not found`) should be mapped to `NetworkError`:

```typescript
mockFetch.mockResolvedValue({
  ok: true,
  status: 200,
  json: () => Promise.resolve({
    jsonrpc: '2.0',
    id: 1,
    error: { code: -32601, message: 'Method not found' }
  })
});

await expect(client.getHealth()).rejects.toThrow(NetworkError);
```

## Supported RPC Methods

The SDK currently supports the following RPC methods in "live-mode":

| Method | Params | SDK Entry Point |
| --- | --- | --- |
| `getHealth` | None | `client.getHealth()` |
| `getTransaction` | `{ hash: string }` | `client.getTransaction(hash)` |
| `sendTransaction` | `{ transaction: string }` | `client.sendTransaction(xdr)` |
| `simulateTransaction` | `{ transaction: string }` | `client.simulateTransaction(xdr)` |

## Best Practices

1. **Never make real network calls** in unit or integration tests. Use `vi.fn()` or a library like `msw` for larger suites.
2. **Verify method names** match the Soroban RPC specification.
3. **Check incrementing IDs**: Each call through a single `FetchRpcTransport` instance should increment the `id` field.
4. **Test non-terminal states**: For `getTransaction`, test how the SDK handles `pending` vs `success` vs `failed` statuses.

For a complete example, see `examples/rpc-boundary-mocking.ts`.
