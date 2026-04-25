/**
 * Example: How SDK consumers can use MSW handlers in their own application tests
 * 
 * This demonstrates the complete setup for testing an application that uses the Axionvera SDK
 */

import { StellarClient, server, setupMswTest, overrideHandlers, healthHandler, accountHandler } from '../src/index';

// Example 1: Basic MSW setup for consumer tests
describe('Consumer Application Tests with MSW', () => {
  let client: StellarClient;

  // Use the provided setup helper
  setupMswTest();

  beforeEach(() => {
    client = new StellarClient({
      network: 'testnet',
      retryConfig: {
        maxRetries: 2,
        enabled: true
      }
    });
  });

  it('should test application workflow with mocked Stellar API', async () => {
    // Test your application logic that uses the SDK
    const health = await client.getHealth();
    expect(health.status).toBe('healthy');
  });
});

// Example 2: Custom handlers for specific test scenarios
describe('Custom Test Scenarios', () => {
  let client: StellarClient;

  setupMswTest();

  beforeEach(() => {
    client = new StellarClient({ network: 'testnet' });
  });

  it('should handle rate limiting scenario', async () => {
    // Override the default handler for this specific test
    overrideHandlers(
      // Mock rate limit response
      healthHandler.use(
        (req, res, ctx) => {
          return res(
            ctx.status(429),
            ctx.json({ error: 'Rate limit exceeded' })
          );
        }
      )
    );

    // Test how your application handles rate limits
    await expect(client.getHealth()).rejects.toEqual(
      expect.objectContaining({
        response: expect.objectContaining({
          status: 429
        })
      })
    );
  });

  it('should handle account not found scenario', async () => {
    // Override account handler for specific test
    overrideHandlers(
      accountHandler.use(
        (req, res, ctx) => {
          return res(
            ctx.status(404),
            ctx.json({ error: 'Account not found' })
          );
        }
      )
    );

    await expect(client.getAccount('nonexistent-account')).rejects.toEqual(
      expect.objectContaining({
        response: expect.objectContaining({
          status: 404
        })
      })
    );
  });
});

// Example 3: Testing complex application workflows
describe('Complex Application Workflows', () => {
  let client: StellarClient;

  setupMswTest();

  beforeEach(() => {
    client = new StellarClient({
      network: 'testnet',
      retryConfig: {
        maxRetries: 3,
        baseDelayMs: 100,
        enabled: true
      }
    });
  });

  it('should test complete user onboarding flow', async () => {
    // Simulate a complete user onboarding workflow
    const accountId = 'GD5JPQ7VKFOVRWPOEX74JYXHHFNTFZ2JE5WZ4K2MWTROVHMWHD7KUZ2V';
    
    // Step 1: Check network health
    const health = await client.getHealth();
    expect(health.status).toBe('healthy');
    
    // Step 2: Get network configuration
    const network = await client.getNetwork();
    expect(network.passphrase).toBeDefined();
    
    // Step 3: Check if account exists
    try {
      const account = await client.getAccount(accountId);
      console.log('Account exists:', account.accountId());
    } catch (error) {
      console.log('Account does not exist, creating new account...');
      // Your application logic for creating a new account
    }
    
    // Step 4: Get latest ledger for transaction context
    const ledger = await client.getLatestLedger();
    expect(ledger.sequence).toBeDefined();
  });

  it('should test transaction submission workflow', async () => {
    // Mock a complete transaction workflow
    let transactionId = '';
    
    // Override handlers to track transaction submission
    overrideHandlers(
      // Mock transaction submission
      rest.post('https://soroban-testnet.stellar.org/transactions', (req, res, ctx) => {
        transactionId = 'generated-transaction-id-' + Date.now();
        return res(
          ctx.status(200),
          ctx.json({
            hash: transactionId,
            ledger: 123456,
            envelope_xdr: 'AAAAAgAAAAA...',
            result_xdr: 'AAAAAgAAAAA...',
            result_meta_xdr: 'AAAAAgAAAAA...'
          })
        );
      }),
      
      // Mock transaction retrieval
      rest.get(`https://soroban-testnet.stellar.org/transactions/:transactionId`, (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json({
            status: 'SUCCESS',
            latest_ledger: 123456,
            latest_ledger_close_time: 1640995200,
            oldest_ledger: 123450,
            oldest_ledger_close_time: 1640991600,
            application_order: 1,
            id: req.params.transactionId,
            hash: req.params.transactionId
          })
        );
      })
    );

    // Mock transaction
    const mockTransaction = {
      toXDR: () => 'AAAAAgAAAAA=='
    } as any;

    // Submit transaction
    const result = await client.sendTransaction(mockTransaction);
    expect(result.hash).toBe(transactionId);

    // Poll for completion
    const transaction = await client.pollTransaction(result.hash, {
      timeoutMs: 5000,
      intervalMs: 100
    });
    expect(transaction).toEqual(expect.objectContaining({
      status: 'SUCCESS'
    }));
  });
});

// Example 4: Performance testing with MSW
describe('Performance Tests', () => {
  let client: StellarClient;

  setupMswTest();

  beforeEach(() => {
    client = new StellarClient({ network: 'testnet' });
  });

  it('should handle concurrent requests efficiently', async () => {
    const startTime = Date.now();
    
    // Create multiple concurrent requests
    const promises = Array(20).fill(null).map(async (_, index) => {
      const health = await client.getHealth();
      return { index, health };
    });
    
    const results = await Promise.all(promises);
    const endTime = Date.now();
    
    // Verify all requests succeeded
    expect(results).toHaveLength(20);
    results.forEach(result => {
      expect(result.health).toEqual({ status: 'healthy', version: '20.0.0' });
    });
    
    // Verify performance (should complete reasonably quickly)
    const duration = endTime - startTime;
    console.log(`Completed 20 concurrent requests in ${duration}ms`);
    expect(duration).toBeLessThan(5000); // Should complete within 5 seconds
  });
});

// Example 5: Integration with testing frameworks
describe('Framework Integration Examples', () => {
  // Example of how to integrate with different testing frameworks
  
  it('should work with Jest (as shown above)', async () => {
    const client = new StellarClient({ network: 'testnet' });
    const health = await client.getHealth();
    expect(health.status).toBe('healthy');
  });

  // Example for Vitest (if using Vitest instead of Jest)
  /*
  import { beforeAll, afterEach, afterAll, expect, test } from 'vitest';
  import { server } from '../src/test/msw/server';

  beforeAll(() => server.listen());
  afterEach(() => server.resetHandlers());
  afterAll(() => server.close());

  test('should work with Vitest', async () => {
    const client = new StellarClient({ network: 'testnet' });
    const health = await client.getHealth();
    expect(health.status).toBe('healthy');
  });
  */
});

// Example 6: Custom mock data for specific scenarios
describe('Custom Mock Data Scenarios', () => {
  let client: StellarClient;

  setupMswTest();

  beforeEach(() => {
    client = new StellarClient({ network: 'testnet' });
  });

  it('should test with custom account data', async () => {
    const customAccountData = {
      id: 'CUSTOM_ACCOUNT_ID',
      account_id: 'CUSTOM_ACCOUNT_ID',
      sequence: 999999999,
      subentry_count: 5,
      last_modified_ledger: 999999,
      threshold: { low_threshold: 2, med_threshold: 3, high_threshold: 4 },
      flags: { auth_required: true, auth_revocable: true, auth_immutable: false },
      balances: [
        { balance: '5000.0000000', asset_type: 'native' },
        { balance: '1000.0000000', asset_type: 'credit_alphanum4', asset_code: 'USD', asset_issuer: 'ISSUER_ID' }
      ],
      signers: [
        { key: 'SIGNER_KEY_1', weight: 2 },
        { key: 'SIGNER_KEY_2', weight: 1 }
      ],
      data: {
        custom_key: 'custom_value'
      }
    };

    overrideHandlers(
      rest.get('https://soroban-testnet.stellar.org/accounts/:accountId', (req, res, ctx) => {
        return res(
          ctx.status(200),
          ctx.json(customAccountData)
        );
      })
    );

    const account = await client.getAccount('CUSTOM_ACCOUNT_ID');
    expect(account.accountId()).toBe('CUSTOM_ACCOUNT_ID');
    // Test your application logic with this custom data
  });
});

// Export examples for documentation
export const MSW_USAGE_EXAMPLES = {
  basicSetup: `
import { setupMswTest, StellarClient } from 'axionvera-sdk';

describe('My App Tests', () => {
  setupMswTest();
  
  it('should work', async () => {
    const client = new StellarClient();
    const health = await client.getHealth();
    expect(health.status).toBe('healthy');
  });
});
  `,
  
  customHandlers: `
import { overrideHandlers, rest } from 'axionvera-sdk';

it('should test error scenario', async () => {
  overrideHandlers(
    rest.get('https://soroban-testnet.stellar.org/health', (req, res, ctx) => {
      return res(ctx.status(500));
    })
  );
  
  // Test your error handling
});
  `
};
