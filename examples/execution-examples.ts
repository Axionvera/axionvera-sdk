/**
 * Example: Soroban Transaction Execution Request and Result Examples
 * 
 * This file provides comprehensive examples of valid and invalid Soroban
 * transaction execution requests and results following the SDK schema.
 * 
 * These examples are contributor-safe and do not require real wallet secrets
 * or live network submissions. They demonstrate the schema structure for
 * testing and documentation purposes.
 */

import type {
  ExecutionNetwork,
  SimulationResult,
  SorobanExecutionRequest,
  SorobanExecutionResult
} from '../packages/core/src/execution';

// ============================================================================
// VALID EXECUTION REQUEST EXAMPLES
// ============================================================================

/**
 * Example of a minimal valid execution request.
 */
export const minimalValidRequest: SorobanExecutionRequest = {
  sourceAccount: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  contractId: 'CABCDEF0000000000000000000000000000000000000000000000000000000001',
  method: 'deposit',
  args: ['GUSER', '100'],
  network: {
    network: 'testnet',
    networkPassphrase: 'Test SDF Network ; September 2015',
    rpcUrl: 'https://soroban-testnet.stellar.org'
  }
};

/**
 * Example of a complete execution request with all optional fields.
 */
export const completeValidRequest: SorobanExecutionRequest = {
  sourceAccount: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  contractId: 'CABCDEF0000000000000000000000000000000000000000000000000000000001',
  method: 'deposit',
  args: ['GUSER', '100'],
  network: {
    network: 'testnet',
    networkPassphrase: 'Test SDF Network ; September 2015',
    rpcUrl: 'https://soroban-testnet.stellar.org',
    horizonUrl: 'https://horizon-testnet.stellar.org'
  },
  simulationResult: {
    status: 'success',
    hash: 'simulated-tx-hash-123',
    result: { amount: '100' },
    fee: 100n,
    cpuInstructions: 1000,
    memoryBytes: 500
  },
  signedXdr: 'AAAAAgAAAAA...mocked-xdr...',
  metadata: {
    requestId: 'req-123',
    timestamp: '2024-01-15T10:30:00Z',
    userId: 'user-456'
  }
};

/**
 * Example of an execution request with pre-simulation result.
 */
export const requestWithSimulation: SorobanExecutionRequest = {
  sourceAccount: 'GDEF9876543210ZYXWVUTSRQPONMLKJIHGFEDCBA',
  contractId: 'C1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHI',
  method: 'withdraw',
  args: ['GUSER', '50'],
  network: {
    network: 'testnet',
    networkPassphrase: 'Test SDF Network ; September 2015',
    rpcUrl: 'https://soroban-testnet.stellar.org'
  },
  simulationResult: {
    status: 'success',
    hash: 'simulated-withdraw-hash',
    result: { new_balance: '950' },
    fee: 150n,
    cpuInstructions: 2000,
    memoryBytes: 800
  }
};

/**
 * Example of an execution request with signed XDR.
 */
export const requestWithSignedXdr: SorobanExecutionRequest = {
  sourceAccount: 'GHIJ4567890123456789012345678901234567890123456789012345678',
  contractId: 'C9876543210987654321098765432109876543210987654321098765432109',
  method: 'claim_rewards',
  args: ['GUSER'],
  network: {
    network: 'futurenet',
    networkPassphrase: 'Test SDF Future Network ; October 2022',
    rpcUrl: 'https://soroban-futurenet.stellar.org'
  },
  signedXdr: 'AAAAAgAAAAAB...' // Mocked signed XDR
};

/**
 * Example of a mainnet execution request.
 */
export const mainnetRequest: SorobanExecutionRequest = {
  sourceAccount: 'GABCD1234567890EFGH4567890IJKL567890MNOP7890QRST567890UVWX',
  contractId: 'C1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ1234567890ABCDEFGHI',
  method: 'get_balance',
  args: ['GUSER'],
  network: {
    network: 'mainnet',
    networkPassphrase: 'Public Global Stellar Network ; September 2015',
    rpcUrl: 'https://soroban-api.stellar.org'
  }
};

// ============================================================================
// VALID EXECUTION RESULT EXAMPLES
// ============================================================================

/**
 * Example of a successful execution result.
 */
export const successResult: SorobanExecutionResult = {
  sourceAccount: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  contractId: 'CABCDEF0000000000000000000000000000000000000000000000000000000001',
  method: 'deposit',
  args: ['GUSER', '100'],
  network: {
    network: 'testnet',
    networkPassphrase: 'Test SDF Network ; September 2015',
    rpcUrl: 'https://soroban-testnet.stellar.org'
  },
  simulationResult: {
    status: 'success',
    hash: 'simulated-tx-hash',
    result: { amount: '100' },
    fee: 100n
  },
  signedXdr: 'AAAAAgAAAAA...',
  transactionHash: 'final-tx-hash-abc123',
  status: 'success',
  ledger: 12345,
  timestamp: '2024-01-15T10:30:00Z'
};

/**
 * Example of a failed execution result.
 */
export const failedResult: SorobanExecutionResult = {
  sourceAccount: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  contractId: 'CABCDEF0000000000000000000000000000000000000000000000000000000001',
  method: 'withdraw',
  args: ['GUSER', '1000'],
  network: {
    network: 'testnet',
    networkPassphrase: 'Test SDF Network ; September 2015',
    rpcUrl: 'https://soroban-testnet.stellar.org'
  },
  simulationResult: {
    status: 'failure',
    error: {
      message: 'Insufficient balance',
      code: 1
    }
  },
  transactionHash: 'failed-tx-hash-xyz789',
  status: 'failed',
  error: 'Transaction failed: Insufficient balance',
  timestamp: '2024-01-15T10:31:00Z'
};

/**
 * Example of a pending execution result.
 */
export const pendingResult: SorobanExecutionResult = {
  sourceAccount: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  contractId: 'CABCDEF0000000000000000000000000000000000000000000000000000000001',
  method: 'deposit',
  args: ['GUSER', '100'],
  network: {
    network: 'testnet',
    networkPassphrase: 'Test SDF Network ; September 2015',
    rpcUrl: 'https://soroban-testnet.stellar.org'
  },
  signedXdr: 'AAAAAgAAAAA...',
  transactionHash: 'pending-tx-hash-123',
  status: 'pending',
  timestamp: '2024-01-15T10:32:00Z'
};

/**
 * Example of an execution result with restore status.
 */
export const restoreResult: SorobanExecutionResult = {
  sourceAccount: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  contractId: 'CABCDEF0000000000000000000000000000000000000000000000000000000001',
  method: 'deposit',
  args: ['GUSER', '100'],
  network: {
    network: 'testnet',
    networkPassphrase: 'Test SDF Network ; September 2015',
    rpcUrl: 'https://soroban-testnet.stellar.org'
  },
  simulationResult: {
    status: 'restore',
    fee: 200n,
    cpuInstructions: 3000,
    memoryBytes: 1200
  },
  status: 'pending',
  timestamp: '2024-01-15T10:33:00Z'
};

/**
 * Example of an execution result with raw data.
 */
export const resultWithRaw: SorobanExecutionResult = {
  sourceAccount: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  contractId: 'CABCDEF0000000000000000000000000000000000000000000000000000000001',
  method: 'get_balance',
  args: ['GUSER'],
  network: {
    network: 'testnet',
    networkPassphrase: 'Test SDF Network ; September 2015',
    rpcUrl: 'https://soroban-testnet.stellar.org'
  },
  transactionHash: 'balance-tx-hash',
  status: 'success',
  result: { balance: '1000' },
  raw: {
    _parsed: true,
    _xdr: 'AAAAAgAAAAA...',
    _ledger: 12345
  },
  timestamp: '2024-01-15T10:34:00Z'
};

// ============================================================================
// INVALID EXECUTION REQUEST EXAMPLES
// ============================================================================

/**
 * Example of an invalid request (missing source account).
 */
export const invalidRequestMissingSourceAccount = {
  contractId: 'CABCDEF0000000000000000000000000000000000000000000000000000000001',
  method: 'deposit',
  args: ['GUSER', '100'],
  network: {
    network: 'testnet',
    networkPassphrase: 'Test SDF Network ; September 2015',
    rpcUrl: 'https://soroban-testnet.stellar.org'
  }
};

/**
 * Example of an invalid request (empty contract ID).
 */
export const invalidRequestEmptyContractId = {
  sourceAccount: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  contractId: '',
  method: 'deposit',
  args: ['GUSER', '100'],
  network: {
    network: 'testnet',
    networkPassphrase: 'Test SDF Network ; September 2015',
    rpcUrl: 'https://soroban-testnet.stellar.org'
  }
};

/**
 * Example of an invalid request (missing network).
 */
export const invalidRequestMissingNetwork = {
  sourceAccount: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  contractId: 'CABCDEF0000000000000000000000000000000000000000000000000000000001',
  method: 'deposit',
  args: ['GUSER', '100']
};

/**
 * Example of an invalid request (invalid network configuration).
 */
export const invalidRequestInvalidNetwork = {
  sourceAccount: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  contractId: 'CABCDEF0000000000000000000000000000000000000000000000000000000001',
  method: 'deposit',
  args: ['GUSER', '100'],
  network: {
    network: 'testnet',
    networkPassphrase: '', // Empty passphrase
    rpcUrl: 'https://soroban-testnet.stellar.org'
  }
};

/**
 * Example of an invalid request (invalid args type).
 */
export const invalidRequestInvalidArgs = {
  sourceAccount: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  contractId: 'CABCDEF0000000000000000000000000000000000000000000000000000000001',
  method: 'deposit',
  args: 'not-an-array', // Should be an array
  network: {
    network: 'testnet',
    networkPassphrase: 'Test SDF Network ; September 2015',
    rpcUrl: 'https://soroban-testnet.stellar.org'
  }
};

/**
 * Example of an invalid request (empty signed XDR).
 */
export const invalidRequestEmptySignedXdr = {
  sourceAccount: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  contractId: 'CABCDEF0000000000000000000000000000000000000000000000000000000001',
  method: 'deposit',
  args: ['GUSER', '100'],
  network: {
    network: 'testnet',
    networkPassphrase: 'Test SDF Network ; September 2015',
    rpcUrl: 'https://soroban-testnet.stellar.org'
  },
  signedXdr: '' // Empty string
};

// ============================================================================
// INVALID EXECUTION RESULT EXAMPLES
// ============================================================================

/**
 * Example of an invalid result (missing source account).
 */
export const invalidResultMissingSourceAccount = {
  contractId: 'CABCDEF0000000000000000000000000000000000000000000000000000000001',
  method: 'deposit',
  args: ['GUSER', '100'],
  network: {
    network: 'testnet',
    networkPassphrase: 'Test SDF Network ; September 2015',
    rpcUrl: 'https://soroban-testnet.stellar.org'
  },
  status: 'success'
};

/**
 * Example of an invalid result (invalid status).
 */
export const invalidResultInvalidStatus = {
  sourceAccount: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  contractId: 'CABCDEF0000000000000000000000000000000000000000000000000000000001',
  method: 'deposit',
  args: ['GUSER', '100'],
  network: {
    network: 'testnet',
    networkPassphrase: 'Test SDF Network ; September 2015',
    rpcUrl: 'https://soroban-testnet.stellar.org'
  },
  status: 'invalid_status' // Not a valid status
};

/**
 * Example of an invalid result (negative ledger).
 */
export const invalidResultNegativeLedger = {
  sourceAccount: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  contractId: 'CABCDEF0000000000000000000000000000000000000000000000000000000001',
  method: 'deposit',
  args: ['GUSER', '100'],
  network: {
    network: 'testnet',
    networkPassphrase: 'Test SDF Network ; September 2015',
    rpcUrl: 'https://soroban-testnet.stellar.org'
  },
  status: 'success',
  ledger: -1 // Negative ledger number
};

/**
 * Example of an invalid result (empty transaction hash).
 */
export const invalidResultEmptyTransactionHash = {
  sourceAccount: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
  contractId: 'CABCDEF0000000000000000000000000000000000000000000000000000000001',
  method: 'deposit',
  args: ['GUSER', '100'],
  network: {
    network: 'testnet',
    networkPassphrase: 'Test SDF Network ; September 2015',
    rpcUrl: 'https://soroban-testnet.stellar.org'
  },
  transactionHash: '', // Empty hash
  status: 'success'
};

// ============================================================================
// SIMULATION RESULT EXAMPLES
// ============================================================================

/**
 * Example of a successful simulation result.
 */
export const successSimulation: SimulationResult = {
  status: 'success',
  hash: 'simulated-hash-123',
  result: { value: 42 },
  fee: 100n,
  cpuInstructions: 1000,
  memoryBytes: 500
};

/**
 * Example of a failed simulation result.
 */
export const failureSimulation: SimulationResult = {
  status: 'failure',
  error: {
    message: 'Contract invocation trapped',
    code: 1
  }
};

/**
 * Example of a restore simulation result.
 */
export const restoreSimulation: SimulationResult = {
  status: 'restore',
  fee: 200n,
  cpuInstructions: 2000,
  memoryBytes: 1000
};

/**
 * Example of a simulation result with minimal fields.
 */
export const minimalSimulation: SimulationResult = {
  status: 'success'
};

// ============================================================================
// NETWORK CONFIGURATION EXAMPLES
// ============================================================================

/**
 * Example of testnet network configuration.
 */
export const testnetNetwork: ExecutionNetwork = {
  network: 'testnet',
  networkPassphrase: 'Test SDF Network ; September 2015',
  rpcUrl: 'https://soroban-testnet.stellar.org',
  horizonUrl: 'https://horizon-testnet.stellar.org'
};

/**
 * Example of mainnet network configuration.
 */
export const mainnetNetwork: ExecutionNetwork = {
  network: 'mainnet',
  networkPassphrase: 'Public Global Stellar Network ; September 2015',
  rpcUrl: 'https://soroban-api.stellar.org',
  horizonUrl: 'https://horizon.stellar.org'
};

/**
 * Example of futurenet network configuration.
 */
export const futurenetNetwork: ExecutionNetwork = {
  network: 'futurenet',
  networkPassphrase: 'Test SDF Future Network ; October 2022',
  rpcUrl: 'https://soroban-futurenet.stellar.org'
};

/**
 * Example of custom network configuration.
 */
export const customNetwork: ExecutionNetwork = {
  network: 'custom-network',
  networkPassphrase: 'Custom Network Passphrase',
  rpcUrl: 'https://custom-soroban.example.com'
};

// ============================================================================
// USAGE EXAMPLES
// ============================================================================

/**
 * Example of using the execution schema in code.
 */
export function usageExample() {
  // Create a valid execution request
  const request: SorobanExecutionRequest = {
    sourceAccount: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    contractId: 'CABCDEF0000000000000000000000000000000000000000000000000000000001',
    method: 'deposit',
    args: ['GUSER', '100'],
    network: testnetNetwork
  };

  // Simulate creating a successful result
  const result: SorobanExecutionResult = {
    ...request,
    transactionHash: 'tx-hash-123',
    status: 'success',
    timestamp: new Date().toISOString()
  };

  return { request, result };
}

/**
 * Example of validation usage.
 */
export function validationExample() {
  import {
    validateSorobanExecutionRequestSchema,
    validateSorobanExecutionResultSchema
  } from '../packages/core/src/executionSchemas';

  // Validate a request
  try {
    const validRequest = validateSorobanExecutionRequestSchema(minimalValidRequest);
    console.log('Request is valid:', validRequest);
  } catch (error) {
    console.error('Request validation failed:', error);
  }

  // Validate a result
  try {
    const validResult = validateSorobanExecutionResultSchema(successResult);
    console.log('Result is valid:', validResult);
  } catch (error) {
    console.error('Result validation failed:', error);
  }
}

export default {
  // Valid requests
  minimalValidRequest,
  completeValidRequest,
  requestWithSimulation,
  requestWithSignedXdr,
  mainnetRequest,

  // Valid results
  successResult,
  failedResult,
  pendingResult,
  restoreResult,
  resultWithRaw,

  // Invalid requests
  invalidRequestMissingSourceAccount,
  invalidRequestEmptyContractId,
  invalidRequestMissingNetwork,
  invalidRequestInvalidNetwork,
  invalidRequestInvalidArgs,
  invalidRequestEmptySignedXdr,

  // Invalid results
  invalidResultMissingSourceAccount,
  invalidResultInvalidStatus,
  invalidResultNegativeLedger,
  invalidResultEmptyTransactionHash,

  // Simulation results
  successSimulation,
  failureSimulation,
  restoreSimulation,
  minimalSimulation,

  // Network configurations
  testnetNetwork,
  mainnetNetwork,
  futurenetNetwork,
  customNetwork,

  // Usage examples
  usageExample,
  validationExample
};
