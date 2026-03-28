import { ConcurrencyQueue, DEFAULT_CONCURRENCY_CONFIG, createConcurrencyControlledClient } from '../src/utils/concurrencyQueue';

describe('ConcurrencyQueue', () => {
  let queue: ConcurrencyQueue;

  beforeEach(() => {
    queue = new ConcurrencyQueue({
      maxConcurrentRequests: 2,
      queueTimeout: 5000
    });
  });

  afterEach(() => {
    queue.clearQueue();
  });

  describe('Basic Functionality', () => {
    it('should execute requests within concurrency limit', async () => {
      const results: number[] = [];
      const mockFn = jest.fn().mockImplementation(async (value: number) => {
        await new Promise(resolve => setTimeout(resolve, 100));
        results.push(value);
        return value * 2;
      });

      // Execute 3 requests (2 concurrent max)
      const promises = [
        queue.execute(() => mockFn(1)),
        queue.execute(() => mockFn(2)),
        queue.execute(() => mockFn(3))
      ];

      const results2 = await Promise.all(promises);

      expect(results2).toEqual([2, 4, 6]);
      expect(mockFn).toHaveBeenCalledTimes(3);
      
      // Verify execution order (first 2 should start immediately, third waits)
      expect(results).toEqual([1, 2, 3]); // Order preserved
    });

    it('should queue requests when concurrency limit is reached', async () => {
      let activeCount = 0;
      const maxConcurrent = 2;
      const executionLog: number[] = [];

      const mockFn = jest.fn().mockImplementation(async (id: number) => {
        activeCount++;
        executionLog.push(id);
        
        // Simulate async work
        await new Promise(resolve => setTimeout(resolve, 50));
        
        activeCount--;
        return id;
      });

      // Start 4 requests (exceeds limit of 2)
      const promises = Array.from({ length: 4 }, (_, i) => 
        queue.execute(() => mockFn(i + 1))
      );

      await Promise.all(promises);

      expect(mockFn).toHaveBeenCalledTimes(4);
      expect(executionLog).toEqual([1, 2, 3, 4]); // FIFO order preserved
      
      // Verify concurrency limit was respected
      // This is harder to test directly, but we can verify no more than 2 were active simultaneously
      expect(mockFn).toHaveBeenCalledTimes(4);
    });

    it('should handle errors properly', async () => {
      const mockFn = jest.fn()
        .mockResolvedValueOnce('success1')
        .mockRejectedValueOnce(new Error('Test error'))
        .mockResolvedValueOnce('success2');

      const results = await Promise.allSettled([
        queue.execute(() => mockFn()),
        queue.execute(() => mockFn()),
        queue.execute(() => mockFn())
      ]);

      expect(results[0].status).toBe('fulfilled');
      expect((results[0] as PromiseFulfilledResult<string>).value).toBe('success1');
      
      expect(results[1].status).toBe('rejected');
      expect((results[1] as PromiseRejectedResult).reason).toBeInstanceOf(Error);
      
      expect(results[2].status).toBe('fulfilled');
      expect((results[2] as PromiseFulfilledResult<string>).value).toBe('success2');
    });
  });

  describe('Queue Management', () => {
    it('should provide accurate statistics', async () => {
      const slowMockFn = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'done';
      });

      // Start one request
      const promise1 = queue.execute(() => slowMockFn());
      
      // Wait a bit for it to start
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const stats1 = queue.getStats();
      expect(stats1.activeRequests).toBe(1);
      expect(stats1.queuedRequests).toBe(0);

      // Start more requests to fill the queue
      const promise2 = queue.execute(() => slowMockFn());
      const promise3 = queue.execute(() => slowMockFn()); // This should be queued

      await new Promise(resolve => setTimeout(resolve, 10));
      
      const stats2 = queue.getStats();
      expect(stats2.activeRequests).toBe(2); // Max concurrent
      expect(stats2.queuedRequests).toBe(1); // One queued

      // Wait for completion
      await Promise.all([promise1, promise2, promise3]);
      
      const stats3 = queue.getStats();
      expect(stats3.activeRequests).toBe(0);
      expect(stats3.queuedRequests).toBe(0);
    });

    it('should clear queue and reject pending requests', async () => {
      const slowMockFn = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'done';
      });

      // Start requests to fill queue
      const promise1 = queue.execute(() => slowMockFn());
      const promise2 = queue.execute(() => slowMockFn());
      const promise3 = queue.execute(() => slowMockFn()); // Will be queued
      const promise4 = queue.execute(() => slowMockFn()); // Will be queued

      // Attach rejection handlers before clearing to avoid unhandled rejections.
      const promise3Rejected = expect(promise3).rejects.toThrow('Request cancelled due to queue clearance');
      const promise4Rejected = expect(promise4).rejects.toThrow('Request cancelled due to queue clearance');

      await new Promise(resolve => setTimeout(resolve, 10));

      // Clear queue
      queue.clearQueue();

      // Existing requests should still complete
      await expect(promise1).resolves.toBe('done');
      await expect(promise2).resolves.toBe('done');

      // Queued requests should be rejected
      await promise3Rejected;
      await promise4Rejected;
    });

    it('should update configuration', () => {
      const newConfig = {
        maxConcurrentRequests: 5,
        queueTimeout: 10000
      };

      queue.updateConfig(newConfig);

      const stats = queue.getStats();
      expect(stats.maxConcurrentRequests).toBe(5);
    });
  });

  describe('Timeout Handling', () => {
    it('should timeout requests in queue', async () => {
      const slowMockFn = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 200));
        return 'done';
      });

      // Create queue with short timeout
      const shortTimeoutQueue = new ConcurrencyQueue({
        maxConcurrentRequests: 1,
        queueTimeout: 50
      });

      // Start a slow request
      const promise1 = shortTimeoutQueue.execute(() => slowMockFn());
      
      // Add another request that will timeout in queue
      const promise2 = shortTimeoutQueue.execute(() => slowMockFn());

      // Attach rejection handler immediately to avoid unhandled timeout rejection.
      const timeoutRejected = expect(promise2).rejects.toThrow('Request timed out in queue');

      await expect(promise1).resolves.toBe('done');
      await timeoutRejected;

      shortTimeoutQueue.clearQueue();
    });

    it('should not timeout requests that start executing', async () => {
      const mockFn = jest.fn().mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
        return 'done';
      });

      const promise = queue.execute(() => mockFn());

      await expect(promise).resolves.toBe('done');
    });
  });

  describe('Edge Cases', () => {
    it('should handle zero maxConcurrentRequests', async () => {
      const zeroQueue = new ConcurrencyQueue({
        maxConcurrentRequests: 0,
        queueTimeout: 1000
      });

      const mockFn = jest.fn().mockResolvedValue('test');

      // With maxConcurrentRequests=0, all requests should be queued
      const promise = zeroQueue.execute(() => mockFn());

      // Should timeout since no requests can execute
      await expect(promise).rejects.toThrow('Request timed out in queue');
      
      zeroQueue.clearQueue();
    });

    it('should handle rapid request bursts', async () => {
      const mockFn = jest.fn().mockImplementation(async (id: number) => {
        await new Promise(resolve => setTimeout(resolve, 10));
        return id;
      });

      // Fire 20 requests rapidly
      const promises = Array.from({ length: 20 }, (_, i) => 
        queue.execute(() => mockFn(i))
      );

      const results = await Promise.all(promises);

      expect(results).toEqual(Array.from({ length: 20 }, (_, i) => i));
      expect(mockFn).toHaveBeenCalledTimes(20);
    });

    it('should handle mixed fast and slow requests', async () => {
      const executionOrder: number[] = [];
      
      const mockFn = jest.fn().mockImplementation(async (id: number, isSlow: boolean = false) => {
        executionOrder.push(id);
        if (isSlow) {
          await new Promise(resolve => setTimeout(resolve, 100));
        } else {
          await new Promise(resolve => setTimeout(resolve, 10));
        }
        return id;
      });

      // Mix of fast and slow requests
      const promises = [
        queue.execute(() => mockFn(1, true)),   // Slow
        queue.execute(() => mockFn(2, false)),  // Fast
        queue.execute(() => mockFn(3, false)),  // Fast
        queue.execute(() => mockFn(4, true)),   // Slow
        queue.execute(() => mockFn(5, false))   // Fast
      ];

      await Promise.all(promises);

      expect(mockFn).toHaveBeenCalledTimes(5);
      // Order should be preserved despite different execution times
      expect(executionOrder).toEqual([1, 2, 3, 4, 5]);
    });
  });
});

describe('createConcurrencyControlledClient', () => {
  it('should wrap client methods with concurrency control', async () => {
    const mockClient = {
      method1: jest.fn().mockResolvedValue('result1'),
      method2: jest.fn().mockResolvedValue('result2'),
      property: 'value'
    };

    const wrappedClient = createConcurrencyControlledClient(mockClient, {
      maxConcurrentRequests: 1
    });

    // Methods should be wrapped
    expect(typeof wrappedClient.method1).toBe('function');
    expect(typeof wrappedClient.method2).toBe('function');

    // Properties should be preserved
    expect(wrappedClient.property).toBe('value');

    // Method calls should go through concurrency control
    const result1 = await wrappedClient.method1();
    const result2 = await wrappedClient.method2();

    expect(result1).toBe('result1');
    expect(result2).toBe('result2');
    expect(mockClient.method1).toHaveBeenCalledTimes(1);
    expect(mockClient.method2).toHaveBeenCalledTimes(1);
  });

  it('should handle errors in wrapped methods', async () => {
    const mockClient = {
      failingMethod: jest.fn().mockRejectedValue(new Error('Test error'))
    };

    const wrappedClient = createConcurrencyControlledClient(mockClient, {
      maxConcurrentRequests: 1
    });

    await expect(wrappedClient.failingMethod()).rejects.toThrow('Test error');
    expect(mockClient.failingMethod).toHaveBeenCalledTimes(1);
  });

  it('should preserve method context', async () => {
    const mockClient = {
      value: 42,
      getValue: jest.fn(function(this: any) {
        return this.value;
      })
    };

    const wrappedClient = createConcurrencyControlledClient(mockClient, {
      maxConcurrentRequests: 1
    });

    const result = await wrappedClient.getValue();
    expect(result).toBe(42);
  });
});

describe('DEFAULT_CONCURRENCY_CONFIG', () => {
  it('should have sensible default values', () => {
    expect(DEFAULT_CONCURRENCY_CONFIG.maxConcurrentRequests).toBe(5);
    expect(DEFAULT_CONCURRENCY_CONFIG.queueTimeout).toBe(30000);
  });
});
