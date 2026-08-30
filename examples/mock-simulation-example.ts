/**
 * Example: Mock Soroban Simulation Adapter Usage
 * 
 * This example demonstrates how to use the MockSimulationAdapter for testing
 * SDK transaction flows without calling real RPC endpoints.
 * 
 * The mock adapter provides predictable simulation-style outputs for both
 * success and failure cases, following the schema that real Soroban simulation
 * will use when implemented.
 */

import {
  MockSimulationAdapter,
  createSuccessSimulationAdapter,
  createFailureSimulationAdapter,
  createMockSimulationAdapter
} from '../packages/core/src/testing';
import type { SorobanInvokeRequest } from '../packages/core/src/soroban';

const CONTRACT_ID = 'CABCDEF0000000000000000000000000000000000000000000000000000000001';
const USER_ADDRESS = 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ';

// Example 1: Basic success simulation
async function basicSuccessSimulation() {
  console.log('Example 1: Basic Success Simulation');
  console.log('=====================================');

  const adapter = createSuccessSimulationAdapter();

  const request: SorobanInvokeRequest = {
    contractId: CONTRACT_ID,
    method: 'deposit',
    args: [USER_ADDRESS, '100']
  };

  const result = await adapter.simulate(request);

  console.log('Status:', result.status);
  console.log('Hash:', result.hash);
  console.log('Fee:', result.fee);
  console.log('CPU Instructions:', result.cpuInstructions);
  console.log('Memory Bytes:', result.memoryBytes);
  console.log('');
}

// Example 2: Basic failure simulation
async function basicFailureSimulation() {
  console.log('Example 2: Basic Failure Simulation');
  console.log('=====================================');

  const adapter = createFailureSimulationAdapter('Insufficient balance');

  const request: SorobanInvokeRequest = {
    contractId: CONTRACT_ID,
    method: 'withdraw',
    args: [USER_ADDRESS, '1000']
  };

  const result = await adapter.simulate(request);

  console.log('Status:', result.status);
  console.log('Error:', result.error?.message);
  console.log('Error Code:', result.error?.code);
  console.log('');
}

// Example 3: Custom success simulation with specific response
async function customSuccessSimulation() {
  console.log('Example 3: Custom Success Simulation');
  console.log('=====================================');

  const adapter = new MockSimulationAdapter({
    responses: [
      {
        method: 'deposit',
        response: {
          status: 'success',
          hash: 'custom-deposit-hash-123',
          result: {
            new_balance: '1100',
            timestamp: '2024-01-15T10:30:00Z'
          },
          fee: 150n,
          cpuInstructions: 2500,
          memoryBytes: 800
        }
      }
    ]
  });

  const request: SorobanInvokeRequest = {
    contractId: CONTRACT_ID,
    method: 'deposit',
    args: [USER_ADDRESS, '100']
  };

  const result = await adapter.simulate(request);

  console.log('Status:', result.status);
  console.log('Transaction Hash:', result.hash);
  console.log('Result:', result.result);
  console.log('Fee (stroops):', result.fee);
  console.log('CPU Instructions:', result.cpuInstructions);
  console.log('Memory Bytes:', result.memoryBytes);
  console.log('');
}

// Example 4: Custom failure simulation with error details
async function customFailureSimulation() {
  console.log('Example 4: Custom Failure Simulation');
  console.log('=====================================');

  const adapter = new MockSimulationAdapter({
    responses: [
      {
        method: 'withdraw',
        response: {
          status: 'failure',
          error: {
            message: 'Contract invocation trapped: amount exceeds available balance',
            code: 42
          }
        }
      }
    ]
  });

  const request: SorobanInvokeRequest = {
    contractId: CONTRACT_ID,
    method: 'withdraw',
    args: [USER_ADDRESS, '999999']
  };

  const result = await adapter.simulate(request);

  console.log('Status:', result.status);
  console.log('Error Message:', result.error?.message);
  console.log('Error Code:', result.error?.code);
  console.log('');
}

// Example 5: Restore simulation (for transactions requiring restore)
async function restoreSimulation() {
  console.log('Example 5: Restore Simulation');
  console.log('==============================');

  const adapter = new MockSimulationAdapter({
    responses: [
      {
        method: 'deposit',
        response: MockSimulationAdapter.createRestoreResult({
          fee: 200n,
          cpuInstructions: 3000,
          memoryBytes: 1200
        })
      }
    ]
  });

  const request: SorobanInvokeRequest = {
    contractId: CONTRACT_ID,
    method: 'deposit',
    args: [USER_ADDRESS, '100']
  };

  const result = await adapter.simulate(request);

  console.log('Status:', result.status);
  console.log('Fee:', result.fee);
  console.log('CPU Instructions:', result.cpuInstructions);
  console.log('Memory Bytes:', result.memoryBytes);
  console.log('');
}

// Example 6: Multi-method configuration
async function multiMethodConfiguration() {
  console.log('Example 6: Multi-Method Configuration');
  console.log('======================================');

  const adapter = new MockSimulationAdapter({
    responses: [
      {
        method: 'get_balance',
        response: MockSimulationAdapter.createSuccessResult({
          result: { balance: '1000', address: USER_ADDRESS }
        })
      },
      {
        method: 'deposit',
        response: MockSimulationAdapter.createSuccessResult({
          hash: 'deposit-tx-456',
          result: { new_balance: '1100' }
        })
      },
      {
        method: 'withdraw',
        response: MockSimulationAdapter.createFailureResult('Insufficient funds')
      },
      {
        method: 'claim_rewards',
        response: MockSimulationAdapter.createSuccessResult({
          hash: 'claim-tx-789',
          result: { rewards_claimed: '50' }
        })
      }
    ]
  });

  // Test each method
  const balanceRequest: SorobanInvokeRequest = {
    contractId: CONTRACT_ID,
    method: 'get_balance',
    args: [USER_ADDRESS]
  };

  const depositRequest: SorobanInvokeRequest = {
    contractId: CONTRACT_ID,
    method: 'deposit',
    args: [USER_ADDRESS, '100']
  };

  const withdrawRequest: SorobanInvokeRequest = {
    contractId: CONTRACT_ID,
    method: 'withdraw',
    args: [USER_ADDRESS, '2000']
  };

  const claimRequest: SorobanInvokeRequest = {
    contractId: CONTRACT_ID,
    method: 'claim_rewards',
    args: [USER_ADDRESS]
  };

  const balanceResult = await adapter.simulate(balanceRequest);
  console.log('get_balance:', balanceResult.status, '-', balanceResult.result);

  const depositResult = await adapter.simulate(depositRequest);
  console.log('deposit:', depositResult.status, '-', depositResult.hash);

  const withdrawResult = await adapter.simulate(withdrawRequest);
  console.log('withdraw:', withdrawResult.status, '-', withdrawResult.error?.message);

  const claimResult = await adapter.simulate(claimRequest);
  console.log('claim_rewards:', claimResult.status, '-', claimResult.hash);
  console.log('');
}

// Example 7: Dynamic response updates
async function dynamicResponseUpdates() {
  console.log('Example 7: Dynamic Response Updates');
  console.log('====================================');

  const adapter = createMockSimulationAdapter({
    defaultResponse: MockSimulationAdapter.createSuccessResult()
  });

  const request: SorobanInvokeRequest = {
    contractId: CONTRACT_ID,
    method: 'deposit',
    args: [USER_ADDRESS, '100']
  };

  // Initial success
  let result = await adapter.simulate(request);
  console.log('First call:', result.status);

  // Update to failure
  adapter.setSimulationResponse(
    'deposit',
    MockSimulationAdapter.createFailureResult('Temporary maintenance')
  );

  result = await adapter.simulate(request);
  console.log('Second call:', result.status, '-', result.error?.message);

  // Clear specific response (falls back to default success)
  adapter.clearSimulationResponse('deposit');

  result = await adapter.simulate(request);
  console.log('Third call:', result.status);

  // Reset all responses
  adapter.reset();
  console.log('Reset all responses');
  console.log('');
}

// Example 8: Using factory helpers
async function factoryHelpers() {
  console.log('Example 8: Using Factory Helpers');
  console.log('==================================');

  // Static factory methods for creating results
  const successResult = MockSimulationAdapter.createSuccessResult({
    hash: 'factory-success-hash',
    result: { value: 42 }
  });

  const failureResult = MockSimulationAdapter.createFailureResult('Factory error', {
    error: { message: 'Custom factory error', code: 100 }
  });

  const restoreResult = MockSimulationAdapter.createRestoreResult({
    fee: 300n,
    cpuInstructions: 4000
  });

  console.log('Success Result:', successResult.status, '-', successResult.hash);
  console.log('Failure Result:', failureResult.status, '-', failureResult.error?.message);
  console.log('Restore Result:', restoreResult.status, '-', restoreResult.fee);
  console.log('');
}

// Example 9: Transaction flow simulation
async function transactionFlowSimulation() {
  console.log('Example 9: Transaction Flow Simulation');
  console.log('=======================================');

  const adapter = new MockSimulationAdapter({
    responses: [
      {
        method: 'get_balance',
        response: MockSimulationAdapter.createSuccessResult({
          result: { balance: '1000', last_updated: '2024-01-15T10:00:00Z' }
        })
      },
      {
        method: 'deposit',
        response: MockSimulationAdapter.createSuccessResult({
          hash: 'deposit-tx-flow-123',
          result: { 
            previous_balance: '1000',
            new_balance: '1100',
            amount_deposited: '100'
          },
          fee: 150n,
          cpuInstructions: 2000,
          memoryBytes: 750
        })
      },
      {
        method: 'get_pending_rewards',
        response: MockSimulationAdapter.createSuccessResult({
          result: { rewards: '25', since_last_claim: '7 days' }
        })
      },
      {
        method: 'claim_rewards',
        response: MockSimulationAdapter.createSuccessResult({
          hash: 'claim-tx-flow-456',
          result: { rewards_claimed: '25', transferred_to: USER_ADDRESS }
        })
      }
    ]
  });

  // Simulate a complete transaction flow
  console.log('Step 1: Check balance');
  const balanceResult = await adapter.simulate({
    contractId: CONTRACT_ID,
    method: 'get_balance',
    args: [USER_ADDRESS]
  });
  console.log('  Balance:', balanceResult.result);

  console.log('Step 2: Deposit funds');
  const depositResult = await adapter.simulate({
    contractId: CONTRACT_ID,
    method: 'deposit',
    args: [USER_ADDRESS, '100']
  });
  console.log('  Deposit TX:', depositResult.hash);
  console.log('  Fee:', depositResult.fee);

  console.log('Step 3: Check pending rewards');
  const rewardsResult = await adapter.simulate({
    contractId: CONTRACT_ID,
    method: 'get_pending_rewards',
    args: [USER_ADDRESS]
  });
  console.log('  Pending Rewards:', rewardsResult.result);

  console.log('Step 4: Claim rewards');
  const claimResult = await adapter.simulate({
    contractId: CONTRACT_ID,
    method: 'claim_rewards',
    args: [USER_ADDRESS]
  });
  console.log('  Claim TX:', claimResult.hash);
  console.log('');
}

// Example 10: Error handling
async function errorHandlingExample() {
  console.log('Example 10: Error Handling');
  console.log('===========================');

  const adapter = new MockSimulationAdapter(); // No default response

  const request: SorobanInvokeRequest = {
    contractId: CONTRACT_ID,
    method: 'unconfigured_method',
    args: []
  };

  try {
    await adapter.simulate(request);
  } catch (error) {
    console.log('Caught error:', error instanceof Error ? error.message : String(error));
  }

  // Configure a response and retry
  adapter.setSimulationResponse(
    'unconfigured_method',
    MockSimulationAdapter.createSuccessResult()
  );

  const result = await adapter.simulate(request);
  console.log('After configuration:', result.status);
  console.log('');
}

// Run all examples
async function runExamples() {
  console.log('Mock Soroban Simulation Adapter Examples');
  console.log('==========================================\n');

  await basicSuccessSimulation();
  await basicFailureSimulation();
  await customSuccessSimulation();
  await customFailureSimulation();
  await restoreSimulation();
  await multiMethodConfiguration();
  await dynamicResponseUpdates();
  await factoryHelpers();
  await transactionFlowSimulation();
  await errorHandlingExample();

  console.log('All examples completed!');
}

// Run if executed directly
if (require.main === module) {
  runExamples().catch(console.error);
}

export {
  basicSuccessSimulation,
  basicFailureSimulation,
  customSuccessSimulation,
  customFailureSimulation,
  restoreSimulation,
  multiMethodConfiguration,
  dynamicResponseUpdates,
  factoryHelpers,
  transactionFlowSimulation,
  errorHandlingExample
};
