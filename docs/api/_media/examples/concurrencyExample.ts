/**
 * Example: Request Throttling and Concurrency Control
 * 
 * This example demonstrates how to use the SDK's built-in concurrency control
 * to prevent connection pool exhaustion and DDoS protection triggers.
 */

import { StellarClient, ConcurrencyQueue, createConcurrencyControlledClient } from '../src/index';

// Example 1: Basic Concurrency Control
async function basicConcurrencyControl() {
  console.log('=== Basic Concurrency Control ===');
  
  // Create client with concurrency control (default: 5 concurrent requests)
  const client = new StellarClient({
    network: 'testnet',
    concurrencyConfig: {
      maxConcurrentRequests: 3, // Limit to 3 concurrent requests
      queueTimeout: 10000       // 10 second queue timeout
    }
  });

  // Fire many requests rapidly
  const startTime = Date.now();
  const promises = [];

  for (let i = 0; i < 10; i++) {
    promises.push(client.getHealth());
    promises.push(client.getNetwork());
    promises.push(client.getLatestLedger());
  }

  try {
    const results = await Promise.all(promises);
    const endTime = Date.now();
    
    console.log(`Completed ${results.length} requests in ${endTime - startTime}ms`);
    console.log('Concurrency stats:', client.getConcurrencyStats());
    
  } catch (error) {
    console.error('Error in concurrent requests:', error);
  }
}

// Example 2: Custom Concurrency Queue
async function customConcurrencyQueue() {
  console.log('\n=== Custom Concurrency Queue ===');
  
  // Create a custom queue
  const queue = new ConcurrencyQueue({
    maxConcurrentRequests: 2,
    queueTimeout: 5000
  });

  // Simulate API calls with the queue
  const mockApiCall = async (endpoint: string, delay: number) => {
    console.log(`Starting ${endpoint} at ${Date.now()}`);
    await new Promise(resolve => setTimeout(resolve, delay));
    console.log(`Completed ${endpoint} at ${Date.now()}`);
    return { endpoint, data: `Response from ${endpoint}` };
  };

  // Execute multiple API calls with concurrency control
  const promises = [
    queue.execute(() => mockApiCall('/api/users', 100)),
    queue.execute(() => mockApiCall('/api/posts', 150)),
    queue.execute(() => mockApiCall('/api/comments', 80)),
    queue.execute(() => mockApiCall('/api/likes', 120)),
    queue.execute(() => mockApiCall('/api/shares', 90))
  ];

  try {
    const results = await Promise.all(promises);
    console.log('All API calls completed:', results.length);
    console.log('Queue stats:', queue.getStats());
  } catch (error) {
    console.error('Error in API calls:', error);
  }
}

// Example 3: Wrapping Custom HTTP Client
async function wrappedHttpClient() {
  console.log('\n=== Wrapped HTTP Client ===');
  
  // Create a mock HTTP client
  const httpClient = {
    get: async (url: string) => {
      console.log(`GET ${url} at ${Date.now()}`);
      await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
      return { url, data: `Response from ${url}` };
    },
    
    post: async (url: string, data: any) => {
      console.log(`POST ${url} at ${Date.now()}`);
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 150));
      return { url, data, result: 'Created' };
    }
  };

  // Wrap with concurrency control
  const controlledClient = createConcurrencyControlledClient(httpClient, {
    maxConcurrentRequests: 2,
    queueTimeout: 8000
  });

  // Execute multiple HTTP requests
  const promises = [
    controlledClient.get('/api/users'),
    controlledClient.post('/api/posts', { title: 'Test' }),
    controlledClient.get('/api/posts/1'),
    controlledClient.post('/api/comments', { text: 'Nice post!' }),
    controlledClient.get('/api/comments/1')
  ];

  try {
    const results = await Promise.all(promises);
    console.log('HTTP requests completed:', results.length);
    results.forEach(result => console.log('Result:', result));
  } catch (error) {
    console.error('Error in HTTP requests:', error);
  }
}

// Example 4: Error Handling with Concurrency
async function concurrencyErrorHandling() {
  console.log('\n=== Concurrency Error Handling ===');
  
  const queue = new ConcurrencyQueue({
    maxConcurrentRequests: 2,
    queueTimeout: 3000
  });

  // Simulate operations that might fail
  const unreliableOperation = async (id: number, shouldFail: boolean = false) => {
    console.log(`Starting operation ${id}`);
    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 100));
    
    if (shouldFail) {
      throw new Error(`Operation ${id} failed`);
    }
    
    console.log(`Completed operation ${id}`);
    return { id, success: true };
  };

  // Mix of successful and failing operations
  const promises = [
    queue.execute(() => unreliableOperation(1)),
    queue.execute(() => unreliableOperation(2, true)), // This will fail
    queue.execute(() => unreliableOperation(3)),
    queue.execute(() => unreliableOperation(4, true)), // This will fail
    queue.execute(() => unreliableOperation(5))
  ];

  try {
    const results = await Promise.allSettled(promises);
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        console.log(`Operation ${index + 1}: Success`, result.value);
      } else {
        console.log(`Operation ${index + 1}: Failed`, result.reason.message);
      }
    });
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    const failed = results.filter(r => r.status === 'rejected').length;
    
    console.log(`Summary: ${successful} successful, ${failed} failed`);
    console.log('Queue stats:', queue.getStats());
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Example 5: Performance Comparison
async function performanceComparison() {
  console.log('\n=== Performance Comparison ===');
  
  // Simulate API call
  const apiCall = async (id: number) => {
    await new Promise(resolve => setTimeout(resolve, 50 + Math.random() * 50));
    return { id, timestamp: Date.now() };
  };

  // Test without concurrency control
  console.log('Without concurrency control:');
  const startTime1 = Date.now();
  const promises1 = Array.from({ length: 20 }, (_, i) => apiCall(i));
  await Promise.all(promises1);
  const time1 = Date.now() - startTime1;
  console.log(`20 requests completed in ${time1}ms (uncontrolled)`);

  // Test with concurrency control
  console.log('With concurrency control:');
  const queue = new ConcurrencyQueue({ maxConcurrentRequests: 5 });
  const startTime2 = Date.now();
  const promises2 = Array.from({ length: 20 }, (_, i) => queue.execute(() => apiCall(i)));
  await Promise.all(promises2);
  const time2 = Date.now() - startTime2;
  console.log(`20 requests completed in ${time2}ms (controlled)`);

  console.log(`Performance difference: ${time2 - time1}ms (${((time2 / time1 - 1) * 100).toFixed(1)}% slower)`);
  console.log('But with controlled resource usage!');
}

// Example 6: Real-world SDK Usage Pattern
async function realWorldUsage() {
  console.log('\n=== Real-world Usage Pattern ===');
  
  // Create client with moderate concurrency control
  const client = new StellarClient({
    network: 'testnet',
    concurrencyConfig: {
      maxConcurrentRequests: 4,    // Balance between performance and resource usage
      queueTimeout: 15000         // Allow longer queue time for real usage
    }
  });

  // Simulate a typical application workflow
  try {
    console.log('Starting application workflow...');
    
    // Step 1: Check system health
    const health = await client.getHealth();
    console.log('System health:', health);
    
    // Step 2: Get network info (can run in parallel with account checks)
    const network = client.getNetwork();
    
    // Step 3: Check multiple accounts (simulated batch operation)
    const accountIds = [
      'GD5JPQ7VKFOVRWPOEX74JYXHHFNTFZ2JE5WZ4K2MWTROVHMWHD7KUZ2V',
      'GAXK2VX7J5QK6Y6F5T4R3E2D1C0B9A8Z7Y6X5W4V3U2T1S0R9',
      'GB7B5R7K3E2D1C0F9A8B7C6D5E4F3A2Z1Y9X8W7V6U5T4S3R2'
    ];
    
    const accountPromises = accountIds.map(accountId => 
      client.getAccount(accountId).catch(err => ({ error: err.message, accountId }))
    );
    
    // Step 4: Get latest ledger info
    const ledger = client.getLatestLedger();
    
    // Wait for all operations
    const [networkResult, ledgerResult, ...accountResults] = await Promise.all([
      network,
      ledger,
      ...accountPromises
    ]);
    
    console.log('Network info:', networkResult);
    console.log('Latest ledger:', ledgerResult);
    console.log('Account checks:', accountResults.map((result, index) => ({
      accountId: accountIds[index],
      success: !('error' in result),
      data: result
    })));
    
    // Show concurrency statistics
    console.log('Concurrency stats:', client.getConcurrencyStats());
    
  } catch (error) {
    console.error('Workflow failed:', error);
  }
}

// Example 7: Advanced Configuration
async function advancedConfiguration() {
  console.log('\n=== Advanced Configuration ===');
  
  // Create queue with custom configuration
  const queue = new ConcurrencyQueue({
    maxConcurrentRequests: 3,
    queueTimeout: 5000
  });

  // Simulate different types of operations
  const fastOperation = async (id: number) => {
    await new Promise(resolve => setTimeout(resolve, 10));
    return { id, type: 'fast', duration: 10 };
  };

  const slowOperation = async (id: number) => {
    await new Promise(resolve => setTimeout(resolve, 200));
    return { id, type: 'slow', duration: 200 };
  };

  // Update configuration dynamically
  console.log('Initial queue stats:', queue.getStats());
  
  // Start with some operations
  const promises1 = [
    queue.execute(() => slowOperation(1)),
    queue.execute(() => fastOperation(2)),
    queue.execute(() => slowOperation(3))
  ];

  // Wait a bit, then update configuration
  await new Promise(resolve => setTimeout(resolve, 50));
  
  queue.updateConfig({
    maxConcurrentRequests: 5,  // Increase concurrency
    queueTimeout: 10000       // Increase timeout
  });

  console.log('Updated queue stats:', queue.getStats());

  // Add more operations with new configuration
  const promises2 = [
    queue.execute(() => fastOperation(4)),
    queue.execute(() => slowOperation(5)),
    queue.execute(() => fastOperation(6))
  ];

  try {
    const allResults = await Promise.all([...promises1, ...promises2]);
    console.log(`Completed ${allResults.length} operations`);
    console.log('Final queue stats:', queue.getStats());
  } catch (error) {
    console.error('Operations failed:', error);
  }
}

// Example 8: Timeout Handling
async function timeoutHandling() {
  console.log('\n=== Timeout Handling ===');
  
  // Create queue with short timeout for demonstration
  const queue = new ConcurrencyQueue({
    maxConcurrentRequests: 1,
    queueTimeout: 100  // Very short timeout
  });

  const slowOperation = async (id: number) => {
    console.log(`Starting slow operation ${id}`);
    await new Promise(resolve => setTimeout(resolve, 200));
    console.log(`Completed slow operation ${id}`);
    return { id };
  };

  try {
    // Start a slow operation
    const slowPromise = queue.execute(() => slowOperation(1));
    
    // Wait a bit, then try to add another (will timeout)
    await new Promise(resolve => setTimeout(resolve, 50));
    
    const timeoutPromise = queue.execute(() => slowOperation(2));
    
    const results = await Promise.allSettled([slowPromise, timeoutPromise]);
    
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') {
        console.log(`Operation ${index + 1}: Success`, result.value);
      } else {
        console.log(`Operation ${index + 1}: Failed`, result.reason.message);
      }
    });
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Run all examples
async function runAllExamples() {
  try {
    await basicConcurrencyControl();
    await customConcurrencyQueue();
    await wrappedHttpClient();
    await concurrencyErrorHandling();
    await performanceComparison();
    await realWorldUsage();
    await advancedConfiguration();
    await timeoutHandling();
    
    console.log('\n=== All examples completed ===');
  } catch (error) {
    console.error('Example execution failed:', error);
  }
}

// Export for individual testing
export {
  basicConcurrencyControl,
  customConcurrencyQueue,
  wrappedHttpClient,
  concurrencyErrorHandling,
  performanceComparison,
  realWorldUsage,
  advancedConfiguration,
  timeoutHandling,
  runAllExamples
};

// Run if called directly
if (require.main === module) {
  runAllExamples();
}
