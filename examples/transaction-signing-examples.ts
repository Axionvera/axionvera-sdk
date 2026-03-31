/**
 * Example usage of Transaction Signing Wrappers for Soroban.
 * 
 * This example demonstrates the key features of the transaction signing utilities
 * including basic signing, fee bumps, batch processing, and simulation.
 */

import {
  TransactionSigner,
  EnhancedTransactionBuilder,
  TransactionSimulator,
  StellarClient,
  LocalKeypairWalletConnector,
  Keypair
} from 'axionvera-sdk';

// Configuration
const NETWORK = 'testnet';
const CONTRACT_ID = 'CDLZFC3SYJYDZT7K67VZ75GJVWUYZGSIEMHTS4DTY6J5AZT2H2JZ4QQ';
const VAULT_CONTRACT_ID = 'CA3D5KRYM6CB7OWQ6TWYMS7V4WOZ7U2EVFTRPZGJYJRVVNR5FCHCWZU';

async function basicTransactionExample() {
  console.log('=== Basic Transaction Example ===');
  
  // Initialize client and wallet
  const client = new StellarClient({ network: NETWORK });
  const keypair = Keypair.random(); // Use Keypair.fromSecret() for real keys
  const wallet = new LocalKeypairWalletConnector(keypair);
  
  // Create transaction signer
  const signer = new TransactionSigner({
    client,
    wallet,
    defaultFee: 100000,
    autoSimulate: true
  });
  
  try {
    // Build and sign a simple contract call
    const result = await signer.buildAndSignTransaction({
      sourceAccount: await wallet.getPublicKey(),
      operations: [{
        contractId: CONTRACT_ID,
        method: 'hello',
        args: ['World']
      }]
    });
    
    console.log(`✅ Transaction successful!`);
    console.log(`   Hash: ${result.hash}`);
    console.log(`   Status: ${result.status}`);
    console.log(`   Fee: ${result.simulation?.transactionData?.resourceFee || 'N/A'}`);
    
  } catch (error) {
    console.error(`❌ Transaction failed: ${error.message}`);
  }
}

async function feeBumpExample() {
  console.log('\n=== Fee Bump Transaction Example ===');
  
  const client = new StellarClient({ network: NETWORK });
  const sponsorKeypair = Keypair.random();
  const userKeypair = Keypair.random();
  
  const sponsorWallet = new LocalKeypairWalletConnector(sponsorKeypair);
  const userWallet = new LocalKeypairWalletConnector(userKeypair);
  
  const signer = new TransactionSigner({
    client,
    wallet: userWallet
  });
  
  try {
    // Create a regular transaction first
    const regularResult = await signer.buildAndSignTransaction({
      sourceAccount: await userWallet.getPublicKey(),
      operations: [{
        contractId: CONTRACT_ID,
        method: 'store_value',
        args: [42n]
      }]
    });
    
    console.log(`📝 Regular transaction created: ${regularResult.hash}`);
    
    // Create fee bump transaction with sponsor
    const feeBumpXdr = await signer.createFeeBumpTransaction({
      innerTransaction: regularResult.signedXdr,
      feeSource: await sponsorWallet.getPublicKey(),
      baseFee: 500
    });
    
    console.log(`💰 Fee bump transaction created`);
    
    // Submit the fee bump transaction
    const feeBumpResult = await signer.submitSignedTransaction(feeBumpXdr);
    console.log(`✅ Fee bump successful: ${feeBumpResult.hash}`);
    
  } catch (error) {
    console.error(`❌ Fee bump failed: ${error.message}`);
  }
}

async function batchProcessingExample() {
  console.log('\n=== Batch Processing Example ===');
  
  const client = new StellarClient({ network: NETWORK });
  const wallet = new LocalKeypairWalletConnector(Keypair.random());
  
  const enhanced = new EnhancedTransactionBuilder({
    client,
    wallet
  });
  
  try {
    // Process multiple transactions in parallel
    const batchResult = await enhanced.processBatchTransactions({
      transactions: [
        {
          sourceAccount: await wallet.getPublicKey(),
          operations: [{
            contractId: CONTRACT_ID,
            method: 'increment',
            args: []
          }]
        },
        {
          sourceAccount: await wallet.getPublicKey(),
          operations: [{
            contractId: CONTRACT_ID,
            method: 'increment',
            args: []
          }]
        },
        {
          sourceAccount: await wallet.getPublicKey(),
          operations: [{
            contractId: CONTRACT_ID,
            method: 'get_counter',
            args: []
          }]
        }
      ],
      parallel: true
    });
    
    console.log(`📊 Batch processing complete:`);
    console.log(`   Total: ${batchResult.summary.total}`);
    console.log(`   Successful: ${batchResult.summary.successful}`);
    console.log(`   Failed: ${batchResult.summary.failed}`);
    
    batchResult.results.forEach((result, index) => {
      console.log(`   Tx ${index + 1}: ${result.successful ? '✅' : '❌'} ${result.hash}`);
    });
    
  } catch (error) {
    console.error(`❌ Batch processing failed: ${error.message}`);
  }
}

async function simulationAndOptimizationExample() {
  console.log('\n=== Simulation and Optimization Example ===');
  
  const client = new StellarClient({ network: NETWORK });
  const wallet = new LocalKeypairWalletConnector(Keypair.random());
  
  const signer = new TransactionSigner({ client, wallet });
  const simulator = new TransactionSimulator(client);
  
  try {
    // Simulate a transaction before signing
    const simulation = await signer.simulateTransaction({
      sourceAccount: await wallet.getPublicKey(),
      operations: [{
        contractId: CONTRACT_ID,
        method: 'complex_calculation',
        args: [1000000n, 'large_string_data']
      }]
    });
    
    console.log(`🔍 Simulation Results:`);
    console.log(`   CPU Instructions: ${simulation.cpuInstructions.toLocaleString()}`);
    console.log(`   Memory Bytes: ${simulation.memoryBytes.toLocaleString()}`);
    console.log(`   Recommended Fee: ${simulation.recommendedFee} stroops`);
    console.log(`   Success: ${simulation.success}`);
    
    if (simulation.success) {
      // Get detailed analysis
      const detailed = await simulator.detailedSimulation(
        await signer.buildTransaction({
          sourceAccount: await wallet.getPublicKey(),
          operations: [{
            contractId: CONTRACT_ID,
            method: 'complex_calculation',
            args: [1000000n, 'large_string_data']
          }]
        })
      );
      
      console.log(`📈 Detailed Analysis:`);
      console.log(`   CPU Efficiency: ${detailed.analysis.cpuEfficiency.toFixed(1)}%`);
      console.log(`   Memory Efficiency: ${detailed.analysis.memoryEfficiency.toFixed(1)}%`);
      console.log(`   Fee Efficiency: ${detailed.analysis.feeEfficiency.toFixed(1)}%`);
      console.log(`   Overall Efficiency: ${detailed.analysis.overallEfficiency.toFixed(1)}%`);
      
      if (detailed.suggestions.length > 0) {
        console.log(`💡 Optimization Suggestions:`);
        detailed.suggestions.forEach(suggestion => {
          console.log(`   - ${suggestion}`);
        });
      }
      
      // Try to optimize the transaction
      const optimization = await simulator.optimizeTransaction(
        await signer.buildTransaction({
          sourceAccount: await wallet.getPublicKey(),
          operations: [{
            contractId: CONTRACT_ID,
            method: 'complex_calculation',
            args: [1000000n, 'large_string_data']
          }]
        }),
        {
          priority: 'fee',
          maxFee: 200000
        }
      );
      
      console.log(`🎯 Optimization Results:`);
      console.log(`   Optimized: ${optimization.optimized}`);
      if (optimization.optimized) {
        optimization.suggestions.forEach(suggestion => {
          console.log(`   - ${suggestion}`);
        });
      }
    }
    
  } catch (error) {
    console.error(`❌ Simulation failed: ${error.message}`);
  }
}

async function vaultContractExample() {
  console.log('\n=== Vault Contract Example ===');
  
  // Note: This would require the actual VaultContract implementation
  // For demonstration purposes only
  
  const client = new StellarClient({ network: NETWORK });
  const wallet = new LocalKeypairWalletConnector(Keypair.random());
  
  try {
    console.log(`🏦 Vault Contract Operations:`);
    
    // These would be actual vault operations in a real implementation
    console.log(`   1. Deposit: 1000 tokens`);
    console.log(`   2. Check balance`);
    console.log(`   3. Claim rewards`);
    console.log(`   4. Withdraw: 500 tokens`);
    
    console.log(`💡 In a real implementation, these would use the VaultContract class`);
    console.log(`   which provides high-level methods for vault operations.`);
    
  } catch (error) {
    console.error(`❌ Vault operations failed: ${error.message}`);
  }
}

async function multiStepTransactionExample() {
  console.log('\n=== Multi-Step Transaction Example ===');
  
  const client = new StellarClient({ network: NETWORK });
  const wallet = new LocalKeypairWalletConnector(Keypair.random());
  
  const enhanced = new EnhancedTransactionBuilder({ client, wallet });
  
  try {
    // Execute multiple operations in a single transaction
    const result = await enhanced.buildAndSignMultiStepTransaction({
      sourceAccount: await wallet.getPublicKey(),
      steps: [
        {
          contractId: CONTRACT_ID,
          method: 'initialize',
          args: [100n]
        },
        {
          contractId: CONTRACT_ID,
          method: 'add_value',
          args: [50n]
        },
        {
          contractId: CONTRACT_ID,
          method: 'finalize',
          args: []
        }
      ]
    });
    
    console.log(`🔄 Multi-step transaction successful!`);
    console.log(`   Hash: ${result.hash}`);
    console.log(`   Operations: 3`);
    console.log(`   Total fee: ${result.simulation?.transactionData?.resourceFee || 'N/A'}`);
    
  } catch (error) {
    console.error(`❌ Multi-step transaction failed: ${error.message}`);
  }
}

async function costEstimationExample() {
  console.log('\n=== Cost Estimation Example ===');
  
  const client = new StellarClient({ network: NETWORK });
  const wallet = new LocalKeypairWalletConnector(Keypair.random());
  
  const enhanced = new EnhancedTransactionBuilder({ client, wallet });
  
  try {
    // Estimate costs for multiple transaction variants
    const estimates = await enhanced.estimateBatchCost([
      {
        sourceAccount: await wallet.getPublicKey(),
        operations: [{
          contractId: CONTRACT_ID,
          method: 'simple_operation',
          args: []
        }]
      },
      {
        sourceAccount: await wallet.getPublicKey(),
        operations: [{
          contractId: CONTRACT_ID,
          method: 'complex_operation',
          args: [1000000n, 'large_data']
        }]
      },
      {
        sourceAccount: await wallet.getPublicKey(),
        operations: [
          { contractId: CONTRACT_ID, method: 'op1', args: [] },
          { contractId: CONTRACT_ID, method: 'op2', args: [] },
          { contractId: CONTRACT_ID, method: 'op3', args: [] }
        ]
      }
    ]);
    
    console.log(`💰 Cost Estimates:`);
    estimates.forEach((estimate, index) => {
      console.log(`   Transaction ${index + 1}:`);
      console.log(`     Fee: ${estimate.estimatedFee} stroops`);
      console.log(`     CPU: ${estimate.estimatedCpu.toLocaleString()} instructions`);
      console.log(`     Memory: ${estimate.estimatedMemory.toLocaleString()} bytes`);
      console.log(`     Confidence: ${(estimate.confidence * 100).toFixed(0)}%`);
    });
    
  } catch (error) {
    console.error(`❌ Cost estimation failed: ${error.message}`);
  }
}

// Run all examples
async function runAllExamples() {
  console.log('🚀 Transaction Signing Wrappers Examples\n');
  
  await basicTransactionExample();
  await feeBumpExample();
  await batchProcessingExample();
  await simulationAndOptimizationExample();
  await vaultContractExample();
  await multiStepTransactionExample();
  await costEstimationExample();
  
  console.log('\n✨ All examples completed!');
  console.log('\n📚 For more information, see:');
  console.log('   - docs/transaction-signing-wrappers.md');
  console.log('   - tests/ directory for comprehensive test coverage');
  console.log('   - src/transaction/ for implementation details');
}

// Export for use in other modules
export {
  basicTransactionExample,
  feeBumpExample,
  batchProcessingExample,
  simulationAndOptimizationExample,
  vaultContractExample,
  multiStepTransactionExample,
  costEstimationExample,
  runAllExamples
};

// Run examples if this file is executed directly
if (require.main === module) {
  runAllExamples().catch(console.error);
}
