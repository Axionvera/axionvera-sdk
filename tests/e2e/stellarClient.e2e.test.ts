import { StellarClient } from '../../src/client/stellarClient';
import { server, setupMswTest, overrideHandlers, rateLimitHandler, serverErrorHandler } from '../../src/test/msw/server';
import { rest } from 'msw';

describe('StellarClient E2E Tests with MSW', () => {
  let client: StellarClient;

  beforeAll(() => {
    setupMswTest();
  });

  beforeEach(() => {
    client = new StellarClient({
      network: 'testnet',
      retryConfig: {
        maxRetries: 2,
        baseDelayMs: 100,
        enabled: true
      }
    });
  });

  describe('Basic SDK Operations', () => {
    it('should perform complete health check workflow', async () => {
      const health = await client.getHealth();
      expect(health).toEqual({
        status: 'healthy',
        version: '20.0.0'
      });
    });

    it('should perform complete network info workflow', async () => {
      const network = await client.getNetwork();
      expect(network).toEqual({
        friendbot_url: 'https://friendbot.stellar.org',
        passphrase: 'Test SDF Network ; September 2015',
        protocol_version: 20
      });
    });

    it('should perform complete ledger workflow', async () => {
      const ledger = await client.getLatestLedger();
      expect(ledger).toEqual({
        id: '12345',
        protocol_version: 20,
        sequence: 123456
      });
    });

    it('should perform complete account workflow', async () => {
      const accountId = 'GD5JPQ7VKFOVRWPOEX74JYXHHFNTFZ2JE5WZ4K2MWTROVHMWHD7KUZ2V';
      const account = await client.getAccount(accountId);
      
      expect(account).toBeDefined();
      expect(account.accountId()).toBe(accountId);
    });

    it('should perform complete transaction workflow', async () => {
      const transactionId = 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456';
      const transaction = await client.getTransaction(transactionId);
      
      expect(transaction).toBeDefined();
      expect(transaction).toEqual(expect.objectContaining({
        status: 'SUCCESS',
        latest_ledger: 123456
      }));
    });
  });

  describe('Complex Transaction Workflows', () => {
    it('should handle complete transaction simulation workflow', async () => {
      // Mock transaction
      const mockTransaction = {
        toXDR: () => 'AAAAAgAAAAA=='
      } as any;

      const simulation = await client.simulateTransaction(mockTransaction);
      
      expect(simulation).toBeDefined();
      expect(simulation.transaction_data).toBeDefined();
      expect(simulation.results).toBeDefined();
      expect(simulation.cost).toBeDefined();
    });

    it('should handle complete transaction preparation workflow', async () => {
      // Mock transaction
      const mockTransaction = {
        toXDR: () => 'AAAAAgAAAAA=='
      } as any;

      const prepared = await client.prepareTransaction(mockTransaction);
      
      expect(prepared).toBeDefined();
      expect(prepared.toXDR).toBeDefined();
    });

    it('should handle complete transaction submission workflow', async () => {
      // Mock transaction
      const mockTransaction = {
        toXDR: () => 'AAAAAgAAAAA=='
      } as any;

      const result = await client.sendTransaction(mockTransaction);
      
      expect(result).toBeDefined();
      expect(result.hash).toBeDefined();
      expect(result.status).toBeDefined();
      expect(result.raw).toBeDefined();
    });
  });

  describe('Error Handling and Retry Logic', () => {
    it('should retry on rate limit errors and eventually succeed', async () => {
      let callCount = 0;
      
      overrideHandlers(
        rest.get('https://soroban-testnet.stellar.org/health', (req, res, ctx) => {
          callCount++;
          if (callCount <= 2) {
            return res(
              ctx.status(429),
              ctx.json({ error: 'Rate limit exceeded' })
            );
          }
          return res(
            ctx.status(200),
            ctx.json({ status: 'healthy', version: '20.0.0' })
          );
        })
      );

      const health = await client.getHealth();
      
      expect(callCount).toBe(3); // 2 failures + 1 success
      expect(health).toEqual({ status: 'healthy', version: '20.0.0' });
    });

    it('should retry on server errors and eventually succeed', async () => {
      let callCount = 0;
      
      overrideHandlers(
        rest.get('https://soroban-testnet.stellar.org/health', (req, res, ctx) => {
          callCount++;
          if (callCount <= 1) {
            return res(
              ctx.status(500),
              ctx.json({ error: 'Internal server error' })
            );
          }
          return res(
            ctx.status(200),
            ctx.json({ status: 'healthy', version: '20.0.0' })
          );
        })
      );

      const health = await client.getHealth();
      
      expect(callCount).toBe(2); // 1 failure + 1 success
      expect(health).toEqual({ status: 'healthy', version: '20.0.0' });
    });

    it('should fail after max retries are exhausted', async () => {
      overrideHandlers(
        rest.get('https://soroban-testnet.stellar.org/health', (req, res, ctx) => {
          return res(
            ctx.status(500),
            ctx.json({ error: 'Internal server error' })
          );
        })
      );

      await expect(client.getHealth()).rejects.toEqual(
        expect.objectContaining({
          response: expect.objectContaining({
            status: 500
          })
        })
      );
    });

    it('should handle 404 errors without retrying', async () => {
      overrideHandlers(
        rest.get('https://soroban-testnet.stellar.org/accounts/:accountId', (req, res, ctx) => {
          return res(
            ctx.status(404),
            ctx.json({ error: 'Account not found' })
          );
        })
      );

      const accountId = 'GD5JPQ7VKFOVRWPOEX74JYXHHFNTFZ2JE5WZ4K2MWTROVHMWHD7KUZ2V';
      
      await expect(client.getAccount(accountId)).rejects.toEqual(
        expect.objectContaining({
          response: expect.objectContaining({
            status: 404
          })
        })
      );
    });
  });

  describe('Multi-step Workflows', () => {
    it('should handle complete account analysis workflow', async () => {
      const accountId = 'GD5JPQ7VKFOVRWPOEX74JYXHHFNTFZ2JE5WZ4K2MWTROVHMWHD7KUZ2V';
      
      // Step 1: Check network health
      const health = await client.getHealth();
      expect(health.status).toBe('healthy');
      
      // Step 2: Get network info
      const network = await client.getNetwork();
      expect(network.passphrase).toBeDefined();
      
      // Step 3: Get latest ledger
      const ledger = await client.getLatestLedger();
      expect(ledger.sequence).toBeDefined();
      
      // Step 4: Get account details
      const account = await client.getAccount(accountId);
      expect(account.accountId()).toBe(accountId);
      
      // Step 5: Get recent transactions (mocked)
      const transactionId = 'a1b2c3d4e5f6789012345678901234567890abcdef1234567890abcdef123456';
      const transaction = await client.getTransaction(transactionId);
      expect(transaction).toBeDefined();
    });

    it('should handle complete transaction lifecycle workflow', async () => {
      // Mock transaction
      const mockTransaction = {
        toXDR: () => 'AAAAAgAAAAA=='
      } as any;

      // Step 1: Simulate transaction
      const simulation = await client.simulateTransaction(mockTransaction);
      expect(simulation.transaction_data).toBeDefined();

      // Step 2: Prepare transaction
      const prepared = await client.prepareTransaction(mockTransaction);
      expect(prepared.toXDR).toBeDefined();

      // Step 3: Send transaction
      const result = await client.sendTransaction(mockTransaction);
      expect(result.hash).toBeDefined();

      // Step 4: Poll for transaction completion
      const transaction = await client.pollTransaction(result.hash, {
        timeoutMs: 5000,
        intervalMs: 100
      });
      expect(transaction).toBeDefined();
    });

    it('should handle workflow with intermittent failures', async () => {
      let healthCallCount = 0;
      let accountCallCount = 0;
      
      overrideHandlers(
        rest.get('https://soroban-testnet.stellar.org/health', (req, res, ctx) => {
          healthCallCount++;
          if (healthCallCount === 1) {
            return res(
              ctx.status(500),
              ctx.json({ error: 'Internal server error' })
            );
          }
          return res(
            ctx.status(200),
            ctx.json({ status: 'healthy', version: '20.0.0' })
          );
        }),
        rest.get('https://soroban-testnet.stellar.org/accounts/:accountId', (req, res, ctx) => {
          accountCallCount++;
          if (accountCallCount === 1) {
            return res(
              ctx.status(429),
              ctx.json({ error: 'Rate limit exceeded' })
            );
          }
          return res(
            ctx.status(200),
            ctx.json({
              id: 'GD5JPQ7VKFOVRWPOEX74JYXHHFNTFZ2JE5WZ4K2MWTROVHMWHD7KUZ2V',
              account_id: 'GD5JPQ7VKFOVRWPOEX74JYXHHFNTFZ2JE5WZ4K2MWTROVHMWHD7KUZ2V',
              sequence: 123456789,
              subentry_count: 0,
              last_modified_ledger: 123456,
              threshold: { low_threshold: 1, med_threshold: 2, high_threshold: 3 },
              flags: { auth_required: false, auth_revocable: false, auth_immutable: false },
              balances: [{ balance: '1000.0000000', asset_type: 'native' }],
              signers: [{ key: 'GD5JPQ7VKFOVRWPOEX74JYXHHFNTFZ2JE5WZ4K2MWTROVHMWHD7KUZ2V', weight: 1 }],
              data: {}
            })
          );
        })
      );

      // Execute workflow with retries
      const health = await client.getHealth();
      const accountId = 'GD5JPQ7VKFOVRWPOEX74JYXHHFNTFZ2JE5WZ4K2MWTROVHMWHD7KUZ2V';
      const account = await client.getAccount(accountId);

      expect(healthCallCount).toBe(2); // 1 failure + 1 success
      expect(accountCallCount).toBe(2); // 1 failure + 1 success
      expect(health.status).toBe('healthy');
      expect(account.accountId()).toBe(accountId);
    });
  });

  describe('Network Configuration Tests', () => {
    it('should work with mainnet configuration', async () => {
      const mainnetClient = new StellarClient({
        network: 'mainnet',
        retryConfig: { maxRetries: 1, enabled: true }
      });

      const health = await mainnetClient.getHealth();
      expect(health).toEqual({
        status: 'healthy',
        version: '20.0.0'
      });
    });

    it('should work with custom RPC URL', async () => {
      const customClient = new StellarClient({
        rpcUrl: 'https://soroban-testnet.stellar.org',
        retryConfig: { maxRetries: 1, enabled: true }
      });

      const health = await customClient.getHealth();
      expect(health).toEqual({
        status: 'healthy',
        version: '20.0.0'
      });
    });
  });

  describe('Performance and Load Testing', () => {
    it('should handle multiple concurrent requests', async () => {
      const promises = [];
      
      // Create multiple concurrent requests
      for (let i = 0; i < 10; i++) {
        promises.push(client.getHealth());
      }

      const results = await Promise.all(promises);
      
      // All requests should succeed
      results.forEach(result => {
        expect(result).toEqual({
          status: 'healthy',
          version: '20.0.0'
        });
      });
    });

    it('should handle mixed sequential operations', async () => {
      const operations = [
        () => client.getHealth(),
        () => client.getNetwork(),
        () => client.getLatestLedger(),
        () => client.getTransaction('test-tx-id'),
        () => client.getAccount('GD5JPQ7VKFOVRWPOEX74JYXHHFNTFZ2JE5WZ4K2MWTROVHMWHD7KUZ2V')
      ];

      const results = await Promise.all(operations.map(op => op()));
      
      expect(results).toHaveLength(5);
      expect(results[0]).toEqual({ status: 'healthy', version: '20.0.0' });
      expect(results[1]).toEqual(expect.objectContaining({ passphrase: expect.any(String) }));
      expect(results[2]).toEqual(expect.objectContaining({ sequence: expect.any(Number) }));
      expect(results[3]).toEqual(expect.objectContaining({ status: 'SUCCESS' }));
      expect(results[4]).toBeDefined();
    });
  });
});
