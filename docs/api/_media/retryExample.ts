import { StellarClient } from '../src/client/stellarClient';

// Example 1: Using default retry configuration
async function exampleWithDefaultRetry() {
  const client = new StellarClient();
  
  try {
    // This will automatically retry on 5xx or 429 errors with exponential backoff
    const health = await client.getHealth();
    console.log('Health check successful:', health);
    
    const account = await client.getAccount('GD5JPQ7VKFOVRWPOEX74JYXHHFNTFZ2JE5WZ4K2MWTROVHMWHD7KUZ2V');
    console.log('Account data:', account);
    
  } catch (error) {
    console.error('Failed after retries:', error);
  }
}

// Example 2: Custom retry configuration
async function exampleWithCustomRetry() {
  const client = new StellarClient({
    network: 'testnet',
    retryConfig: {
      enabled: true,
      maxRetries: 5,           // Retry up to 5 times
      baseDelayMs: 500,        // Start with 500ms delay
      maxDelayMs: 10000,       // Maximum delay of 10 seconds
      retryableMethods: ['GET', 'PUT'], // Only retry GET and PUT requests
      retryableStatusCodes: [429, 500, 502, 503, 504] // Retry on these status codes
    }
  });
  
  try {
    const health = await client.getHealth();
    console.log('Health check successful with custom retry config:', health);
  } catch (error) {
    console.error('Failed after custom retries:', error);
  }
}

// Example 3: Disable retries
async function exampleWithRetriesDisabled() {
  const client = new StellarClient({
    retryConfig: {
      enabled: false  // Disable automatic retries
    }
  });
  
  try {
    const health = await client.getHealth();
    console.log('Health check successful without retries:', health);
  } catch (error) {
    console.error('Failed immediately (no retries):', error);
  }
}

// Example 4: Using the retry utility directly
import { retry, RetryConfig } from '../src/utils/httpInterceptor';

async function exampleWithDirectRetry() {
  const customRetryConfig: Partial<RetryConfig> = {
    maxRetries: 3,
    baseDelayMs: 1000,
    enabled: true
  };
  
  try {
    const result = await retry(async () => {
      // Some operation that might fail
      const response = await fetch('https://soroban-testnet.stellar.org/health');
      if (!response.ok) {
        throw { response: { status: response.status } };
      }
      return response.json();
    }, customRetryConfig);
    
    console.log('Direct retry successful:', result);
  } catch (error) {
    console.error('Direct retry failed:', error);
  }
}

// Run examples
async function runExamples() {
  console.log('=== Default Retry Example ===');
  await exampleWithDefaultRetry();
  
  console.log('\n=== Custom Retry Example ===');
  await exampleWithCustomRetry();
  
  console.log('\n=== Disabled Retry Example ===');
  await exampleWithRetriesDisabled();
  
  console.log('\n=== Direct Retry Example ===');
  await exampleWithDirectRetry();
}

if (require.main === module) {
  runExamples().catch(console.error);
}
