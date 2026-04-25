# Migration Guide: From Stellar SDK v10 (Classic) to Soroban with Axionvera SDK

## Table of Contents

- [Introduction](#introduction)
- [The Paradigm Shift: Classic vs. Soroban](#the-paradigm-shift-classic-vs-soroban)
- [Key Conceptual Differences](#key-conceptual-differences)
- [Transaction Building: Side-by-Side Comparison](#transaction-building-side-by-side-comparison)
- [Common Migration Scenarios](#common-migration-scenarios)
- [Error Handling and Debugging](#error-handling-and-debugging)
- [Best Practices](#best-practices)
- [Additional Resources](#additional-resources)

---

## Introduction

If you're a Stellar Classic developer transitioning to Soroban smart contracts, you're in the right place. This guide bridges the knowledge gap between the old stellar-sdk v10 (Classic) and the new Soroban smart contract platform using the Axionvera SDK.

**What changed?**
- Stellar Classic uses built-in operations (Payment, CreateAccount, ManageData, etc.)
- Soroban uses smart contracts deployed on-chain with custom logic
- Interactions with Soroban contracts use `InvokeHostFunction` operations instead of specific operation types
- Soroban requires transaction simulation before submission to calculate resource costs

**Why Axionvera SDK?**
The Axionvera SDK abstracts away the complexity of Soroban development, providing a clean, strongly-typed interface that feels familiar to Classic developers while leveraging the power of smart contracts.

---

## The Paradigm Shift: Classic vs. Soroban

### Stellar Classic (Pre-Soroban)

In Classic Stellar, the protocol provided built-in operations. You would:

```typescript
import { Server, TransactionBuilder, Operations } from 'stellar-sdk';

const server = new Server('https://horizon-testnet.stellar.org');
const account = await server.loadAccount(sourcePublicKey);

const transaction = new TransactionBuilder(account, {
  fee: '100',
  networkPassphrase: Networks.TESTNET
})
  .addOperation(Operations.payment({
    destination: destinationPublicKey,
    asset: Asset.native(),
    amount: '100.50'
  }))
  .addOperation(Operations.manageData({
    name: 'my_key',
    value: 'my_value'
  }))
  .setTimeout(30)
  .build();

transaction.sign(Keypair.fromSecret(sourceSecretKey));
const result = await server.submitTransaction(transaction);
```

**Key characteristics:**
- Operations are predefined by the Stellar protocol
- Direct submission to Horizon (no simulation required)
- Simple, linear transaction building
- Limited to built-in operation types

### Soroban (Smart Contracts)

In Soroban, everything is a smart contract:

```typescript
import { StellarClient, VaultContract, LocalKeypairWalletConnector } from 'axionvera-sdk';
import { Keypair } from '@stellar/stellar-sdk';

const client = new StellarClient({ network: 'testnet' });
const wallet = new LocalKeypairWalletConnector(Keypair.fromSecret(secretKey));

const vault = new VaultContract({
  client,
  contractId: 'CA3D5KRYM6CB7OWQ6TWYMS7V4WOZ7U2EVFTRPZGJYJRVVNR5FCHCWZU',
  wallet
});

// One line to deposit - SDK handles everything
const result = await vault.deposit({ amount: 1000n });
```

**Key characteristics:**
- Custom logic in smart contracts
- Requires RPC connection (not Horizon)
- Must simulate before submitting to calculate fees and resource usage
- Unlimited flexibility through smart contracts
- Type-safe contract interactions

---

## Key Conceptual Differences

### 1. Operations vs. Contract Calls

**Classic:**
```typescript
// Built-in operation types
Operations.payment({ ... })
Operations.createAccount({ ... })
Operations.manageData({ ... })
Operations.setOptions({ ... })
// ... ~20 operation types total
```

**Soroban:**
```typescript
// Single operation type: InvokeHostFunction
// The "operation" is defined by the smart contract
Contract.call({
  contractId: 'C...',
  method: 'deposit',
  args: [ScVal.u128(1000)]
})
```

### 2. Horizon vs. Soroban RPC

**Classic:**
```typescript
// Horizon API - RESTful, returns transaction history
const server = new Server('https://horizon-testnet.stellar.org');
const account = await server.loadAccount(publicKey);
const transactions = await server.transactions().forAccount(publicKey).call();
```

**Soroban:**
```typescript
// Soroban RPC - JSON-RPC, focused on contract interaction
const client = new StellarClient({ network: 'testnet' });
const account = await client.getAccount(publicKey);
// Transaction history still available via Horizon, but contract state via RPC
```

### 3. Transaction Simulation

**Classic:**
```typescript
// No simulation required - build and submit
const transaction = new TransactionBuilder(account, { fee: '100', ... })
  .addOperation(...)
  .build();
transaction.sign(keypair);
await server.submitTransaction(transaction);
```

**Soroban:**
```typescript
// Simulation is MANDATORY to calculate resource costs
const transaction = await client.simulateTransaction(builtTx);
const preparedTx = await client.prepareTransaction(transaction);
preparedTx.sign(keypair);
await client.sendTransaction(preparedTx);
```

**With Axionvera SDK:**
```typescript
// SDK handles simulation automatically
const result = await vault.deposit({ amount: 1000n });
// build → simulate → prepare → sign → submit all in one call
```

### 4. Asset Handling

**Classic:**
```typescript
// Native asset and custom assets built into protocol
const native = Asset.native();
const custom = new Asset('USD', issuerPublicKey);

Operations.payment({
  destination: dest,
  asset: custom,
  amount: '100.50'
});
```

**Soroban:**
```typescript
// Assets are typically managed by smart contracts
// The contract defines token logic, transfers, approvals, etc.
const tokenContract = new TokenContract({
  client,
  contractId: tokenContractId,
  wallet
});

await tokenContract.transfer({
  to: destination,
  amount: 1000n
});
```

### 5. Fee Structure

**Classic:**
```typescript
// Simple base fee per operation
const transaction = new TransactionBuilder(account, {
  fee: '100', // 100 stroops per operation
  networkPassphrase: Networks.TESTNET
});
```

**Soroban:**
```typescript
// Complex fee structure: base fee + resource fee
// Resource fee depends on CPU instructions and memory used
const simulation = await client.simulateTransaction(tx);
const resourceFee = simulation.transactionData.resourceFee; // Calculated from usage
const totalFee = baseFee + resourceFee;
```

---

## Transaction Building: Side-by-Side Comparison

### Scenario 1: Simple Payment

**Classic (stellar-sdk v10):**
```typescript
import { Server, TransactionBuilder, Operations, Networks, Keypair, Asset } from 'stellar-sdk';

const server = new Server('https://horizon-testnet.stellar.org');
const sourceKeypair = Keypair.fromSecret(sourceSecretKey);
const sourceAccount = await server.loadAccount(sourceKeypair.publicKey());

const transaction = new TransactionBuilder(sourceAccount, {
  fee: '100',
  networkPassphrase: Networks.TESTNET
})
  .addOperation(Operations.payment({
    destination: destinationPublicKey,
    asset: Asset.native(),
    amount: '100.50'
  }))
  .setTimeout(30)
  .build();

transaction.sign(sourceKeypair);
const result = await server.submitTransaction(transaction);
console.log('Transaction hash:', result.hash);
```

**Soroban with Axionvera SDK:**
```typescript
import { StellarClient, LocalKeypairWalletConnector } from 'axionvera-sdk';
import { Keypair } from '@stellar/stellar-sdk';

const client = new StellarClient({ network: 'testnet' });
const wallet = new LocalKeypairWalletConnector(Keypair.fromSecret(sourceSecretKey));

// Assuming a payment contract exists
const paymentContract = new PaymentContract({
  client,
  contractId: paymentContractId,
  wallet
});

const result = await paymentContract.transfer({
  to: destinationPublicKey,
  amount: 1000n
});
console.log('Transaction hash:', result.hash);
```

**Key differences:**
- Classic uses built-in `payment` operation
- Soroban uses a smart contract for payments
- Axionvera SDK abstracts the contract interaction
- Soroban requires BigInt for amounts (no decimal strings)

### Scenario 2: Multi-Operation Transaction

**Classic (stellar-sdk v10):**
```typescript
const transaction = new TransactionBuilder(sourceAccount, {
  fee: '300', // 100 stroops × 3 operations
  networkPassphrase: Networks.TESTNET
})
  .addOperation(Operations.payment({
    destination: dest1,
    asset: Asset.native(),
    amount: '50.00'
  }))
  .addOperation(Operations.payment({
    destination: dest2,
    asset: Asset.native(),
    amount: '25.00'
  }))
  .addOperation(Operations.manageData({
    name: 'batch_payment',
    value: 'completed'
  }))
  .setTimeout(30)
  .build();

transaction.sign(sourceKeypair);
const result = await server.submitTransaction(transaction);
```

**Soroban with Axionvera SDK:**
```typescript
import { TransactionSigner } from 'axionvera-sdk';

const signer = new TransactionSigner({
  client,
  wallet,
  autoSimulate: true
});

const result = await signer.buildAndSignTransaction({
  sourceAccount: await wallet.getPublicKey(),
  operations: [
    {
      contractId: paymentContractId,
      method: 'transfer',
      args: [dest1, 5000n]
    },
    {
      contractId: paymentContractId,
      method: 'transfer',
      args: [dest2, 2500n]
    },
    {
      contractId: dataContractId,
      method: 'set',
      args: ['batch_payment', 'completed']
    }
  ]
});
```

**Key differences:**
- Classic: Each operation is a different type
- Soroban: All operations are contract calls
- Axionvera SDK: Unified interface for multiple contract calls
- Soroban: Arguments must be converted to ScVal (SDK handles this)

### Scenario 3: Creating an Account

**Classic (stellar-sdk v10):**
```typescript
const transaction = new TransactionBuilder(sourceAccount, {
  fee: '100',
  networkPassphrase: Networks.TESTNET
})
  .addOperation(Operations.createAccount({
    destination: newAccountPublicKey,
    startingBalance: '2.00' // XLM
  }))
  .setTimeout(30)
  .build();

transaction.sign(sourceKeypair);
const result = await server.submitTransaction(transaction);
```

**Soroban with Axionvera SDK:**
```typescript
// In Soroban, account creation is typically done via a contract
// or using the built-in create_account operation in InvokeHostFunction

const signer = new TransactionSigner({ client, wallet });

const result = await signer.buildAndSignTransaction({
  sourceAccount: await wallet.getPublicKey(),
  operations: [{
    contractId: 'native', // Special ID for built-in Soroban operations
    method: 'create_account',
    args: [newAccountPublicKey, 20000000n] // 2 XLM in stroops
  }]
});
```

### Scenario 4: Reading Account Data

**Classic (stellar-sdk v10):**
```typescript
// Load account from Horizon
const account = await server.loadAccount(publicKey);
console.log('Balance:', account.balances);
console.log('Sequence:', account.sequence);
console.log('Data:', account.data_attr);

// Read specific data entry
const dataValue = await server.loadAccount(publicKey)
  .then(account => account.data_attr['my_key']);
```

**Soroban with Axionvera SDK:**
```typescript
// Load account from Soroban RPC
const account = await client.getAccount(publicKey);
console.log('Balance:', account.balance);
console.log('Sequence:', account.seqNum);

// Read contract state (if using a contract for data storage)
const dataContract = new DataContract({
  client,
  contractId: dataContractId
});

const value = await dataContract.get({ key: 'my_key' });
console.log('Data value:', value);
```

### Scenario 5: Path Payments (Atomic Swaps)

**Classic (stellar-sdk v10):**
```typescript
const transaction = new TransactionBuilder(sourceAccount, {
  fee: '100',
  networkPassphrase: Networks.TESTNET
})
  .addOperation(Operations.pathPaymentStrictSend({
    sendAsset: Asset.native(),
    sendAmount: '100.00',
    destination: destinationPublicKey,
    destAsset: new Asset('USD', issuerPublicKey),
    destMin: '95.00',
    path: [new Asset('BTC', btcIssuer)]
  }))
  .setTimeout(30)
  .build();

transaction.sign(sourceKeypair);
const result = await server.submitTransaction(transaction);
```

**Soroban with Axionvera SDK:**
```typescript
// Path payments in Soroban are typically handled by DEX contracts
const dexContract = new DexContract({
  client,
  contractId: dexContractId,
  wallet
});

const result = await dexContract.swap({
  fromAsset: 'native',
  fromAmount: 100000000n, // 100 XLM in stroops
  toAsset: 'USD:G...',
  minToAmount: 95000000n, // Minimum 95 USD
  path: ['BTC:G...']
});
```

---

## Common Migration Scenarios

### Scenario 1: Migrating a Payment Service

**Before (Classic):**
```typescript
async function sendPayment(
  secretKey: string,
  destination: string,
  amount: string
): Promise<string> {
  const server = new Server('https://horizon-testnet.stellar.org');
  const keypair = Keypair.fromSecret(secretKey);
  const account = await server.loadAccount(keypair.publicKey());

  const tx = new TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: Networks.TESTNET
  })
    .addOperation(Operations.payment({
      destination,
      asset: Asset.native(),
      amount
    }))
    .setTimeout(30)
    .build();

  tx.sign(keypair);
  const result = await server.submitTransaction(tx);
  return result.hash;
}
```

**After (Soroban + Axionvera SDK):**
```typescript
async function sendPayment(
  secretKey: string,
  destination: string,
  amount: bigint
): Promise<string> {
  const client = new StellarClient({ network: 'testnet' });
  const wallet = new LocalKeypairWalletConnector(
    Keypair.fromSecret(secretKey)
  );

  const paymentContract = new PaymentContract({
    client,
    contractId: paymentContractId,
    wallet
  });

  const result = await paymentContract.transfer({
    to: destination,
    amount
  });

  return result.hash;
}
```

**Migration notes:**
- Amount changed from string to bigint (no decimals)
- Horizon server replaced by StellarClient
- Transaction building abstracted by contract module
- Simulation handled automatically

### Scenario 2: Migrating a Data Storage Service

**Before (Classic):**
```typescript
async function storeData(
  secretKey: string,
  key: string,
  value: string
): Promise<string> {
  const server = new Server('https://horizon-testnet.stellar.org');
  const keypair = Keypair.fromSecret(secretKey);
  const account = await server.loadAccount(keypair.publicKey());

  const tx = new TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: Networks.TESTNET
  })
    .addOperation(Operations.manageData({
      name: key,
      value
    }))
    .setTimeout(30)
    .build();

  tx.sign(keypair);
  const result = await server.submitTransaction(tx);
  return result.hash;
}

async function readData(publicKey: string, key: string): Promise<string> {
  const server = new Server('https://horizon-testnet.stellar.org');
  const account = await server.loadAccount(publicKey);
  return account.data_attr[key]?.value?.toString('base64') || '';
}
```

**After (Soroban + Axionvera SDK):**
```typescript
async function storeData(
  secretKey: string,
  key: string,
  value: string
): Promise<string> {
  const client = new StellarClient({ network: 'testnet' });
  const wallet = new LocalKeypairWalletConnector(
    Keypair.fromSecret(secretKey)
  );

  const dataContract = new DataContract({
    client,
    contractId: dataContractId,
    wallet
  });

  const result = await dataContract.set({ key, value });
  return result.hash;
}

async function readData(contractId: string, key: string): Promise<string> {
  const client = new StellarClient({ network: 'testnet' });
  const dataContract = new DataContract({
    client,
    contractId
  });

  return await dataContract.get({ key });
}
```

**Migration notes:**
- Data storage is now contract-based (more flexible)
- No 64-byte limit per entry (contract can handle larger data)
- Data is stored in contract state, not account data
- Reading doesn't require account loading

### Scenario 3: Migrating a Multi-Signature Service

**Before (Classic):**
```typescript
async function createMultiSigTx(
  sourceSecret: string,
  operations: Operation[],
  signers: string[]
): Promise<string> {
  const server = new Server('https://horizon-testnet.stellar.org');
  const sourceKeypair = Keypair.fromSecret(sourceSecret);
  const account = await server.loadAccount(sourceKeypair.publicKey());

  const tx = new TransactionBuilder(account, {
    fee: (100 * operations.length).toString(),
    networkPassphrase: Networks.TESTNET
  });

  operations.forEach(op => tx.addOperation(op));

  const builtTx = tx.setTimeout(30).build();
  builtTx.sign(sourceKeypair);

  // Additional signers would sign here
  signers.forEach(signerSecret => {
    const signerKeypair = Keypair.fromSecret(signerSecret);
    builtTx.sign(signerKeypair);
  });

  const result = await server.submitTransaction(builtTx);
  return result.hash;
}
```

**After (Soroban + Axionvera SDK):**
```typescript
async function createMultiSigTx(
  sourceSecret: string,
  operations: ContractCallArg[],
  signers: string[]
): Promise<string> {
  const client = new StellarClient({ network: 'testnet' });
  const sourceWallet = new LocalKeypairWalletConnector(
    Keypair.fromSecret(sourceSecret)
  );

  const signer = new TransactionSigner({
    client,
    wallet: sourceWallet,
    autoSimulate: true
  });

  // Build transaction with all operations
  const result = await signer.buildAndSignTransaction({
    sourceAccount: await sourceWallet.getPublicKey(),
    operations
  });

  // Additional signers would sign the XDR
  let signedXdr = result.signedXdr;
  for (const signerSecret of signers) {
    const signerWallet = new LocalKeypairWalletConnector(
      Keypair.fromSecret(signerSecret)
    );
    signedXdr = await signerWallet.signTransaction(
      signedXdr,
      Networks.TESTNET
    );
  }

  // Submit the multi-signed transaction
  const submitResult = await client.sendTransaction(
    TransactionBuilder.fromXDR(signedXdr, Networks.TESTNET)
  );

  return submitResult.hash;
}
```

**Migration notes:**
- Multi-signature logic is similar but uses XDR
- Soroban contracts can have their own multi-sig logic
- Axionvera SDK provides utilities for transaction signing

---

## Error Handling and Debugging

### Classic Error Handling

```typescript
try {
  const result = await server.submitTransaction(transaction);
  console.log('Success:', result.hash);
} catch (error) {
  if (error.response && error.response.data) {
    // Classic Horizon errors
    console.error('Horizon error:', error.response.data);
    console.error('Result codes:', error.response.data.extras.result_codes);
  }
}
```

### Soroban Error Handling with Axionvera SDK

```typescript
try {
  const result = await vault.deposit({ amount: 1000n });
  console.log('Success:', result.hash);
} catch (error) {
  // Axionvera SDK provides detailed error information
  if (error instanceof SimulationError) {
    console.error('Simulation failed:', error.message);
    console.error('Contract error:', error.contractError);
    console.error('CPU used:', error.cpuInstructions);
    console.error('Memory used:', error.memoryBytes);
  } else if (error instanceof TransactionError) {
    console.error('Transaction failed:', error.message);
    console.error('Status:', error.status);
    console.error('Result XDR:', error.resultXdr);
  }
}
```

### Common Soroban Errors and Solutions

| Error | Cause | Solution |
|-------|-------|----------|
| `Simulation failed` | Contract call reverted during simulation | Check contract logic, arguments, and account state |
| `Insufficient fee` | Resource fee too low | SDK auto-calculates, but may need manual override for complex ops |
| `Timeout` | Transaction not confirmed in polling window | Increase `timeoutMs` in `pollTransaction` |
| `Rate limited` | Too many RPC requests | SDK auto-retries with exponential backoff |
| `Invalid XDR` | Malformed transaction XDR | Ensure proper ScVal conversion for arguments |

---

## Best Practices

### 1. Always Use BigInt for Amounts

**Classic:**
```typescript
amount: '100.50' // String with decimal
```

**Soroban:**
```typescript
amount: 10050000000n // BigInt in smallest unit (stroops)
```

### 2. Leverage Contract Modules

Instead of building raw contract calls, use the provided contract modules:

```typescript
// Good: Use VaultContract
const vault = new VaultContract({ client, contractId, wallet });
await vault.deposit({ amount: 1000n });

// Avoid: Raw contract calls (unless necessary)
const operation = Contract.call({
  contractId,
  method: 'deposit',
  args: [ScVal.u128(1000)]
});
```

### 3. Use Wallet Connectors for Flexibility

```typescript
// Backend: LocalKeypairWalletConnector
const wallet = new LocalKeypairWalletConnector(keypair);

// Frontend: Implement WalletConnector for browser wallets
class FreighterWallet implements WalletConnector {
  async getPublicKey(): Promise<string> {
    return await window.freighter.getPublicKey();
  }

  async signTransaction(xdr: string, networkPassphrase: string): Promise<string> {
    return await window.freighter.signTransaction(xdr, networkPassphrase);
  }
}
```

### 4. Enable Logging for Debugging

```typescript
const client = new StellarClient({
  network: 'testnet',
  logLevel: 'debug' // Enables detailed logging
});
```

### 5. Handle Resource Estimation

```typescript
// For complex transactions, estimate costs first
const signer = new TransactionSigner({ client, wallet });

const simulation = await signer.simulateTransaction({
  sourceAccount: await wallet.getPublicKey(),
  operations: complexOperations
});

console.log('Estimated CPU:', simulation.cpuInstructions);
console.log('Estimated Memory:', simulation.memoryBytes);
console.log('Estimated Fee:', simulation.recommendedFee);
```

### 6. Use Network Configuration

```typescript
// Use predefined network configurations
const client = new StellarClient({ network: 'testnet' });

// Or override with custom RPC
const client = new StellarClient({
  network: 'testnet',
  rpcUrl: 'https://your-custom-rpc.com'
});
```

---

## Additional Resources

### Official Documentation
- [Stellar Soroban Documentation](https://developers.stellar.org/docs/build/soroban)
- [Axionvera SDK API Reference](./api/README.md)
- [SDK Overview](./sdk-overview.md)
- [Usage Guide](./usage-guide.md)

### Learning Resources
- [Soroban Smart Contract Tutorial](https://developers.stellar.org/docs/build/soroban-tutorials)
- [Stellar Developer Discord](https://discord.gg/stellar)
- [Axionvera Documentation](https://docs.axionvera.com)

### Code Examples
- [Deposit Example](../examples/depositExample.ts)
- [Withdraw Example](../examples/withdrawExample.ts)
- [Balance Example](../examples/balanceExample.ts)
- [Transaction Signing Examples](../examples/transaction-signing-examples.ts)

---

## Quick Reference Cheat Sheet

| Concept | Classic (stellar-sdk v10) | Soroban (Axionvera SDK) |
|---------|---------------------------|-------------------------|
| **Connection** | `new Server(horizonUrl)` | `new StellarClient({ network })` |
| **Account** | `server.loadAccount(pk)` | `client.getAccount(pk)` |
| **Transaction** | `TransactionBuilder(account, opts)` | `TransactionSigner` or contract methods |
| **Operations** | `Operations.payment()`, etc. | `Contract.call()` or contract modules |
| **Signing** | `tx.sign(keypair)` | `wallet.signTransaction(xdr, passphrase)` |
| **Submission** | `server.submitTransaction(tx)` | `client.sendTransaction(tx)` + `pollTransaction()` |
| **Amounts** | String with decimal (`'100.50'`) | BigInt (`10050000000n`) |
| **Assets** | `Asset.native()`, `new Asset()` | Contract-based tokens |
| **Fees** | Simple base fee | Base fee + resource fee (calculated) |
| **Simulation** | Not required | Required (auto-handled by SDK) |

---

## Conclusion

Migrating from Stellar Classic to Soroban represents a significant paradigm shift, but the Axionvera SDK makes this transition smooth. The key takeaways are:

1. **Smart contracts replace built-in operations** - More flexibility, more power
2. **RPC replaces Horizon for contract interactions** - Different API, similar concepts
3. **Simulation is mandatory** - SDK handles this automatically
4. **Contract modules provide familiar interfaces** - High-level abstractions for common tasks
5. **BigInt for amounts** - No more decimal strings

The Axionvera SDK is designed to feel familiar to Classic developers while unlocking the full potential of Soroban smart contracts. Start with the provided contract modules, and gradually explore lower-level building blocks as needed.

Welcome to the future of Stellar development! 🚀
