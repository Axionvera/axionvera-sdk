# simulateBatch() Feature Implementation

## Overview
Added `simulateBatch()` method to `StellarClient` that allows simulating multiple contract operations in a single network call. This significantly improves performance when a user wants to perform multiple actions (e.g., deposit into 3 different vaults) by eliminating the need for sequential simulation calls.

## Problem Solved
Previously, if a user wanted to simulate 3 separate vault deposits, the SDK would require 3 separate RPC calls:
```typescript
// OLD WAY - 3 network round trips
const sim1 = await client.simulateTransaction(tx1);
const sim2 = await client.simulateTransaction(tx2);
const sim3 = await client.simulateTransaction(tx3);
```

Now with `simulateBatch()`, all 3 operations can be simulated in a single RPC call:
```typescript
// NEW WAY - 1 network round trip
const results = await client.simulateBatch({
  operations: [op1, op2, op3],
  sourceAccount: account
});
```

## Key Benefits
1. **Performance**: Single RPC call instead of multiple calls reduces latency
2. **Atomicity**: All results returned together for consistent frontend display
3. **Better UX**: Users see results for all operations simultaneously
4. **Resource Efficiency**: Reduces network bandwidth and RPC server load

## Implementation Details

### Method Signature
```typescript
async simulateBatch(params: {
  operations: xdr.Operation[];
  sourceAccount: Account;
  fee?: number;           // Fee per operation (default: 100_000)
  timeoutInSeconds?: number;  // Transaction timeout (default: 60)
}): Promise<rpc.Api.SimulateTransactionResponse['result']>
```

### How It Works
1. Takes an array of XDR operations
2. Combines them into a single transaction with calculated total fee
3. Sends to Soroban RPC `simulateTransaction` endpoint
4. Returns array of results, one per operation

### Fee Calculation
- Total fee = `fee per operation` × `number of operations`
- Default fee per operation: 100,000 stroops
- Example: 3 operations × 100,000 = 300,000 stroops total

### Error Handling
- Throws `SimulationFailedError` if the batch simulation fails
- Throws `AxionveraError` if operations array is empty
- Respects Soroban transaction limits (throws error if batch exceeds CPU/RAM limits)

## Files Modified

### 1. [src/client/stellarClient.ts](../src/client/stellarClient.ts)
- Added `simulateBatch()` method
- Added `xdr` to imports from "@stellar/stellar-sdk"

### 2. [packages/core/src/client/stellarClient.ts](../packages/core/src/client/stellarClient.ts)
- Added `simulateBatch()` method with error handling wrapper
- Uses `retry()` for fault tolerance
- Includes logging for debugging

### 3. [tests/stellarClient.test.ts](../tests/stellarClient.test.ts)
- Added comprehensive test cases for `simulateBatch()`
- Tests include:
  - Multiple operations simulation
  - Empty operations array error handling
  - Single operation batch
  - Custom fee calculation
  - Fee multiplication verification
  - Simulation error handling
  - Custom timeout handling

### 4. [examples/batchDepositExample.ts](../examples/batchDepositExample.ts)
- New example demonstrating batch simulation of 3 vault deposits
- Shows how to:
  - Build multiple contract operations
  - Use `simulateBatch()` to simulate all at once
  - Process results
  - Build and sign the actual transaction
  - Handle errors

## Usage Example

```typescript
import { StellarClient, buildContractCallOperation } from "axionvera-sdk";
import { nativeToScVal, Address } from "@stellar/stellar-sdk";

const client = new StellarClient({ network: "testnet" });
const account = await client.getAccount(publicKey);

// Build operations for depositing into 3 vaults
const operations = [
  buildContractCallOperation({
    contractId: vault1Id,
    method: "deposit",
    args: [nativeToScVal(1000n, { type: "i128" }), new Address(publicKey).toScVal()]
  }),
  buildContractCallOperation({
    contractId: vault2Id,
    method: "deposit",
    args: [nativeToScVal(2000n, { type: "i128" }), new Address(publicKey).toScVal()]
  }),
  buildContractCallOperation({
    contractId: vault3Id,
    method: "deposit",
    args: [nativeToScVal(1500n, { type: "i128" }), new Address(publicKey).toScVal()]
  })
];

// Simulate all 3 operations in a single call
const results = await client.simulateBatch({
  operations,
  sourceAccount: account,
  fee: 100_000,  // Per operation
  timeoutInSeconds: 60
});

// Process results
results.forEach((result, index) => {
  console.log(`Operation ${index + 1}:`, result.xdr ? "✅ Success" : "❌ Error");
});

// Build the actual transaction
const builder = new TransactionBuilder(account, {
  fee: (100_000 * operations.length).toString(),
  networkPassphrase: client.networkPassphrase
});

for (const op of operations) {
  builder.addOperation(op);
}

const tx = builder.setTimeout(60).build();
tx.sign(keypair);

// Send transaction
const result = await client.sendTransaction(tx);
console.log(`Transaction sent: ${result.hash}`);
```

## Important Considerations

### Soroban Transaction Limits
- Each operation in a batch has CPU/RAM resource requirements
- A large batch may fail if it exceeds the maximum limits for a single transaction
- The RPC will return an error indicating resource exhaustion
- Users should be prepared for this failure the UI should display the error appropriately

### Best Practices
1. **Test batch sizes**: Start with small batches (2-3 operations) and increase if needed
2. **High fee for complex operations**: Complex operations may need higher fees
3. **Error display**: Show simulation errors to users so they can adjust their batch
4. **Atomic execution**: If all simulations succeed, the actual transaction will have the same operations
5. **Network considerations**: Even though it's 1 RPC call, the transaction is still subject to normal Soroban constraints

## Testing
Tests have been added to [tests/stellarClient.test.ts](../tests/stellarClient.test.ts) covering:
- Basic batch simulation with multiple operations
- Empty operations array validation
- Fee calculation logic
- Error handling
- Custom timeout handling
- Single operation batches

Run tests with:
```bash
npm test -- tests/stellarClient.test.ts
```

## Backward Compatibility
- No breaking changes
- Existing `simulateTransaction()` method continues to work as before
- New method is purely additive

## Future Improvements
1. **Batch optimization**: Automatic batch size optimization based on operation complexity
2. **Retry logic**: Automatic retry with reduced batch size on resource exhaustion
3. **Analytics**: Track batch simulation metrics for optimization
4. **Streaming results**: For very large batches, stream results as they complete
