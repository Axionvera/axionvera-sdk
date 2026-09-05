# Request Throttling and Concurrency Control

This feature implements internal traffic control to prevent connection pool exhaustion and backend DDoS protection triggers when consumer applications make many simultaneous SDK method calls.

## Overview

The concurrency control system manages HTTP requests through a queue-based approach, ensuring that only a specified number of requests are active at any given time. Requests exceeding the limit are queued and executed asynchronously as active connections resolve.

## Features

- **Configurable Concurrency Limits**: Set maximum concurrent requests (default: 5)
- **Request Queuing**: FIFO queue preserves request order
- **Timeout Protection**: Queue timeout prevents indefinite waiting
- **Statistics**: Monitor active and queued requests in real-time
- **Error Handling**: Proper error propagation through the queue
- **Performance Optimization**: Prevents connection pool exhaustion

## Quick Start

### Basic Usage

```typescript
import { StellarClient } from 'axionvera-sdk';

// Create client with concurrency control
const client = new StellarClient({
  network: 'testnet',
  concurrencyConfig: {
    maxConcurrentRequests: 3,  // Limit to 3 concurrent requests
    queueTimeout: 10000        // 10 second queue timeout
  }
});

// All HTTP requests will be managed through the concurrency queue
const health = await client.getHealth();
const network = await client.getNetwork();
const account = await client.getAccount('...');
```

### Disable Concurrency Control

```typescript
// Concurrency control is opt-in
const client = new StellarClient({
  network: 'testnet'
  // No concurrencyConfig = no throttling
});
```

## Configuration Options

### ConcurrencyConfig

```typescript
interface ConcurrencyConfig {
  maxConcurrentRequests: number;    // Maximum concurrent requests
  queueTimeout?: number;            // Queue timeout in milliseconds (default: 30000)
}
```

### Default Configuration

```typescript
const DEFAULT_CONCURRENCY_CONFIG = {
  maxConcurrentRequests: 5,
  queueTimeout: 30000  // 30 seconds
};
```

## Advanced Usage

### Custom Concurrency Queue

```typescript
import { ConcurrencyQueue } from 'axionvera-sdk';

const queue = new ConcurrencyQueue({
  maxConcurrentRequests: 2,
  queueTimeout: 5000
});

// Execute custom operations with concurrency control
const result = await queue.execute(async () => {
  // Your async operation here
  return await someApiCall();
});
```

### Wrapping HTTP Clients

```typescript
import { createConcurrencyControlledClient } from 'axionvera-sdk';

const httpClient = {
  get: async (url: string) => { /* ... */ },
  post: async (url: string, data: any) => { /* ... */ }
};

const controlledClient = createConcurrencyControlledClient(httpClient, {
  maxConcurrentRequests: 3
});

// All method calls are now concurrency-controlled
const result = await controlledClient.get('/api/data');
```

### Dynamic Configuration

```typescript
const client = new StellarClient({
  concurrencyConfig: { maxConcurrentRequests: 3 }
});

// Check current stats
const stats = client.getConcurrencyStats();
console.log(stats);

// Configuration is immutable after creation
// For dynamic changes, create a new client
const newClient = new StellarClient({
  concurrencyConfig: { maxConcurrentRequests: 10 }
});
```

## Behavior and Guarantees

### Request Ordering

- **FIFO Queue**: Requests are executed in the order they are received
- **Fair Processing**: No request starvation in the queue
- **Preserved Semantics**: Async behavior is maintained

### Concurrency Limits

- **Hard Limit**: Never exceeds `maxConcurrentRequests` active requests
- **Queue Management**: Excess requests are queued, not rejected
- **Resource Protection**: Prevents connection pool exhaustion

### Error Handling

- **Error Propagation**: Errors are properly propagated through the queue
- **Isolation**: Failed requests don't block other queued requests
- **Cleanup**: Failed requests are removed from active count

### Timeout Behavior

- **Queue Timeout**: Requests waiting too long in queue are rejected
- **Execution Timeout**: No timeout for executing requests (network handles this)
- **Graceful Degradation**: Timeout errors are clearly identifiable

## Monitoring and Statistics

### Concurrency Statistics

```typescript
const stats = client.getConcurrencyStats();

// Output:
{
  enabled: true,
  activeRequests: 2,
  queuedRequests: 3,
  maxConcurrentRequests: 5,
  queueTimestamps: [1640995200000, 1640995200100, 1640995200200]
}
```

### Queue Statistics

```typescript
const queue = new ConcurrencyQueue({ maxConcurrentRequests: 3 });
const stats = queue.getStats();

console.log('Active:', stats.activeRequests);
console.log('Queued:', stats.queuedRequests);
console.log('Max Concurrent:', stats.maxConcurrentRequests);
```

## Performance Considerations

### When to Use Concurrency Control

**Recommended for:**
- High-frequency API calls
- Batch operations
- Real-time applications
- Mobile applications (limited connections)

**Not necessary for:**
- Simple, occasional API calls
- Low-traffic applications
- Development/testing environments

### Performance Impact

```typescript
// Example: 20 requests with different concurrency limits
const noControl = await timeFunction(() => 
  Promise.all(Array(20).fill().map(() => apiCall()))
); // ~100ms (but may overwhelm backend)

const withControl = await timeFunction(() => {
  const queue = new ConcurrencyQueue({ maxConcurrentRequests: 5 });
  return Promise.all(Array(20).fill().map(() => 
    queue.execute(() => apiCall())
  ));
}); // ~400ms (controlled, backend-friendly)
```

### Memory Usage

- **Queue Overhead**: Minimal (~50 bytes per queued request)
- **Active Tracking**: Constant memory regardless of queue size
- **Cleanup**: Automatic cleanup of completed/failed requests

## Best Practices

### 1. Choose Appropriate Limits

```typescript
// Good: Balanced for most applications
const client = new StellarClient({
  concurrencyConfig: { maxConcurrentRequests: 5 }
});

// For high-performance servers
const serverClient = new StellarClient({
  concurrencyConfig: { maxConcurrentRequests: 10 }
});

// For mobile/bandwidth-constrained environments
const mobileClient = new StellarClient({
  concurrencyConfig: { maxConcurrentRequests: 2 }
});
```

### 2. Handle Timeouts Gracefully

```typescript
try {
  const result = await client.getAccount(accountId);
} catch (error) {
  if (error.message.includes('timed out in queue')) {
    // Handle queue timeout
    console.warn('Request timed out, retrying...');
    // Implement retry logic
  } else {
    // Handle other errors
    throw error;
  }
}
```

### 3. Monitor Queue Health

```typescript
// Periodic monitoring
setInterval(() => {
  const stats = client.getConcurrencyStats();
  if (stats.enabled && stats.queuedRequests > 10) {
    console.warn('High queue depth:', stats.queuedRequests);
  }
}, 5000);
```

### 4. Batch Operations

```typescript
// Good: Batch similar operations
const accountIds = ['account1', 'account2', 'account3'];
const accounts = await Promise.all(
  accountIds.map(id => client.getAccount(id))
);

// Better: Use pagination for large datasets
for (const batch of chunkArray(accountIds, 50)) {
  const accounts = await Promise.all(
    batch.map(id => client.getAccount(id))
  );
  // Process batch
}
```

## Error Scenarios

### Queue Timeout

```typescript
// Request waits too long in queue
const client = new StellarClient({
  concurrencyConfig: { 
    maxConcurrentRequests: 1,
    queueTimeout: 1000  // 1 second timeout
  }
});

// Start a slow request
const slowPromise = client.getAccount('slow-account');

// Try another request (will timeout)
await client.getAccount('fast-account'); // Throws: "Request timed out in queue"
```

### Concurrency Limit Reached

```typescript
// All slots are busy, request is queued
const promises = Array(10).fill().map(() => client.getHealth());

// Requests 1-5 execute immediately
// Requests 6-10 are queued and execute as slots free up
const results = await Promise.all(promises);
```

## Integration Examples

### React Component

```typescript
function AccountBalance({ accountId }: { accountId: string }) {
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(false);
  
  const client = useMemo(() => new StellarClient({
    concurrencyConfig: { maxConcurrentRequests: 3 }
  }), []);

  useEffect(() => {
    setLoading(true);
    client.getAccount(accountId)
      .then(account => setBalance(account.balances[0]))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [accountId, client]);

  return <div>{loading ? 'Loading...' : balance}</div>;
}
```

### Express.js Backend

```typescript
import { StellarClient } from 'axionvera-sdk';

const client = new StellarClient({
  concurrencyConfig: { maxConcurrentRequests: 8 }
});

app.get('/api/account/:id', async (req, res) => {
  try {
    const account = await client.getAccount(req.params.id);
    res.json(account);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
```

### Batch Processing

```typescript
async function processAccountUpdates(accountIds: string[]) {
  const client = new StellarClient({
    concurrencyConfig: { maxConcurrentRequests: 5 }
  });

  const results = [];
  
  for (const batch of chunkArray(accountIds, 20)) {
    const batchResults = await Promise.all(
      batch.map(id => client.getAccount(id).catch(err => ({ id, error: err.message })))
    );
    results.push(...batchResults);
    
    // Small delay between batches to be nice to the API
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  return results;
}
```

## Troubleshooting

### Common Issues

1. **Requests timing out**
   - Increase `queueTimeout`
   - Check if `maxConcurrentRequests` is too low
   - Monitor queue depth with `getConcurrencyStats()`

2. **Slow performance**
   - Increase `maxConcurrentRequests` for better throughput
   - Check if operations are unnecessarily slow
   - Consider batching operations

3. **Memory leaks**
   - Ensure proper error handling
   - Clear queues on component unmount
   - Monitor queue size in production

### Debug Mode

```typescript
// Enable detailed logging
const client = new StellarClient({
  concurrencyConfig: { maxConcurrentRequests: 3 }
});

// Monitor queue health
const monitor = setInterval(() => {
  const stats = client.getConcurrencyStats();
  console.log('Queue stats:', stats);
}, 1000);

// Cleanup
process.on('SIGINT', () => {
  clearInterval(monitor);
  process.exit(0);
});
```

## API Reference

### Classes

#### `ConcurrencyQueue`

```typescript
class ConcurrencyQueue {
  constructor(config: ConcurrencyConfig);
  
  execute<T>(fn: () => Promise<T>): Promise<T>;
  getStats(): QueueStats;
  clearQueue(): void;
  updateConfig(config: Partial<ConcurrencyConfig>): void;
}
```

#### Functions

```typescript
function createConcurrencyControlledClient<T extends object>(
  client: T,
  config: ConcurrencyConfig
): T;
```

### Types

```typescript
interface ConcurrencyConfig {
  maxConcurrentRequests: number;
  queueTimeout?: number;
}

interface QueueStats {
  activeRequests: number;
  queuedRequests: number;
  maxConcurrentRequests: number;
  queueTimestamps: number[];
}
```

### StellarClient Methods

```typescript
class StellarClient {
  getConcurrencyStats(): ConcurrencyStats | {
    enabled: false;
    message: string;
  };
}
```

This concurrency control system provides robust traffic management for the Axionvera SDK, ensuring reliable operation under high load while protecting both client applications and backend services from overload.
