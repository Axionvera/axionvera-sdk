import { StellarClient } from '../../src/client/stellarClient';
import { server, setupMswTest, overrideHandlers } from '../../src/test/msw/server';
import { rest } from 'msw';

describe('Retry Logic E2E Tests with MSW', () => {
  let client: StellarClient;

  beforeAll(() => {
    setupMswTest();
  });

  beforeEach(() => {
    client = new StellarClient({
      network: 'testnet',
      retryConfig: {
        maxRetries: 3,
        baseDelayMs: 50, // Short delay for tests
        enabled: true
      }
    });
  });

  describe('Exponential Backoff Behavior', () => {
    it('should implement exponential backoff correctly', async () => {
      const callTimes: number[] = [];
      let callCount = 0;
      
      overrideHandlers(
        rest.get('https://soroban-testnet.stellar.org/health', (req, res, ctx) => {
          callTimes.push(Date.now());
          callCount++;
          
          if (callCount <= 3) {
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

      const startTime = Date.now();
      const health = await client.getHealth();
      const endTime = Date.now();

      expect(callCount).toBe(4); // 3 failures + 1 success
      expect(health).toEqual({ status: 'healthy', version: '20.0.0' });
      
      // Verify exponential backoff (approximately)
      // Delay 1: ~50ms, Delay 2: ~100ms, Delay 3: ~200ms
      const delay1 = callTimes[1] - callTimes[0];
      const delay2 = callTimes[2] - callTimes[1];
      const delay3 = callTimes[3] - callTimes[2];
      
      expect(delay1).toBeGreaterThan(40); // Allow some variance
      expect(delay2).toBeGreaterThan(delay1 * 0.8); // Should be roughly double
      expect(delay3).toBeGreaterThan(delay2 * 0.8); // Should be roughly double
    });

    it('should respect maximum delay limit', async () => {
      const callTimes: number[] = [];
      let callCount = 0;
      
      const clientWithMaxDelay = new StellarClient({
        network: 'testnet',
        retryConfig: {
          maxRetries: 5,
          baseDelayMs: 1000,
          maxDelayMs: 1500, // Low max delay for testing
          enabled: true
        }
      });

      overrideHandlers(
        rest.get('https://soroban-testnet.stellar.org/health', (req, res, ctx) => {
          callTimes.push(Date.now());
          callCount++;
          
          if (callCount <= 4) {
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

      await clientWithMaxDelay.getHealth();

      expect(callCount).toBe(5); // 4 failures + 1 success
      
      // Verify delays don't exceed maxDelayMs
      for (let i = 1; i < callTimes.length; i++) {
        const delay = callTimes[i] - callTimes[i - 1];
        expect(delay).toBeLessThan(1600); // Allow some variance
      }
    });
  });

  describe('Retry Condition Logic', () => {
    it('should retry on 429 rate limit errors', async () => {
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
      
      expect(callCount).toBe(3); // 2 rate limits + 1 success
      expect(health).toEqual({ status: 'healthy', version: '20.0.0' });
    });

    it('should retry on 500 server errors', async () => {
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
      
      expect(callCount).toBe(2); // 1 server error + 1 success
      expect(health).toEqual({ status: 'healthy', version: '20.0.0' });
    });

    it('should retry on 502 bad gateway errors', async () => {
      let callCount = 0;
      
      overrideHandlers(
        rest.get('https://soroban-testnet.stellar.org/health', (req, res, ctx) => {
          callCount++;
          if (callCount <= 1) {
            return res(
              ctx.status(502),
              ctx.json({ error: 'Bad gateway' })
            );
          }
          return res(
            ctx.status(200),
            ctx.json({ status: 'healthy', version: '20.0.0' })
          );
        })
      );

      const health = await client.getHealth();
      
      expect(callCount).toBe(2); // 1 bad gateway + 1 success
      expect(health).toEqual({ status: 'healthy', version: '20.0.0' });
    });

    it('should retry on 503 service unavailable errors', async () => {
      let callCount = 0;
      
      overrideHandlers(
        rest.get('https://soroban-testnet.stellar.org/health', (req, res, ctx) => {
          callCount++;
          if (callCount <= 1) {
            return res(
              ctx.status(503),
              ctx.json({ error: 'Service unavailable' })
            );
          }
          return res(
            ctx.status(200),
            ctx.json({ status: 'healthy', version: '20.0.0' })
          );
        })
      );

      const health = await client.getHealth();
      
      expect(callCount).toBe(2); // 1 service unavailable + 1 success
      expect(health).toEqual({ status: 'healthy', version: '20.0.0' });
    });

    it('should retry on 504 gateway timeout errors', async () => {
      let callCount = 0;
      
      overrideHandlers(
        rest.get('https://soroban-testnet.stellar.org/health', (req, res, ctx) => {
          callCount++;
          if (callCount <= 1) {
            return res(
              ctx.status(504),
              ctx.json({ error: 'Gateway timeout' })
            );
          }
          return res(
            ctx.status(200),
            ctx.json({ status: 'healthy', version: '20.0.0' })
          );
        })
      );

      const health = await client.getHealth();
      
      expect(callCount).toBe(2); // 1 gateway timeout + 1 success
      expect(health).toEqual({ status: 'healthy', version: '20.0.0' });
    });

    it('should not retry on 400 bad request errors', async () => {
      let callCount = 0;
      
      overrideHandlers(
        rest.get('https://soroban-testnet.stellar.org/health', (req, res, ctx) => {
          callCount++;
          return res(
            ctx.status(400),
            ctx.json({ error: 'Bad request' })
          );
        })
      );

      await expect(client.getHealth()).rejects.toEqual(
        expect.objectContaining({
          response: expect.objectContaining({
            status: 400
          })
        })
      );
      
      expect(callCount).toBe(1); // Only called once, no retries
    });

    it('should not retry on 404 not found errors', async () => {
      let callCount = 0;
      
      overrideHandlers(
        rest.get('https://soroban-testnet.stellar.org/accounts/:accountId', (req, res, ctx) => {
          callCount++;
          return res(
            ctx.status(404),
            ctx.json({ error: 'Account not found' })
          );
        })
      );

      await expect(client.getAccount('nonexistent-account')).rejects.toEqual(
        expect.objectContaining({
          response: expect.objectContaining({
            status: 404
          })
        })
      );
      
      expect(callCount).toBe(1); // Only called once, no retries
    });
  });

  describe('Retry Configuration', () => {
    it('should respect custom maxRetries configuration', async () => {
      let callCount = 0;
      
      const clientWithCustomRetries = new StellarClient({
        network: 'testnet',
        retryConfig: {
          maxRetries: 5,
          enabled: true
        }
      });

      overrideHandlers(
        rest.get('https://soroban-testnet.stellar.org/health', (req, res, ctx) => {
          callCount++;
          if (callCount <= 5) {
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

      const health = await clientWithCustomRetries.getHealth();
      
      expect(callCount).toBe(6); // 5 failures + 1 success
      expect(health).toEqual({ status: 'healthy', version: '20.0.0' });
    });

    it('should fail when maxRetries is exceeded', async () => {
      let callCount = 0;
      
      const clientWithFewRetries = new StellarClient({
        network: 'testnet',
        retryConfig: {
          maxRetries: 2,
          enabled: true
        }
      });

      overrideHandlers(
        rest.get('https://soroban-testnet.stellar.org/health', (req, res, ctx) => {
          callCount++;
          return res(
            ctx.status(500),
            ctx.json({ error: 'Internal server error' })
          );
        })
      );

      await expect(clientWithFewRetries.getHealth()).rejects.toEqual(
        expect.objectContaining({
          response: expect.objectContaining({
            status: 500
          })
        })
      );
      
      expect(callCount).toBe(3); // 1 initial + 2 retries
    });

    it('should not retry when disabled', async () => {
      let callCount = 0;
      
      const clientWithRetriesDisabled = new StellarClient({
        network: 'testnet',
        retryConfig: {
          enabled: false
        }
      });

      overrideHandlers(
        rest.get('https://soroban-testnet.stellar.org/health', (req, res, ctx) => {
          callCount++;
          return res(
            ctx.status(500),
            ctx.json({ error: 'Internal server error' })
          );
        })
      );

      await expect(clientWithRetriesDisabled.getHealth()).rejects.toEqual(
        expect.objectContaining({
          response: expect.objectContaining({
            status: 500
          })
        })
      );
      
      expect(callCount).toBe(1); // Only called once, no retries
    });
  });

  describe('Concurrent Retry Behavior', () => {
    it('should handle multiple concurrent requests with retries', async () => {
      let callCount = 0;
      
      overrideHandlers(
        rest.get('https://soroban-testnet.stellar.org/health', (req, res, ctx) => {
          callCount++;
          if (callCount <= 3) {
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

      // Create multiple concurrent requests
      const promises = Array(5).fill(null).map(() => client.getHealth());
      const results = await Promise.all(promises);

      // All requests should eventually succeed
      results.forEach(result => {
        expect(result).toEqual({ status: 'healthy', version: '20.0.0' });
      });

      // Should have made multiple calls due to retries
      expect(callCount).toBeGreaterThan(3);
    });

    it('should handle mixed success and failure scenarios', async () => {
      let healthCallCount = 0;
      let accountCallCount = 0;
      
      overrideHandlers(
        rest.get('https://soroban-testnet.stellar.org/health', (req, res, ctx) => {
          healthCallCount++;
          if (healthCallCount <= 1) {
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
          if (accountCallCount <= 2) {
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

      // Execute concurrent requests
      const [health, account] = await Promise.all([
        client.getHealth(),
        client.getAccount('GD5JPQ7VKFOVRWPOEX74JYXHHFNTFZ2JE5WZ4K2MWTROVHMWHD7KUZ2V')
      ]);

      expect(healthCallCount).toBe(2); // 1 failure + 1 success
      expect(accountCallCount).toBe(3); // 2 failures + 1 success
      expect(health).toEqual({ status: 'healthy', version: '20.0.0' });
      expect(account.accountId()).toBe('GD5JPQ7VKFOVRWPOEX74JYXHHFNTFZ2JE5WZ4K2MWTROVHMWHD7KUZ2V');
    });
  });
});
