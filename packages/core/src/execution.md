# Soroban Transaction Execution Schema

## Overview

The Soroban transaction execution schema provides a stable, type-safe structure for SDK transaction execution requests and results. This schema is designed to be contributor-safe and does not require real wallet secrets or live network submissions.

## Purpose

The execution schema serves as the foundation for Soroban transaction flows in the SDK:

1. **Type Safety**: Provides TypeScript interfaces for compile-time validation
2. **Runtime Validation**: Includes schema validators for runtime checks
3. **Testing**: Enables comprehensive testing without live network calls
4. **Documentation**: Serves as executable documentation for transaction structures
5. **Migration Path**: Prepares the SDK for real transaction execution when implemented

## Current Status

### Mocked/Testnet-Ready

The execution schema is currently in a **mocked/testnet-ready** state:

- ✅ **Schema Definition**: Complete type definitions and validation
- ✅ **Testing Infrastructure**: Comprehensive test coverage
- ✅ **Examples**: Extensive valid and invalid examples
- ✅ **No Real Secrets**: All examples use mock data
- ✅ **No Live Submission**: No actual transaction submission logic
- ⏳ **Real Execution**: Transaction signing and submission to be implemented later

### What Works Now

- **Request Building**: Create and validate execution requests
- **Result Creation**: Generate success/failure/pending results
- **Schema Validation**: Validate all execution objects
- **Type Guards**: Runtime type checking for execution objects
- **Testing**: Complete test coverage for all scenarios

### What's Coming Later

- **Real Transaction Signing**: Integration with wallet connectors
- **Live Network Submission**: Actual RPC calls to Stellar networks
- **XDR Assembly**: Real Stellar transaction envelope construction
- **Fee Management**: Dynamic fee calculation and inclusion
- **Sequence Management**: Account sequence number handling

## Schema Structure

### Execution Request

```typescript
interface SorobanExecutionRequest {
  sourceAccount: string;           // Public key of the source account
  contractId: string;             // Stellar contract ID to invoke
  method: string;                 // Contract method to call
  args: readonly unknown[];       // Method arguments in order
  network: ExecutionNetwork;      // Network configuration
  simulationResult?: SimulationResult; // Optional pre-simulation
  signedXdr?: string;            // Optional signed transaction XDR
  metadata?: Record<string, unknown>; // Optional metadata
}
```

### Execution Result

```typescript
interface SorobanExecutionResult {
  sourceAccount: string;           // Source account used
  contractId: string;             // Contract that was invoked
  method: string;                 // Method that was called
  args: readonly unknown[];       // Arguments that were passed
  network: ExecutionNetwork;      // Network configuration used
  simulationResult?: SimulationResult; // Simulation if performed
  signedXdr?: string;            // Signed XDR if generated
  transactionHash?: string;      // Final transaction hash
  status: TransactionStatus;     // Final transaction status
  ledger?: number;               // Ledger number if included
  error?: string;                // Error message if failed
  timestamp?: string;            // Execution timestamp
  raw?: unknown;                 // Raw RPC response
}
```

### Network Configuration

```typescript
interface ExecutionNetwork {
  network: string;                // Network identifier (testnet, mainnet, etc.)
  networkPassphrase: string;      // Stellar network passphrase
  rpcUrl: string;                // RPC endpoint URL
  horizonUrl?: string;           // Optional Horizon endpoint URL
}
```

### Simulation Result

```typescript
interface SimulationResult {
  status: 'success' | 'failure' | 'restore';
  hash?: string;                 // Transaction hash
  result?: unknown;              // Contract return value
  error?: {                      // Error details for failures
    message: string;
    code?: number;
  };
  fee?: bigint;                  // Estimated fee
  cpuInstructions?: number;      // Estimated CPU usage
  memoryBytes?: number;          // Estimated memory usage
}
```

## Usage Examples

### Building an Execution Request

```typescript
import { buildSorobanExecutionRequest } from './execution';

const request = buildSorobanExecutionRequest({
  sourceAccount: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  contractId: 'C123...',
  method: 'deposit',
  args: ['GUSER', '100'],
  network: {
    network: 'testnet',
    networkPassphrase: 'Test SDF Network ; September 2015',
    rpcUrl: 'https://soroban-testnet.stellar.org'
  }
});
```

### Creating Execution Results

```typescript
import { executionSuccess, executionFailed, executionPending } from './execution';

// Success result
const successResult = executionSuccess(request, 'tx-hash-123', {
  ledger: 12345
});

// Failed result
const failedResult = executionFailed(request, 'Insufficient balance', {
  transactionHash: 'failed-tx-hash'
});

// Pending result
const pendingResult = executionPending(request, 'pending-tx-hash');
```

### Schema Validation

```typescript
import {
  validateSorobanExecutionRequestSchema,
  validateSorobanExecutionResultSchema
} from './executionSchemas';

// Validate request
try {
  const validRequest = validateSorobanExecutionRequestSchema(rawRequest);
  console.log('Request is valid:', validRequest);
} catch (error) {
  console.error('Invalid request:', error);
}

// Validate result
try {
  const validResult = validateSorobanExecutionResultSchema(rawResult);
  console.log('Result is valid:', validResult);
} catch (error) {
  console.error('Invalid result:', error);
}
```

### Type Guards

```typescript
import {
  isSorobanExecutionRequest,
  isSorobanExecutionResult
} from './executionSchemas';

if (isSorobanExecutionRequest(someObject)) {
  // TypeScript knows this is a SorobanExecutionRequest
  console.log('Valid request for:', someObject.contractId);
}

if (isSorobanExecutionResult(someObject)) {
  // TypeScript knows this is a SorobanExecutionResult
  console.log('Transaction status:', someObject.status);
}
```

## Testing

The execution schema includes comprehensive test coverage:

### Unit Tests

- **Request Building**: Valid and invalid request construction
- **Result Creation**: Success, failure, and pending result generation
- **Schema Validation**: Full schema validation for all types
- **Type Guards**: Runtime type checking functionality
- **Edge Cases**: Empty fields, invalid types, boundary conditions

### Example Tests

- **Valid Examples**: All examples from `execution-examples.ts` are tested
- **Invalid Examples**: Invalid objects are tested to ensure proper validation
- **Network Configurations**: Different network configurations tested
- **Simulation Results**: All simulation status types tested

### Running Tests

```bash
# Run execution schema tests
npx vitest run packages/core/src/execution.test.ts

# Run all core tests
npx vitest run packages/core
```

## Security Considerations

### No Real Secrets

The execution schema is designed to be contributor-safe:

- ✅ **No Private Keys**: Examples use mock public keys only
- ✅ **No Real XDR**: Signed XDR fields use placeholder values
- ✅ **No Live Networks**: All network URLs are standard public endpoints
- ✅ **No Real Transactions**: No actual transaction submission logic

### Safe for Testing

- ✅ **Isolated Validation**: All validation happens locally
- ✅ **No Network Calls**: Schema validation doesn't require network access
- ✅ **No Side Effects**: Validation functions are pure
- ✅ **Type Safe**: TypeScript provides compile-time safety

## Migration to Real Execution

When real transaction execution is implemented, the schema will remain compatible:

### Phase 1: Current State
- Schema definition and validation
- Mock data and examples
- Testing infrastructure
- No real execution logic

### Phase 2: Transaction Building
- XDR assembly from execution requests
- Fee calculation and inclusion
- Sequence number management
- Integration with wallet connectors

### Phase 3: Network Submission
- Real RPC calls to Stellar networks
- Transaction submission and monitoring
- Real network-specific configurations
- Error handling for network failures

### Phase 4: Production Ready
- Complete transaction lifecycle
- Mainnet support
- Advanced error recovery
- Performance optimization

The schema structure will remain stable throughout these phases, ensuring backward compatibility.

## Network Configurations

### Testnet

```typescript
const testnetNetwork = {
  network: 'testnet',
  networkPassphrase: 'Test SDF Network ; September 2015',
  rpcUrl: 'https://soroban-testnet.stellar.org',
  horizonUrl: 'https://horizon-testnet.stellar.org'
};
```

### Mainnet

```typescript
const mainnetNetwork = {
  network: 'mainnet',
  networkPassphrase: 'Public Global Stellar Network ; September 2015',
  rpcUrl: 'https://soroban-api.stellar.org',
  horizonUrl: 'https://horizon.stellar.org'
};
```

### Futurenet

```typescript
const futurenetNetwork = {
  network: 'futurenet',
  networkPassphrase: 'Test SDF Future Network ; October 2022',
  rpcUrl: 'https://soroban-futurenet.stellar.org'
};
```

## Best Practices

### Request Building

1. **Always Validate**: Use `buildSorobanExecutionRequest` for automatic validation
2. **Trim Input**: The builder automatically trims whitespace
3. **Provide Context**: Use metadata for debugging and tracking
4. **Include Network**: Always provide complete network configuration

### Result Creation

1. **Use Factory Functions**: Use `executionSuccess`, `executionFailed`, etc.
2. **Include Timestamp**: Results automatically include timestamps
3. **Preserve Context**: Results include all request context
4. **Handle Errors**: Use proper error messages in failed results

### Validation

1. **Schema Validation**: Use full schema validation for external data
2. **Type Guards**: Use type guards for runtime checks
3. **Error Handling**: Always catch and handle validation errors
4. **Logging**: Log validation failures for debugging

## Error Handling

### Validation Errors

All validation functions throw `ValidationError` with descriptive messages:

```typescript
import { ValidationError } from './errors';

try {
  const request = buildSorobanExecutionRequest(invalidInput);
} catch (error) {
  if (error instanceof ValidationError) {
    console.error('Validation failed:', error.message);
    // Handle validation error
  }
}
```

### Common Validation Errors

- **Missing Required Fields**: sourceAccount, contractId, method, network
- **Empty Strings**: Empty string values for required fields
- **Invalid Types**: Wrong types for args, metadata, etc.
- **Invalid Network**: Missing or invalid network configuration
- **Invalid Status**: Invalid transaction or simulation status

## Related Modules

- **Transactions**: Core transaction utilities and types
- **Soroban**: Soroban-specific invocation and simulation
- **Network**: Network configuration and utilities
- **Testing**: Mock simulation adapter for testing
- **Errors**: Error types and validation utilities

## Contributing

When contributing to the execution schema:

1. **Update Examples**: Add new examples to `execution-examples.ts`
2. **Add Tests**: Ensure new features have test coverage
3. **Update Docs**: Keep this documentation current
4. **Maintain Compatibility**: Don't break existing schema structure
5. **No Secrets**: Never add real private keys or secrets

## See Also

- [Execution Examples](../../../examples/execution-examples.ts)
- [Execution Tests](../src/execution.test.ts)
- [Schema Validators](../src/executionSchemas.ts)
- [Mock Simulation Adapter](./mockSimulationAdapter.ts)
- [Transaction Utilities](../transactions.ts)
