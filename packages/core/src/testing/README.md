# Mock Soroban Simulation Adapter

## Overview

The `MockSimulationAdapter` provides a mocked implementation of Soroban transaction simulation for SDK testing. It allows developers to test transaction flows without making real RPC calls to the Stellar network.

This adapter is designed to be **contributor-safe** and **isolated from real network operations**, making it ideal for:
- Unit testing transaction logic
- Integration testing SDK components
- Developing and validating transaction flows
- CI/CD pipeline testing

## Purpose

The mock adapter serves as a placeholder until real Soroban simulation is implemented. It provides:

1. **Predictable simulation-style outputs** - Returns structured responses that mirror real Soroban simulation results
2. **Success and failure scenarios** - Test both happy paths and error conditions
3. **No network dependencies** - Runs entirely in-memory without external calls
4. **Type-safe interfaces** - Follows the documented schema for future real simulation

## Migration Path

The mock adapter is designed to be replaced by real Soroban simulation when available:

### Current State (Mock)
```typescript
import { MockSimulationAdapter } from './testing';

const adapter = new MockSimulationAdapter({
  responses: [
    {
      method: 'deposit',
      response: { status: 'success', hash: 'simulated-hash' }
    }
  ]
});

const result = await adapter.simulate(request);
```

### Future State (Real Simulation)
```typescript
import { SorobanSimulationAdapter } from './soroban';

const adapter = new SorobanSimulationAdapter({
  rpcUrl: 'https://soroban-testnet.stellar.org'
});

const result = await adapter.simulate(request); // Same interface!
```

The migration will be seamless because:
- The `simulate()` method signature remains consistent
- The `SimulationResult` type structure matches real Soroban responses
- Configuration options will extend, not replace, the current interface

## Usage

### Basic Success Simulation

```typescript
import { createSuccessSimulationAdapter } from './testing';

const adapter = createSuccessSimulationAdapter();

const result = await adapter.simulate({
  contractId: 'C123...',
  method: 'deposit',
  args: ['GUSER', '100']
});

// result.status === 'success'
// result.hash === 'simulated-success-hash'
```

### Basic Failure Simulation

```typescript
import { createFailureSimulationAdapter } from './testing';

const adapter = createFailureSimulationAdapter('Insufficient balance');

const result = await adapter.simulate({
  contractId: 'C123...',
  method: 'withdraw',
  args: ['GUSER', '1000']
});

// result.status === 'failure'
// result.error?.message === 'Insufficient balance'
```

### Custom Configuration

```typescript
import { MockSimulationAdapter } from './testing';

const adapter = new MockSimulationAdapter({
  responses: [
    {
      method: 'deposit',
      response: {
        status: 'success',
        hash: 'custom-tx-hash',
        result: { new_balance: '1100' },
        fee: 150n,
        cpuInstructions: 2500,
        memoryBytes: 800
      }
    }
  ]
});
```

### Dynamic Updates

```typescript
const adapter = new MockSimulationAdapter();

// Update response during testing
adapter.setSimulationResponse('deposit', {
  status: 'success',
  hash: 'new-hash'
});

// Clear specific response
adapter.clearSimulationResponse('deposit');

// Reset all
adapter.reset();
```

## Simulation Result Schema

The mock adapter returns results following the Soroban simulation schema:

```typescript
interface SimulationResult {
  status: 'success' | 'failure' | 'restore';
  hash?: string;                    // Present for successful simulations
  result?: unknown;                 // Parsed return value from contract
  error?: {
    message: string;                // Error message from contract/host
    code?: number;                 // Optional error code
  };
  fee?: bigint;                    // Gas/fee estimates
  cpuInstructions?: number;        // Required CPU usage
  memoryBytes?: number;            // Required memory usage
}
```

### Status Types

- **`success`**: Transaction simulation completed successfully
- **`failure`**: Transaction simulation failed (contract error, host error, etc.)
- **`restore`**: Transaction requires a restore operation before execution

## Factory Methods

### Create Success Result

```typescript
const result = MockSimulationAdapter.createSuccessResult({
  hash: 'custom-hash',
  result: { value: 42 },
  fee: 500n
});
```

### Create Failure Result

```typescript
const result = MockSimulationAdapter.createFailureResult('Error message', {
  error: { message: 'Custom error', code: 42 }
});
```

### Create Restore Result

```typescript
const result = MockSimulationAdapter.createRestoreResult({
  fee: 200n,
  cpuInstructions: 3000
});
```

## Testing Patterns

### Unit Testing Transaction Logic

```typescript
describe('Transaction Flow', () => {
  it('handles successful deposit', async () => {
    const adapter = new MockSimulationAdapter({
      responses: [
        {
          method: 'deposit',
          response: MockSimulationAdapter.createSuccessResult({
            result: { new_balance: '1100' }
          })
        }
      ]
    });

    const result = await adapter.simulate(depositRequest);
    expect(result.status).toBe('success');
    expect(result.result).toEqual({ new_balance: '1100' });
  });
});
```

### Integration Testing with SDK Components

```typescript
import { VaultContract } from './contracts/vault';
import { MockSimulationAdapter } from './testing';

it('integrates with VaultContract', async () => {
  const adapter = new MockSimulationAdapter({
    responses: [
      {
        method: 'deposit',
        response: MockSimulationAdapter.createSuccessResult()
      }
    ]
  });

  const vault = new VaultContract({
    contractId: 'CVAULT',
    invoker: adapter // Adapter implements ContractInvoker interface
  });

  const result = await vault.deposit('GUSER', 100n);
  expect(result.status).toBe('success');
});
```

### Error Scenario Testing

```typescript
it('handles insufficient balance errors', async () => {
  const adapter = new MockSimulationAdapter({
    responses: [
      {
        method: 'withdraw',
        response: MockSimulationAdapter.createFailureResult(
          'Insufficient balance',
          { error: { code: 42 } }
        )
      }
    ]
  });

  const result = await adapter.simulate(withdrawRequest);
  expect(result.status).toBe('failure');
  expect(result.error?.code).toBe(42);
});
```

## Real Simulation Integration

When real Soroban simulation is implemented, the migration path will be:

1. **Interface Compatibility**: The real adapter will implement the same `simulate()` method
2. **Configuration Extension**: Additional RPC/network configuration options will be added
3. **Schema Alignment**: The `SimulationResult` type will match real Stellar responses
4. **Backward Compatibility**: Mock adapter will remain for testing

### Planned Real Adapter Interface

```typescript
class SorobanSimulationAdapter {
  constructor(config: {
    rpcUrl: string;
    networkPassphrase: string;
    timeout?: number;
  });

  async simulate(request: SorobanInvokeRequest): Promise<SimulationResult>;
}
```

## Best Practices

1. **Use Mocks for Unit Tests**: Prefer mock adapter for isolated unit tests
2. **Test Edge Cases**: Configure both success and failure scenarios
3. **Validate Schema**: Ensure mock responses match expected structure
4. **Keep Tests Fast**: Mock adapter runs in-memory, avoiding network latency
5. **Document Scenarios**: Comment on what each test case validates

## Limitations

- **No Real Network Validation**: Mock adapter doesn't validate against actual contract logic
- **Static Responses**: Responses are pre-configured, not dynamically generated
- **No Gas Estimation**: Fee estimates are static values, not calculated based on real execution
- **No State Changes**: Mock adapter doesn't track or modify contract state

## Future Enhancements

When real simulation is available, consider adding:

- **Dynamic Response Generation**: Generate responses based on request parameters
- **State Tracking**: Maintain simulated contract state across calls
- **Gas Calculation**: Implement realistic fee estimation
- **Transaction Validation**: Add Stellar transaction validation logic
- **Network Switching**: Support multiple network configurations

## Contributing

When contributing to the SDK:

1. **Use Mock Adapter**: Add tests using the mock adapter for new transaction logic
2. **Update Examples**: Keep examples current with new features
3. **Document Changes**: Update this README when adding new mock behaviors
4. **Maintain Compatibility**: Ensure changes don't break existing mock interfaces

## See Also

- [Mock Simulation Examples](../../../examples/mock-simulation-example.ts)
- [Soroban Implementation](../soroban.ts)
- [Testing Utilities](./testInvoker.ts)
- [Vault Contract](../contracts/vault.ts)
