/**
 * Example: Mocked Submit-and-Poll Transaction Flow
 * 
 * This example demonstrates how to use the mocked submit-and-poll functionality
 * for testing SDK transaction flows before connecting to live testnet.
 * 
 * The mock system provides deterministic transaction submission and polling
 * behavior without making any real network calls, making it ideal for:
 * - Unit testing transaction flows
 * - Dashboard development and testing
 * - CI/CD pipeline integration
 * - Local development without network dependencies
 */

import {
  mockSubmitAndPoll,
  MockTransactionSubmissionAdapter,
  createMockTransactionSubmissionAdapter,
  type MockTransactionStatusConfig,
  type TransactionSubmissionRequest
} from '../packages/core/src';

const VALID_XDR = 'AAAAAAAAAA==';
const VALID_PASSPHRASE = 'Test SDF Network ; September 2015';

// Example 1: Basic successful transaction flow
async function basicSuccessFlow() {
  console.log('Example 1: Basic Successful Transaction Flow');
  console.log('===============================================');

  const submissionRequest: TransactionSubmissionRequest = {
    transactionXdr: VALID_XDR,
    networkPassphrase: VALID_PASSPHRASE
  };

  const statusConfig: MockTransactionStatusConfig = {
    finalStatus: 'success',
    pendingCount: 2,
    ledger: 12345
  };

  const result = await mockSubmitAndPoll({
    submissionRequest,
    statusConfig,
    interval: 100,
    maxAttempts: 10
  });

  console.log('Transaction Hash:', result.hash);
  console.log('Status:', result.status);
  console.log('Ledger:', result.ledger);
  console.log('');
}

// Example 2: Failed transaction flow
async function failedTransactionFlow() {
  console.log('Example 2: Failed Transaction Flow');
  console.log('====================================');

  const submissionRequest: TransactionSubmissionRequest = {
    transactionXdr: VALID_XDR,
    networkPassphrase: VALID_PASSPHRASE
  };

  const statusConfig: MockTransactionStatusConfig = {
    finalStatus: 'failed',
    pendingCount: 1,
    errorMessage: 'Insufficient balance for transaction',
    ledger: 12346
  };

  const result = await mockSubmitAndPoll({
    submissionRequest,
    statusConfig,
    interval: 100,
    maxAttempts: 10
  });

  console.log('Transaction Hash:', result.hash);
  console.log('Status:', result.status);
  console.log('Error:', result.error);
  console.log('Ledger:', result.ledger);
  console.log('');
}

// Example 3: Timeout scenario
async function timeoutScenario() {
  console.log('Example 3: Transaction Timeout Scenario');
  console.log('=========================================');

  const submissionRequest: TransactionSubmissionRequest = {
    transactionXdr: VALID_XDR,
    networkPassphrase: VALID_PASSPHRASE
  };

  const statusConfig: MockTransactionStatusConfig = {
    finalStatus: 'success',
    pendingCount: 10 // More than maxAttempts
  };

  try {
    await mockSubmitAndPoll({
      submissionRequest,
      statusConfig,
      interval: 50,
      maxAttempts: 3
    });
  } catch (error) {
    console.log('Caught expected timeout error:', error instanceof Error ? error.message : String(error));
  }
  console.log('');
}

// Example 4: Using the adapter directly for advanced control
async function advancedAdapterUsage() {
  console.log('Example 4: Advanced Adapter Usage');
  console.log('===================================');

  const adapter = new MockTransactionSubmissionAdapter();

  // Configure multiple transactions with different behaviors
  adapter.configureTransactionStatus({
    hash: 'tx_deposit_123',
    finalStatus: 'success',
    pendingCount: 2,
    ledger: 100
  });

  adapter.configureTransactionStatus({
    hash: 'tx_withdraw_456',
    finalStatus: 'failed',
    pendingCount: 1,
    errorMessage: 'Withdrawal limit exceeded',
    ledger: 101
  });

  // Create lookup function for polling
  const lookup = adapter.createLookupFunction();

  // Simulate polling for deposit transaction
  console.log('Polling deposit transaction:');
  for (let i = 0; i < 4; i++) {
    const result = await lookup('tx_deposit_123');
    console.log(`  Attempt ${i + 1}: ${result.status}`);
  }

  // Simulate polling for withdrawal transaction
  console.log('Polling withdrawal transaction:');
  for (let i = 0; i < 3; i++) {
    const result = await lookup('tx_withdraw_456');
    console.log(`  Attempt ${i + 1}: ${result.status}`);
    if (result.error) {
      console.log(`  Error: ${result.error}`);
    }
  }

  console.log('');
}

// Example 5: Factory function for pre-configured adapter
async function factoryFunctionUsage() {
  console.log('Example 5: Factory Function Usage');
  console.log('===================================');

  const configs: MockTransactionStatusConfig[] = [
    {
      hash: 'tx_batch_1',
      finalStatus: 'success',
      pendingCount: 1,
      ledger: 200
    },
    {
      hash: 'tx_batch_2',
      finalStatus: 'success',
      pendingCount: 1,
      ledger: 201
    },
    {
      hash: 'tx_batch_3',
      finalStatus: 'failed',
      pendingCount: 2,
      errorMessage: 'Batch processing error',
      ledger: 202
    }
  ];

  const adapter = createMockTransactionSubmissionAdapter(configs);
  const lookup = adapter.createLookupFunction();

  console.log('Processing batch transactions:');
  for (const config of configs) {
    const result = await lookup(config.hash);
    console.log(`  ${config.hash}: ${result.status}`);
    if (result.error) {
      console.log(`    Error: ${result.error}`);
    }
  }

  console.log('');
}

// Example 6: Custom delay function for testing
async function customDelayFunction() {
  console.log('Example 6: Custom Delay Function');
  console.log('==================================');

  const delays: number[] = [];
  const customDelay = async (ms: number) => {
    delays.push(ms);
    console.log(`  Delaying for ${ms}ms`);
  };

  const submissionRequest: TransactionSubmissionRequest = {
    transactionXdr: VALID_XDR,
    networkPassphrase: VALID_PASSPHRASE
  };

  const statusConfig: MockTransactionStatusConfig = {
    finalStatus: 'success',
    pendingCount: 2
  };

  const result = await mockSubmitAndPoll({
    submissionRequest,
    statusConfig,
    interval: 50,
    maxAttempts: 10,
    delay: customDelay
  });

  console.log('Transaction completed:', result.status);
  console.log('Total delays:', delays.length);
  console.log('');
}

// Example 7: Testing retry logic
async function retryLogicTesting() {
  console.log('Example 7: Testing Retry Logic');
  console.log('================================');

  const adapter = new MockTransactionSubmissionAdapter();
  
  // Configure a transaction that requires multiple retries
  adapter.configureTransactionStatus({
    hash: 'tx_retry_test',
    finalStatus: 'success',
    pendingCount: 5, // Will require 5 polling attempts
    ledger: 300
  });

  const lookup = adapter.createLookupFunction();
  let attempts = 0;
  let result;

  console.log('Simulating retry logic:');
  while (attempts < 10) {
    attempts++;
    result = await lookup('tx_retry_test');
    console.log(`  Attempt ${attempts}: ${result.status}`);
    
    if (result.status === 'success') {
      console.log(`  Transaction succeeded after ${attempts} attempts`);
      break;
    }
  }

  console.log('Final attempts:', adapter.getPendingAttempts('tx_retry_test'));
  console.log('');
}

// Example 8: Multiple concurrent transactions
async function concurrentTransactions() {
  console.log('Example 8: Multiple Concurrent Transactions');
  console.log('============================================');

  const adapter = new MockTransactionSubmissionAdapter();

  // Configure multiple transactions
  const txConfigs = [
    { hash: 'tx_concurrent_1', finalStatus: 'success' as const, pendingCount: 1 },
    { hash: 'tx_concurrent_2', finalStatus: 'success' as const, pendingCount: 2 },
    { hash: 'tx_concurrent_3', finalStatus: 'failed' as const, pendingCount: 1, errorMessage: 'Concurrency error' }
  ];

  for (const config of txConfigs) {
    adapter.configureTransactionStatus(config);
  }

  const lookup = adapter.createLookupFunction();

  // Process all transactions concurrently
  const results = await Promise.all(
    txConfigs.map(async (config) => {
      let result;
      for (let i = 0; i < 5; i++) {
        result = await lookup(config.hash);
        if (result.status !== 'pending') break;
      }
      return { hash: config.hash, result };
    })
  );

  console.log('Concurrent transaction results:');
  for (const { hash, result } of results) {
    console.log(`  ${hash}: ${result.status}`);
    if (result.error) {
      console.log(`    Error: ${result.error}`);
    }
  }

  console.log('');
}

// Example 9: Reset and reuse adapter
async function resetAndReuse() {
  console.log('Example 9: Reset and Reuse Adapter');
  console.log('====================================');

  const adapter = new MockTransactionSubmissionAdapter();
  const request: TransactionSubmissionRequest = {
    transactionXdr: VALID_XDR,
    networkPassphrase: VALID_PASSPHRASE
  };

  // First transaction
  adapter.configureTransactionStatus({
    hash: 'tx_reset_test',
    finalStatus: 'success',
    pendingCount: 1
  });

  const hash1 = await adapter.submitTransaction(request);
  console.log('First transaction hash:', hash1);

  // Reset adapter
  adapter.reset();
  console.log('Adapter reset');

  // Second transaction (counter starts from 1 again)
  const hash2 = await adapter.submitTransaction(request);
  console.log('Second transaction hash:', hash2);

  console.log('');
}

// Example 10: Integration with wallet signing flow
async function walletSigningIntegration() {
  console.log('Example 10: Wallet Signing Integration');
  console.log('======================================');

  // Simulate a wallet-signed transaction
  const signedXdr = 'BBBBBBBBBB=='; // In real flow, this comes from wallet
  const signerPublicKey = 'GAXIONVERAMOCKPUBLICKEY';

  const submissionRequest: TransactionSubmissionRequest = {
    transactionXdr: signedXdr,
    networkPassphrase: VALID_PASSPHRASE,
    signerPublicKey,
    metadata: {
      source: 'wallet_integration',
      timestamp: new Date().toISOString()
    }
  };

  const statusConfig: MockTransactionStatusConfig = {
    finalStatus: 'success',
    pendingCount: 2,
    ledger: 400
  };

  const result = await mockSubmitAndPoll({
    submissionRequest,
    statusConfig,
    interval: 100,
    maxAttempts: 10
  });

  console.log('Wallet-signed transaction submitted');
  console.log('Transaction Hash:', result.hash);
  console.log('Status:', result.status);
  console.log('Signer:', signerPublicKey);
  console.log('');
}

// Run all examples
async function runExamples() {
  console.log('Mocked Submit-and-Poll Transaction Flow Examples');
  console.log('==================================================\n');

  await basicSuccessFlow();
  await failedTransactionFlow();
  await timeoutScenario();
  await advancedAdapterUsage();
  await factoryFunctionUsage();
  await customDelayFunction();
  await retryLogicTesting();
  await concurrentTransactions();
  await resetAndReuse();
  await walletSigningIntegration();

  console.log('All examples completed!');
}

// Run if executed directly
if (require.main === module) {
  runExamples().catch(console.error);
}

export {
  basicSuccessFlow,
  failedTransactionFlow,
  timeoutScenario,
  advancedAdapterUsage,
  factoryFunctionUsage,
  customDelayFunction,
  retryLogicTesting,
  concurrentTransactions,
  resetAndReuse,
  walletSigningIntegration
};