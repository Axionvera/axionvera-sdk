# MSW E2E Testing Guide

This guide explains how to use Mock Service Worker (MSW) for end-to-end testing of the Axionvera SDK, enabling browser-like mocking capabilities for comprehensive testing scenarios.

## Overview

MSW allows you to mock HTTP requests at the network level, providing realistic testing environments that closely match production conditions. This is especially valuable for testing the SDK's retry logic, error handling, and complex workflows.

## Features

- **Browser-like mocking**: Tests behave exactly as they would in a real browser
- **Network-level interception**: Mocks HTTP requests before they reach the network
- **Comprehensive API coverage**: All Stellar RPC endpoints are mocked
- **Retry logic testing**: Test exponential backoff and retry behavior
- **Error scenario testing**: Test rate limiting, server errors, and network failures
- **Consumer-friendly**: Exported handlers for use in consumer applications

## Quick Start

### Basic Setup

```typescript
import { StellarClient, setupMswTest } from 'axionvera-sdk';

describe('My Application Tests', () => {
  // Setup MSW for all tests in this file
  setupMswTest();
  
  let client: StellarClient;
  
  beforeEach(() => {
    client = new StellarClient({
      network: 'testnet',
      retryConfig: {
        maxRetries: 3,
        enabled: true
      }
    });
  });

  it('should test basic functionality', async () => {
    const health = await client.getHealth();
    expect(health).toEqual({
      status: 'healthy',
      version: '20.0.0'
    });
  });
});
```

### Custom Error Scenarios

```typescript
import { overrideHandlers, rest } from 'axionvera-sdk';

it('should handle rate limiting', async () => {
  // Override default handler for this test
  overrideHandlers(
    rest.get('https://soroban-testnet.stellar.org/health', (req, res, ctx) => {
      return res(
        ctx.status(429),
        ctx.json({ error: 'Rate limit exceeded' })
      );
    })
  );

  await expect(client.getHealth()).rejects.toEqual(
    expect.objectContaining({
      response: expect.objectContaining({
        status: 429
      })
    })
  );
});
```

## Available Handlers

### Default Handlers

The SDK provides comprehensive handlers for all Stellar RPC endpoints:

- **Health endpoint**: `/health`
- **Network endpoint**: `/`
- **Ledger endpoints**: `/ledgers/:sequence`
- **Account endpoints**: `/accounts/:accountId`
- **Transaction endpoints**: `/transactions/:transactionId`
- **Transaction submission**: `/transactions`
- **Transaction simulation**: `/simulate_transaction`
- **Transaction preparation**: `/prepare_transaction`

### Individual Handlers

You can import and use individual handlers:

```typescript
import { 
  healthHandler, 
  accountHandler, 
  transactionHandler,
  rateLimitHandler,
  serverErrorHandler 
} from 'axionvera-sdk';

// Use default handlers
overrideHandlers(healthHandler);

// Or override them
overrideHandlers(
  healthHandler.use((req, res, ctx) => {
    return res(ctx.status(500));
  })
);
```

## Testing Scenarios

### 1. Basic SDK Operations

```typescript
describe('Basic Operations', () => {
  setupMswTest();
  
  it('should get network health', async () => {
    const health = await client.getHealth();
    expect(health.status).toBe('healthy');
  });

  it('should get account details', async () => {
    const account = await client.getAccount('GD5JPQ7VKFOVRWPOEX74JYXHHFNTFZ2JE5WZ4K2MWTROVHMWHD7KUZ2V');
    expect(account.accountId()).toBeDefined();
  });
});
```

### 2. Retry Logic Testing

```typescript
describe('Retry Logic', () => {
  setupMswTest();
  
  it('should retry on server errors', async () => {
    let callCount = 0;
    
    overrideHandlers(
      rest.get('https://soroban-testnet.stellar.org/health', (req, res, ctx) => {
        callCount++;
        if (callCount <= 2) {
          return res(ctx.status(500));
        }
        return res(ctx.json({ status: 'healthy', version: '20.0.0' }));
      })
    );

    const health = await client.getHealth();
    expect(callCount).toBe(3); // 2 failures + 1 success
    expect(health.status).toBe('healthy');
  });
});
```

### 3. Complex Workflows

```typescript
describe('Complex Workflows', () => {
  setupMswTest();
  
  it('should handle complete transaction lifecycle', async () => {
    const mockTransaction = { toXDR: () => 'AAAAAgAAAAA==' } as any;
    
    // Simulate transaction
    const simulation = await client.simulateTransaction(mockTransaction);
    expect(simulation.transaction_data).toBeDefined();
    
    // Prepare transaction
    const prepared = await client.prepareTransaction(mockTransaction);
    expect(prepared.toXDR).toBeDefined();
    
    // Send transaction
    const result = await client.sendTransaction(mockTransaction);
    expect(result.hash).toBeDefined();
    
    // Poll for completion
    const transaction = await client.pollTransaction(result.hash);
    expect(transaction).toBeDefined();
  });
});
```

### 4. Error Handling

```typescript
describe('Error Handling', () => {
  setupMswTest();
  
  it('should handle 404 errors', async () => {
    overrideHandlers(
      rest.get('https://soroban-testnet.stellar.org/accounts/:accountId', (req, res, ctx) => {
        return res(ctx.status(404));
      })
    );

    await expect(client.getAccount('nonexistent')).rejects.toEqual(
      expect.objectContaining({
        response: expect.objectContaining({ status: 404 })
      })
    );
  });

  it('should handle rate limiting', async () => {
    overrideHandlers(rateLimitHandler);
    
    await expect(client.getHealth()).rejects.toEqual(
      expect.objectContaining({
        response: expect.objectContaining({ status: 429 })
      })
    );
  });
});
```

## Configuration Options

### Jest Configuration

The SDK comes with pre-configured Jest projects for unit and E2E tests:

```json
{
  "jest": {
    "projects": [
      {
        "displayName": "Unit Tests",
        "testEnvironment": "node"
      },
      {
        "displayName": "E2E Tests",
        "testEnvironment": "jsdom",
        "setupFilesAfterEnv": ["<rootDir>/tests/e2e/setup.ts"]
      }
    ]
  }
}
```

### MSW Server Options

```typescript
import { server } from 'axionvera-sdk';

// Custom server setup
beforeAll(() => {
  server.listen({
    onUnhandledRequest: 'error' // or 'warn' or 'bypass'
  });
});

afterEach(() => {
  server.resetHandlers();
});

afterAll(() => {
  server.close();
});
```

## Mock Data

### Default Responses

The handlers provide realistic mock data:

```typescript
// Health response
{
  status: 'healthy',
  version: '20.0.0'
}

// Network response
{
  friendbot_url: 'https://friendbot.stellar.org',
  passphrase: 'Test SDF Network ; September 2015',
  protocol_version: 20
}

// Account response
{
  id: 'GD5JPQ7VKFOVRWPOEX74JYXHHFNTFZ2JE5WZ4K2MWTROVHMWHD7KUZ2V',
  account_id: 'GD5JPQ7VKFOVRWPOEX74JYXHHFNTFZ2JE5WZ4K2MWTROVHMWHD7KUZ2V',
  sequence: 123456789,
  balances: [{ balance: '1000.0000000', asset_type: 'native' }],
  // ... more fields
}
```

### Custom Mock Data

```typescript
overrideHandlers(
  rest.get('https://soroban-testnet.stellar.org/accounts/:accountId', (req, res, ctx) => {
    const customData = {
      id: req.params.accountId,
      balances: [
        { balance: '5000.0000000', asset_type: 'native' },
        { balance: '1000.0000000', asset_type: 'credit_alphanum4', asset_code: 'USD' }
      ]
    };
    
    return res(ctx.json(customData));
  })
);
```

## Performance Testing

### Concurrent Requests

```typescript
it('should handle concurrent requests', async () => {
  const promises = Array(20).fill(null).map(() => client.getHealth());
  const results = await Promise.all(promises);
  
  expect(results).toHaveLength(20);
  results.forEach(result => {
    expect(result.status).toBe('healthy');
  });
});
```

### Load Testing

```typescript
it('should handle high volume', async () => {
  const startTime = Date.now();
  
  for (let i = 0; i < 100; i++) {
    await client.getHealth();
  }
  
  const duration = Date.now() - startTime;
  console.log(`100 requests completed in ${duration}ms`);
  expect(duration).toBeLessThan(10000);
});
```

## Integration with Testing Frameworks

### Jest (Default)

```typescript
import { setupMswTest } from 'axionvera-sdk';

describe('Jest Tests', () => {
  setupMswTest();
  
  it('works with Jest', async () => {
    // Your test code
  });
});
```

### Vitest

```typescript
import { beforeAll, afterEach, afterAll } from 'vitest';
import { server } from 'axionvera-sdk';

beforeAll(() => server.listen());
afterEach(() => server.resetHandlers());
afterAll(() => server.close());

describe('Vitest Tests', () => {
  it('works with Vitest', async () => {
    // Your test code
  });
});
```

## Consumer Usage

SDK consumers can use the exported handlers in their own test suites:

```typescript
// In consumer application tests
import { 
  StellarClient, 
  setupMswTest, 
  overrideHandlers,
  healthHandler 
} from 'axionvera-sdk';

describe('My App Tests', () => {
  setupMswTest();
  
  it('should test my app with mocked Stellar API', async () => {
    const client = new StellarClient();
    const health = await client.getHealth();
    // Test your application logic
  });
});
```

## Best Practices

### 1. Test Organization

- Group related tests in describe blocks
- Use meaningful test names
- Setup and teardown properly

### 2. Mock Data Management

- Use consistent mock data across tests
- Reset handlers between tests
- Test both success and failure scenarios

### 3. Performance Considerations

- Keep test data small but realistic
- Use appropriate timeouts for async operations
- Test retry logic with reasonable delays

### 4. Error Testing

- Test all error conditions your app might encounter
- Verify error handling behavior
- Test retry exhaustion scenarios

## Troubleshooting

### Common Issues

1. **MSW not intercepting requests**
   - Ensure `setupMswTest()` is called
   - Check that Jest is using jsdom environment for E2E tests

2. **TypeScript errors**
   - Import types from 'msw' package
   - Ensure proper type annotations

3. **Test timeouts**
   - Increase timeout for retry tests
   - Use shorter delays in test configuration

### Debug Mode

```typescript
// Enable debug logging
beforeAll(() => {
  server.listen({
    onUnhandledRequest: 'warn'
  });
});
```

## Examples Repository

See `examples/mswExample.ts` for comprehensive usage examples covering:

- Basic setup and usage
- Custom handler scenarios
- Complex workflow testing
- Performance testing
- Framework integration
- Custom mock data

## API Reference

### Functions

- `setupMswTest()`: Setup MSW for test files
- `overrideHandlers(...handlers)`: Override default handlers
- `server.listen(options)`: Start MSW server
- `server.resetHandlers()`: Reset to default handlers
- `server.close()`: Stop MSW server

### Handlers

- `handlers`: Array of all default handlers
- `healthHandler`: Health endpoint handler
- `accountHandler`: Account endpoint handler
- `transactionHandler`: Transaction endpoint handler
- `submitTransactionHandler`: Transaction submission handler
- `rateLimitHandler`: Rate limit error handler
- `serverErrorHandler`: Server error handler
- `notFoundHandler`: Not found error handler

This comprehensive MSW integration provides robust testing capabilities for the Axionvera SDK, enabling thorough validation of SDK behavior in realistic scenarios.
