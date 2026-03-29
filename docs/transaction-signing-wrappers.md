# Transaction Signing Wrappers

This document describes the implementation of Transaction Signing Wrappers for Soroban, which provide high-level, safe utilities for constructing and signing Soroban transactions.

## Overview

The Transaction Signing Wrappers address the security and usability issues of manual XDR handling by providing:

- **Human-readable transaction building** - No manual XDR construction required
- **Automatic simulation** - Resource estimation before signing
- **Fee bump support** - Sponsored transaction scenarios
- **Multi-wallet support** - Both local keypairs and external wallet providers
- **Batch processing** - Handle multiple transactions efficiently
- **Advanced simulation** - Detailed resource analysis and optimization

## Core Components

### 1. TransactionSigner

The main class for building, simulating, and signing transactions.

```typescript
import { TransactionSigner } from 'axionvera-sdk';

const signer = new TransactionSigner({
  client: stellarClient,
  wallet: walletConnector,
  defaultFee: 100000,
  autoSimulate: true
});

const result = await signer.buildAndSignTransaction({
  sourceAccount: 'G...',
  operations: [{
    contractId: 'C...',
    method: 'deposit',
    args: [1000n]
  }]
});
```

#### Key Features:

- **Automatic Simulation**: Estimates CPU, memory, and fees before signing
- **Error Handling**: Comprehensive error reporting for failed simulations
- **Fee Optimization**: Calculates optimal fees based on resource usage
- **Flexible Configuration**: Customizable timeouts, fees, and simulation settings

### 2. EnhancedTransactionBuilder

Extends TransactionSigner with advanced capabilities for complex scenarios.

```typescript
import { EnhancedTransactionBuilder } from 'axionvera-sdk';

const enhanced = new EnhancedTransactionBuilder({
  client: stellarClient,
  wallet: walletConnector
});

// Multi-step transaction
const result = await enhanced.buildAndSignMultiStepTransaction({
  sourceAccount: 'G...',
  steps: [
    { contractId: 'C...', method: 'deposit', args: [1000n] },
    { contractId: 'C...', method: 'claim_rewards', args: [] }
  ]
});

// Batch processing
const batchResult = await enhanced.processBatchTransactions({
  transactions: [
    { sourceAccount: 'G...', operations: [...] },
    { sourceAccount: 'G...', operations: [...] }
  ],
  parallel: true
});
```

#### Advanced Features:

- **Multi-step Transactions**: Execute multiple operations in a single transaction
- **Batch Processing**: Handle multiple transactions with parallel/sequential options
- **Conditional Transactions**: Filter operations based on simulation results
- **Time-locked Operations**: Handle operations with time constraints
- **Transaction Validation**: Pre-signing validation with detailed error reporting

### 3. TransactionSimulator

Advanced simulation and resource analysis capabilities.

```typescript
import { TransactionSimulator } from 'axionvera-sdk';

const simulator = new TransactionSimulator(stellarClient);

// Detailed simulation
const detailed = await simulator.detailedSimulation(transaction);
console.log(`CPU Efficiency: ${detailed.analysis.cpuEfficiency}%`);
console.log(`Memory Efficiency: ${detailed.analysis.memoryEfficiency}%`);
console.log(`Suggestions: ${detailed.suggestions.join(', ')}`);

// Optimization
const optimization = await simulator.optimizeTransaction(transaction, {
  priority: 'fee',
  maxFee: 50000
});

// Comparative analysis
const comparison = await simulator.comparativeSimulation([tx1, tx2, tx3]);
```

#### Simulation Features:

- **Efficiency Analysis**: CPU, memory, and fee efficiency ratings
- **Optimization Suggestions**: Actionable recommendations for improvement
- **Cost Breakdown**: Detailed fee and resource cost analysis
- **Historical Tracking**: Performance trends over time
- **Comparative Analysis**: Compare multiple transaction variants

## Security Features

### 1. Automatic Simulation

All transactions are automatically simulated before signing to:

- Validate contract calls
- Estimate resource requirements
- Detect potential failures early
- Calculate optimal fees

### 2. Fee Management

- **Dynamic Fee Calculation**: Fees based on actual resource usage
- **Fee Bump Support**: Sponsored transactions with separate fee sources
- **Fee Validation**: Prevents underpayment and overpayment scenarios

### 3. Error Handling

Comprehensive error handling for:

- Simulation failures
- Network connectivity issues
- Invalid contract calls
- Insufficient resources
- Wallet connection problems

### 4. Validation

Pre-signing validation checks:

- Transaction structure
- Operation validity
- Fee reasonableness
- Timeout settings
- Account sequence numbers

## Usage Examples

### Basic Transaction Signing

```typescript
import { 
  TransactionSigner, 
  StellarClient, 
  LocalKeypairWalletConnector,
  Keypair 
} from 'axionvera-sdk';

// Initialize client and wallet
const client = new StellarClient({ network: 'testnet' });
const keypair = Keypair.fromSecret('your-secret-key');
const wallet = new LocalKeypairWalletConnector(keypair);

// Create signer
const signer = new TransactionSigner({ client, wallet });

// Build and sign transaction
const result = await signer.buildAndSignTransaction({
  sourceAccount: await wallet.getPublicKey(),
  operations: [{
    contractId: 'C...',
    method: 'deposit',
    args: [1000n]
  }]
});

console.log(`Transaction hash: ${result.hash}`);
console.log(`Success: ${result.successful}`);
```

### Fee Bump Transaction

```typescript
// Create fee bump transaction
const feeBumpXdr = await signer.createFeeBumpTransaction({
  innerTransaction: originalTransactionXdr,
  feeSource: 'G...',
  baseFee: 100
});

// Submit the fee bump transaction
const result = await signer.submitSignedTransaction(feeBumpXdr);
```

### Batch Processing

```typescript
const enhanced = new EnhancedTransactionBuilder({ client, wallet });

// Process multiple transactions
const batchResult = await enhanced.processBatchTransactions({
  transactions: [
    {
      sourceAccount: 'G...',
      operations: [{ contractId: 'C...', method: 'deposit', args: [1000n] }]
    },
    {
      sourceAccount: 'G...',
      operations: [{ contractId: 'C...', method: 'withdraw', args: [500n] }]
    }
  ],
  parallel: true,
  delayBetween: 1000
});

console.log(`Successful: ${batchResult.summary.successful}/${batchResult.summary.total}`);
```

### Resource Optimization

```typescript
const simulator = new TransactionSimulator(client);

// Estimate costs
const estimates = await enhanced.estimateBatchCost([
  { sourceAccount: 'G...', operations: [...] },
  { sourceAccount: 'G...', operations: [...] }
]);

// Optimize transaction
const optimization = await simulator.optimizeTransaction(transaction, {
  priority: 'balanced',
  maxCpuInstructions: 1000000,
  maxMemoryBytes: 50000
});

if (optimization.optimized) {
  console.log('Optimization suggestions:');
  optimization.suggestions.forEach(suggestion => console.log(`- ${suggestion}`));
}
```

## Integration with External Wallets

The TransactionSigner works with any wallet that implements the `WalletConnector` interface:

```typescript
import { WalletConnector } from 'axionvera-sdk';

class FreighterWalletConnector implements WalletConnector {
  async getPublicKey(): Promise<string> {
    // Integration with Freighter wallet
    return await freighter.getPublicKey();
  }

  async signTransaction(transactionXdr: string, networkPassphrase: string): Promise<string> {
    // Integration with Freighter signing
    return await freighter.signTransaction(transactionXdr, networkPassphrase);
  }
}

// Use with external wallet
const freighterWallet = new FreighterWalletConnector();
const signer = new TransactionSigner({
  client: stellarClient,
  wallet: freighterWallet
});
```

## Best Practices

### 1. Always Use Simulation

Enable auto-simulation to catch errors early:

```typescript
const signer = new TransactionSigner({
  client,
  wallet,
  autoSimulate: true // Always true for production
});
```

### 2. Validate Before Signing

Use validation for critical transactions:

```typescript
const transaction = await signer.buildTransaction(params);
const validation = await enhanced.validateTransaction(transaction);

if (!validation.valid) {
  console.error('Validation errors:', validation.errors);
  return;
}
```

### 3. Monitor Resource Usage

Track resource efficiency over time:

```typescript
const simulator = new TransactionSimulator(client);
const result = await signer.buildAndSignTransaction(params);

// Track performance
simulator.trackSimulationHistory('deposit', result.simulation!);

// Check trends
const trends = simulator.getHistoricalTrends('deposit');
if (trends?.trendDirection === 'degrading') {
  console.warn('Deposit performance is degrading');
}
```

### 4. Handle Errors Gracefully

Implement comprehensive error handling:

```typescript
try {
  const result = await signer.buildAndSignTransaction(params);
  console.log('Transaction successful:', result.hash);
} catch (error) {
  if (error.message.includes('Simulation failed')) {
    console.error('Contract call failed - check parameters');
  } else if (error.message.includes('Timed out')) {
    console.error('Network congestion - retry later');
  } else {
    console.error('Unexpected error:', error);
  }
}
```

## Migration Guide

### From Manual XDR Handling

**Before:**
```typescript
// Manual XDR construction (error-prone)
const account = await server.getAccount(source);
const contract = new Contract(contractId);
const operation = contract.call(method, ...args);
const transaction = new TransactionBuilder(account, { fee, networkPassphrase })
  .addOperation(operation)
  .setTimeout(60)
  .build();

// Manual simulation required
const simulation = await server.simulateTransaction(transaction);
if (!simulation.success) {
  throw new Error(simulation.error);
}

// Manual signing
const signedTx = TransactionBuilder.fromXDR(transaction.toXDR(), networkPassphrase);
signedTx.sign(keypair);

// Manual submission
const result = await server.sendTransaction(signedTx);
```

**After:**
```typescript
// Safe, high-level approach
const signer = new TransactionSigner({ client, wallet });
const result = await signer.buildAndSignTransaction({
  sourceAccount,
  operations: [{ contractId, method, args }]
});

// Automatic simulation, signing, and submission included
console.log('Transaction successful:', result.hash);
```

## Testing

The transaction signing wrappers include comprehensive test coverage:

```bash
# Run all tests
npm test

# Run specific test files
npm test transactionSigner.test.ts
npm test enhancedTransactionBuilder.test.ts
```

## Performance Considerations

- **Simulation Overhead**: Simulation adds ~100-200ms per transaction
- **Batch Efficiency**: Batch processing reduces per-transaction overhead
- **Caching**: Historical simulation data is cached for trend analysis
- **Parallel Processing**: Multiple transactions can be processed in parallel

## Security Considerations

- **Private Key Safety**: Never expose private keys in transaction logs
- **Simulation Security**: Simulations don't modify blockchain state
- **Fee Protection**: Automatic fee estimation prevents overpayment
- **Input Validation**: All inputs are validated before processing
- **Error Information**: Error messages don't expose sensitive data
