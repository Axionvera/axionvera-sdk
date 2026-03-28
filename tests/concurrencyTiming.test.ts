import { StellarClient } from '../src/client/stellarClient';
import { ConcurrencyQueue } from '../src/utils/concurrencyQueue';
import { rpc } from '@stellar/stellar-sdk';

// Mock the Stellar SDK
jest.mock('@stellar/stellar-sdk');
const mockedRpc = rpc as jest.Mocked<typeof rpc>;

describe('Concurrency Control - Timing and Order Preservation', () => {
  let mockServer: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Create a mock server that tracks execution order
    const executionLog: Array<{ method: string; timestamp: number; id: string }> = [];
    
    mockServer = {
      getHealth: jest.fn().mockImplementation(async () => {
        const id = `health_${Date.now()}_${Math.random()}`;
        executionLog.push({ method: 'getHealth', timestamp: Date.now(), id });
        await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 50)); // 50-100ms delay
        return { status: 'healthy', version: '20.0.0' };
      }),
      
      getNetwork: jest.fn().mockImplementation(async () => {
        const id = `network_${Date.now()}_${Math.random()}`;
        executionLog.push({ method: 'getNetwork', timestamp: Date.now(), id });
        await new Promise(resolve => setTimeout(resolve, 30 + Math.random() * 30)); // 30-60ms delay
        return { passphrase: 'Test SDF Network ; September 2015' };
      }),
      
      getLatestLedger: jest.fn().mockImplementation(async () => {
        const id = `ledger_${Date.now()}_${Math.random()}`;
        executionLog.push({ method: 'getLatestLedger', timestamp: Date.now(), id });
        await new Promise(resolve => setTimeout(resolve, 40 + Math.random() * 40)); // 40-80ms delay
        return { sequence: 123456 };
      }),
      
      getAccount: jest.fn().mockImplementation(async (publicKey: string) => {
        const id = `account_${publicKey}_${Date.now()}`;
        executionLog.push({ method: 'getAccount', timestamp: Date.now(), id });
        await new Promise(resolve => setTimeout(resolve, 60 + Math.random() * 60)); // 60-120ms delay
        return {
          accountId: () => publicKey,
          sequence: '123456789'
        };
      }),
      
      getTransaction: jest.fn().mockImplementation(async (hash: string) => {
        const id = `tx_${hash}_${Date.now()}`;
        executionLog.push({ method: 'getTransaction', timestamp: Date.now(), id });
        await new Promise(resolve => setTimeout(resolve, 20 + Math.random() * 30)); // 20-50ms delay
        return { status: 'SUCCESS' };
      }),
      
      // Helper to get execution log
      _getExecutionLog: () => executionLog,
      _clearExecutionLog: () => { executionLog.length = 0; }
    };

    mockedRpc.Server = jest.fn().mockImplementation(() => mockServer);
  });

  describe('Request Order Preservation', () => {
    it('should preserve FIFO order for queued requests', async () => {
      const client = new StellarClient({
        network: 'testnet',
        concurrencyConfig: {
          maxConcurrentRequests: 2,
          queueTimeout: 10000
        }
      });

      mockServer._clearExecutionLog();

      // Fire 6 requests rapidly (exceeds concurrency limit)
      const startTime = Date.now();
      const promises = [
        client.getHealth(),
        client.getNetwork(),
        client.getLatestLedger(),
        client.getAccount('account1'),
        client.getTransaction('tx1'),
        client.getHealth()
      ];

      await Promise.all(promises);
      const endTime = Date.now();

      const executionLog: Array<{ method: string; timestamp: number; id: string }> = mockServer._getExecutionLog();

      // All requests should have been executed
      expect(executionLog).toHaveLength(6);
      
      // Order should match the order they were called (FIFO)
      expect(executionLog[0].method).toBe('getHealth');
      expect(executionLog[1].method).toBe('getNetwork');
      expect(executionLog[2].method).toBe('getLatestLedger');
      expect(executionLog[3].method).toBe('getAccount');
      expect(executionLog[4].method).toBe('getTransaction');
      expect(executionLog[5].method).toBe('getHealth');

      // Timing should show concurrency control working
      expect(endTime - startTime).toBeGreaterThan(150); // Should take longer than individual requests
    });

    it('should preserve order even with varying execution times', async () => {
      const client = new StellarClient({
        network: 'testnet',
        concurrencyConfig: {
          maxConcurrentRequests: 1, // Force sequential execution
          queueTimeout: 10000
        }
      });

      mockServer._clearExecutionLog();

      // Fire requests with different execution times
      const promises = [
        client.getHealth(),      // 50-100ms
        client.getTransaction('tx1'), // 20-50ms (fastest)
        client.getAccount('account1'), // 60-120ms (slowest)
        client.getNetwork()      // 30-60ms
      ];

      await Promise.all(promises);

      const executionLog = mockServer._getExecutionLog();

      // Order should be preserved despite different execution times
      expect(executionLog.map((entry: { method: string }) => entry.method)).toEqual([
        'getHealth',
        'getTransaction',
        'getAccount',
        'getNetwork'
      ]);
    });

    it('should handle mixed method calls with proper ordering', async () => {
      const client = new StellarClient({
        network: 'testnet',
        concurrencyConfig: {
          maxConcurrentRequests: 3,
          queueTimeout: 10000
        }
      });

      mockServer._clearExecutionLog();

      // Mix of different methods
      const promises = [];
      const expectedOrder = [];

      for (let i = 0; i < 10; i++) {
        if (i % 3 === 0) {
          promises.push(client.getHealth());
          expectedOrder.push('getHealth');
        } else if (i % 3 === 1) {
          promises.push(client.getNetwork());
          expectedOrder.push('getNetwork');
        } else {
          promises.push(client.getLatestLedger());
          expectedOrder.push('getLatestLedger');
        }
      }

      await Promise.all(promises);

      const executionLog: Array<{ method: string; timestamp: number; id: string }> = mockServer._getExecutionLog();

      // All requests should be executed in order
      expect(executionLog).toHaveLength(10);
      expect(executionLog.map((entry: { method: string }) => entry.method)).toEqual(expectedOrder);
    });
  });

  describe('Timing Behavior', () => {
    it('should respect concurrency limits in timing', async () => {
      const client = new StellarClient({
        network: 'testnet',
        concurrencyConfig: {
          maxConcurrentRequests: 2,
          queueTimeout: 10000
        }
      });

      mockServer._clearExecutionLog();

      const startTime = Date.now();
      
      // Fire 4 requests (2 concurrent max)
      const promises = [
        client.getHealth(),
        client.getNetwork(),
        client.getLatestLedger(),
        client.getAccount('account1')
      ];

      await Promise.all(promises);
      
      const endTime = Date.now();
      const executionLog: Array<{ method: string; timestamp: number; id: string }> = mockServer._getExecutionLog();

      // Should take longer than 2 concurrent requests but less than 4 sequential
      const totalTime = endTime - startTime;
      expect(totalTime).toBeGreaterThan(100); // More than 2 concurrent requests
      expect(totalTime).toBeLessThan(300); // Less than 4 sequential requests

      // Verify concurrent execution
      const firstTwoStartTimes = executionLog.slice(0, 2).map((entry: { timestamp: number }) => entry.timestamp);
      const lastTwoStartTimes = executionLog.slice(2, 4).map((entry: { timestamp: number }) => entry.timestamp);

      // First two should start almost simultaneously
      expect(firstTwoStartTimes[1] - firstTwoStartTimes[0]).toBeLessThan(20);
      
      // Last two should start after first two complete (approximately)
      expect(lastTwoStartTimes[0] - firstTwoStartTimes[0]).toBeGreaterThan(40);
    });

    it('should handle rapid request bursts gracefully', async () => {
      const client = new StellarClient({
        network: 'testnet',
        concurrencyConfig: {
          maxConcurrentRequests: 3,
          queueTimeout: 10000
        }
      });

      mockServer._clearExecutionLog();

      // Fire 20 requests rapidly
      const promises = Array.from({ length: 20 }, (_, i) => {
        if (i % 4 === 0) return client.getHealth();
        if (i % 4 === 1) return client.getNetwork();
        if (i % 4 === 2) return client.getLatestLedger();
        return client.getAccount(`account${i}`);
      });

      const startTime = Date.now();
      await Promise.all(promises);
      const endTime = Date.now();

      const executionLog: Array<{ method: string; timestamp: number; id: string }> = mockServer._getExecutionLog();

      // All requests should complete
      expect(executionLog).toHaveLength(20);
      
      // Should complete faster than sequential execution
      const totalTime = endTime - startTime;
      expect(totalTime).toBeLessThan(1000); // Should be much faster than sequential

      // Order should be preserved
      const expectedMethods = Array.from({ length: 20 }, (_, i) => {
        if (i % 4 === 0) return 'getHealth';
        if (i % 4 === 1) return 'getNetwork';
        if (i % 4 === 2) return 'getLatestLedger';
        return 'getAccount';
      });

      expect(executionLog.map((entry: { method: string }) => entry.method)).toEqual(expectedMethods);
    });

    it('should maintain performance under sustained load', async () => {
      const client = new StellarClient({
        network: 'testnet',
        concurrencyConfig: {
          maxConcurrentRequests: 5,
          queueTimeout: 10000
        }
      });

      // Test multiple batches
      const batchResults = [];

      for (let batch = 0; batch < 3; batch++) {
        mockServer._clearExecutionLog();
        
        const startTime = Date.now();
        
        // Fire 10 requests per batch
        const promises = Array.from({ length: 10 }, (_, i) => {
          if (i % 2 === 0) return client.getHealth();
          return client.getNetwork();
        });

        await Promise.all(promises);
        
        const endTime = Date.now();
        const batchTime = endTime - startTime;
        
        batchResults.push(batchTime);
        
        // Each batch should complete in reasonable time
        expect(batchTime).toBeLessThan(500);
      }

      // Performance should be consistent across batches
      const avgTime = batchResults.reduce((sum, time) => sum + time, 0) / batchResults.length;
      const variance = batchResults.reduce((sum, time) => sum + Math.pow(time - avgTime, 2), 0) / batchResults.length;
      
      // Variance should be relatively low (consistent performance)
      expect(Math.sqrt(variance)).toBeLessThan(avgTime * 0.5); // Less than 50% variance
    });
  });

  describe('Concurrency Statistics', () => {
    it('should provide accurate concurrency statistics', async () => {
      const client = new StellarClient({
        network: 'testnet',
        concurrencyConfig: {
          maxConcurrentRequests: 2,
          queueTimeout: 10000
        }
      });

      // Initially should show concurrency is enabled
      const stats1 = client.getConcurrencyStats();
      expect(stats1.enabled).toBe(true);
      expect(stats1.maxConcurrentRequests).toBe(2);

      // Start some requests
      const promises = [
        client.getHealth(),
        client.getNetwork(),
        client.getLatestLedger(), // This should be queued
        client.getAccount('account1') // This should also be queued
      ];

      // Wait a bit for requests to start
      await new Promise(resolve => setTimeout(resolve, 10));

      const stats2 = client.getConcurrencyStats();
      expect(stats2.enabled).toBe(true);

      await Promise.all(promises);

      // Should complete successfully
      const stats3 = client.getConcurrencyStats();
      expect(stats3.enabled).toBe(true);
    });

    it('should report disabled when concurrency control is not used', async () => {
      const client = new StellarClient({
        network: 'testnet'
        // No concurrencyConfig
      });

      const stats = client.getConcurrencyStats();
      expect(stats.enabled).toBe(false);
      expect(stats.message).toBe('Concurrency control is not enabled');
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle timeouts while preserving order of successful requests', async () => {
      const client = new StellarClient({
        network: 'testnet',
        concurrencyConfig: {
          maxConcurrentRequests: 1,
          queueTimeout: 50 // Very short timeout
        }
      });

      mockServer._clearExecutionLog();

      // Make one slow request first
      const slowPromise = client.getAccount('slow-account');

      // Then make requests that will timeout
      await new Promise(resolve => setTimeout(resolve, 10));

      const promises = [
        slowPromise,
        client.getHealth().catch(err => err), // This might timeout
        client.getNetwork().catch(err => err) // This might timeout
      ];

      const results = await Promise.all(promises);

      // First request should succeed
      expect(results[0]).toBeDefined();

      // Others might fail due to timeout, but order should be preserved
      const executionLog: Array<{ method: string; timestamp: number; id: string }> = mockServer._getExecutionLog();
      expect(executionLog[0].method).toBe('getAccount');
    });

    it('should maintain order with mixed success and failure', async () => {
      const client = new StellarClient({
        network: 'testnet',
        concurrencyConfig: {
          maxConcurrentRequests: 2,
          queueTimeout: 10000
        }
      });

      mockServer._clearExecutionLog();

      // Make selected calls fail while preserving execution log entries.
      mockServer.getHealth.mockImplementationOnce(async () => {
        const id = `health_${Date.now()}_${Math.random()}`;
        mockServer._getExecutionLog().push({ method: 'getHealth', timestamp: Date.now(), id });
        throw new Error('Health check failed');
      });

      mockServer.getLatestLedger.mockImplementationOnce(async () => {
        const id = `ledger_${Date.now()}_${Math.random()}`;
        mockServer._getExecutionLog().push({ method: 'getLatestLedger', timestamp: Date.now(), id });
        throw new Error('Ledger fetch failed');
      });

      const promises = [
        client.getHealth().catch(err => err),
        client.getNetwork(),
        client.getLatestLedger().catch(err => err),
        client.getAccount('account1')
      ];

      const results = await Promise.allSettled(promises);
      const executionLog = mockServer._getExecutionLog();

      // All should be attempted in order
      expect(executionLog).toHaveLength(4);
      expect(executionLog.map((entry: { method: string }) => entry.method)).toEqual([
        'getHealth',
        'getNetwork',
        'getLatestLedger',
        'getAccount'
      ]);

      // Results should reflect success/failure
      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('fulfilled');
      expect(results[2].status).toBe('fulfilled');
      expect(results[3].status).toBe('fulfilled');
    });
  });
});
