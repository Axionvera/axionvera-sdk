import { describe, expect, it } from 'vitest';

import { ValidationError } from './errors';
import {
  ExecutionNetwork,
  SimulationResult,
  SorobanExecutionRequest,
  SorobanExecutionResult,
  buildSorobanExecutionRequest,
  executionSuccess,
  executionFailed,
  executionPending,
  validateSorobanExecutionResult
} from './execution';
import {
  validateExecutionNetwork,
  validateSimulationResult,
  validateSorobanExecutionRequestSchema,
  validateSorobanExecutionResultSchema,
  isExecutionNetwork,
  isSimulationResult,
  isSorobanExecutionRequest,
  isSorobanExecutionResult
} from './executionSchemas';

describe('Execution Types', () => {
  describe('buildSorobanExecutionRequest', () => {
    it('builds a valid minimal execution request', () => {
      const input = {
        sourceAccount: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        contractId: 'C123...',
        method: 'deposit',
        args: ['GUSER', '100'],
        network: {
          network: 'testnet',
          networkPassphrase: 'Test SDF Network ; September 2015',
          rpcUrl: 'https://soroban-testnet.stellar.org'
        }
      };

      const result = buildSorobanExecutionRequest(input);

      expect(result.sourceAccount).toBe(input.sourceAccount);
      expect(result.contractId).toBe(input.contractId);
      expect(result.method).toBe(input.method);
      expect(result.args).toEqual(input.args);
      expect(result.network).toEqual(input.network);
    });

    it('builds a complete execution request with all fields', () => {
      const input = {
        sourceAccount: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        contractId: 'C123...',
        method: 'deposit',
        args: ['GUSER', '100'],
        network: {
          network: 'testnet',
          networkPassphrase: 'Test SDF Network ; September 2015',
          rpcUrl: 'https://soroban-testnet.stellar.org',
          horizonUrl: 'https://horizon-testnet.stellar.org'
        },
        simulationResult: {
          status: 'success' as const,
          hash: 'sim-hash',
          result: { value: 42 },
          fee: 100n
        },
        signedXdr: 'AAAAAgAAAAA...',
        metadata: { requestId: 'req-123' }
      };

      const result = buildSorobanExecutionRequest(input);

      expect(result.simulationResult).toEqual(input.simulationResult);
      expect(result.signedXdr).toBe(input.signedXdr);
      expect(result.metadata).toEqual(input.metadata);
    });

    it('trims whitespace from string fields', () => {
      const input = {
        sourceAccount: '  GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ  ',
        contractId: '  C123...  ',
        method: '  deposit  ',
        args: ['GUSER', '100'],
        network: {
          network: '  testnet  ',
          networkPassphrase: '  Test SDF Network ; September 2015  ',
          rpcUrl: '  https://soroban-testnet.stellar.org  '
        }
      };

      const result = buildSorobanExecutionRequest(input);

      expect(result.sourceAccount).toBe('GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ');
      expect(result.contractId).toBe('C123...');
      expect(result.method).toBe('deposit');
      expect(result.network.network).toBe('testnet');
      expect(result.network.networkPassphrase).toBe('Test SDF Network ; September 2015');
      expect(result.network.rpcUrl).toBe('https://soroban-testnet.stellar.org');
    });

    it('uses empty args array when not provided', () => {
      const input = {
        sourceAccount: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        contractId: 'C123...',
        method: 'deposit',
        network: {
          network: 'testnet',
          networkPassphrase: 'Test SDF Network ; September 2015',
          rpcUrl: 'https://soroban-testnet.stellar.org'
        }
      };

      const result = buildSorobanExecutionRequest(input);

      expect(result.args).toEqual([]);
    });

    it('throws ValidationError for missing source account', () => {
      const input = {
        sourceAccount: '',
        contractId: 'C123...',
        method: 'deposit',
        network: {
          network: 'testnet',
          networkPassphrase: 'Test SDF Network ; September 2015',
          rpcUrl: 'https://soroban-testnet.stellar.org'
        }
      };

      expect(() => buildSorobanExecutionRequest(input)).toThrow(ValidationError);
      expect(() => buildSorobanExecutionRequest(input)).toThrow('sourceAccount');
    });

    it('throws ValidationError for missing contract ID', () => {
      const input = {
        sourceAccount: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        contractId: '',
        method: 'deposit',
        network: {
          network: 'testnet',
          networkPassphrase: 'Test SDF Network ; September 2015',
          rpcUrl: 'https://soroban-testnet.stellar.org'
        }
      };

      expect(() => buildSorobanExecutionRequest(input)).toThrow(ValidationError);
      expect(() => buildSorobanExecutionRequest(input)).toThrow('contractId');
    });

    it('throws ValidationError for missing method', () => {
      const input = {
        sourceAccount: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        contractId: 'C123...',
        method: '',
        network: {
          network: 'testnet',
          networkPassphrase: 'Test SDF Network ; September 2015',
          rpcUrl: 'https://soroban-testnet.stellar.org'
        }
      };

      expect(() => buildSorobanExecutionRequest(input)).toThrow(ValidationError);
      expect(() => buildSorobanExecutionRequest(input)).toThrow('method');
    });

    it('throws ValidationError for invalid args type', () => {
      const input = {
        sourceAccount: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        contractId: 'C123...',
        method: 'deposit',
        args: 'not-an-array' as any,
        network: {
          network: 'testnet',
          networkPassphrase: 'Test SDF Network ; September 2015',
          rpcUrl: 'https://soroban-testnet.stellar.org'
        }
      };

      expect(() => buildSorobanExecutionRequest(input)).toThrow(ValidationError);
      expect(() => buildSorobanExecutionRequest(input)).toThrow('args');
    });

    it('throws ValidationError for missing network', () => {
      const input = {
        sourceAccount: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        contractId: 'C123...',
        method: 'deposit',
        network: null as any
      };

      expect(() => buildSorobanExecutionRequest(input)).toThrow(ValidationError);
      expect(() => buildSorobanExecutionRequest(input)).toThrow('network');
    });

    it('throws ValidationError for invalid network configuration', () => {
      const input = {
        sourceAccount: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        contractId: 'C123...',
        method: 'deposit',
        network: {
          network: '',
          networkPassphrase: 'Test SDF Network ; September 2015',
          rpcUrl: 'https://soroban-testnet.stellar.org'
        }
      };

      expect(() => buildSorobanExecutionRequest(input)).toThrow(ValidationError);
      expect(() => buildSorobanExecutionRequest(input)).toThrow('network.network');
    });
  });

  describe('executionSuccess', () => {
    it('creates a successful execution result', () => {
      const request: SorobanExecutionRequest = {
        sourceAccount: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        contractId: 'C123...',
        method: 'deposit',
        args: ['GUSER', '100'],
        network: {
          network: 'testnet',
          networkPassphrase: 'Test SDF Network ; September 2015',
          rpcUrl: 'https://soroban-testnet.stellar.org'
        }
      };

      const result = executionSuccess(request, 'tx-hash-123');

      expect(result.status).toBe('success');
      expect(result.transactionHash).toBe('tx-hash-123');
      expect(result.sourceAccount).toBe(request.sourceAccount);
      expect(result.contractId).toBe(request.contractId);
      expect(result.method).toBe(request.method);
      expect(result.args).toEqual(request.args);
      expect(result.network).toEqual(request.network);
      expect(result.timestamp).toBeDefined();
    });

    it('allows overriding result fields', () => {
      const request: SorobanExecutionRequest = {
        sourceAccount: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        contractId: 'C123...',
        method: 'deposit',
        args: ['GUSER', '100'],
        network: {
          network: 'testnet',
          networkPassphrase: 'Test SDF Network ; September 2015',
          rpcUrl: 'https://soroban-testnet.stellar.org'
        }
      };

      const result = executionSuccess(request, 'tx-hash-123', {
        ledger: 12345,
        error: 'Some warning'
      });

      expect(result.ledger).toBe(12345);
      expect(result.error).toBe('Some warning');
    });

    it('throws ValidationError for empty transaction hash', () => {
      const request: SorobanExecutionRequest = {
        sourceAccount: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        contractId: 'C123...',
        method: 'deposit',
        args: ['GUSER', '100'],
        network: {
          network: 'testnet',
          networkPassphrase: 'Test SDF Network ; September 2015',
          rpcUrl: 'https://soroban-testnet.stellar.org'
        }
      };

      expect(() => executionSuccess(request, '')).toThrow(ValidationError);
      expect(() => executionSuccess(request, '')).toThrow('transactionHash');
    });
  });

  describe('executionFailed', () => {
    it('creates a failed execution result', () => {
      const request: SorobanExecutionRequest = {
        sourceAccount: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        contractId: 'C123...',
        method: 'deposit',
        args: ['GUSER', '100'],
        network: {
          network: 'testnet',
          networkPassphrase: 'Test SDF Network ; September 2015',
          rpcUrl: 'https://soroban-testnet.stellar.org'
        }
      };

      const result = executionFailed(request, 'Insufficient balance');

      expect(result.status).toBe('failed');
      expect(result.error).toBe('Insufficient balance');
      expect(result.sourceAccount).toBe(request.sourceAccount);
      expect(result.timestamp).toBeDefined();
    });

    it('allows overriding result fields', () => {
      const request: SorobanExecutionRequest = {
        sourceAccount: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        contractId: 'C123...',
        method: 'deposit',
        args: ['GUSER', '100'],
        network: {
          network: 'testnet',
          networkPassphrase: 'Test SDF Network ; September 2015',
          rpcUrl: 'https://soroban-testnet.stellar.org'
        }
      };

      const result = executionFailed(request, 'Error', {
        transactionHash: 'failed-tx-hash',
        ledger: 12345
      });

      expect(result.transactionHash).toBe('failed-tx-hash');
      expect(result.ledger).toBe(12345);
    });

    it('throws ValidationError for empty error message', () => {
      const request: SorobanExecutionRequest = {
        sourceAccount: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        contractId: 'C123...',
        method: 'deposit',
        args: ['GUSER', '100'],
        network: {
          network: 'testnet',
          networkPassphrase: 'Test SDF Network ; September 2015',
          rpcUrl: 'https://soroban-testnet.stellar.org'
        }
      };

      expect(() => executionFailed(request, '')).toThrow(ValidationError);
      expect(() => executionFailed(request, '')).toThrow('error');
    });
  });

  describe('executionPending', () => {
    it('creates a pending execution result', () => {
      const request: SorobanExecutionRequest = {
        sourceAccount: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        contractId: 'C123...',
        method: 'deposit',
        args: ['GUSER', '100'],
        network: {
          network: 'testnet',
          networkPassphrase: 'Test SDF Network ; September 2015',
          rpcUrl: 'https://soroban-testnet.stellar.org'
        }
      };

      const result = executionPending(request, 'pending-tx-hash');

      expect(result.status).toBe('pending');
      expect(result.transactionHash).toBe('pending-tx-hash');
      expect(result.timestamp).toBeDefined();
    });

    it('allows overriding result fields', () => {
      const request: SorobanExecutionRequest = {
        sourceAccount: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        contractId: 'C123...',
        method: 'deposit',
        args: ['GUSER', '100'],
        network: {
          network: 'testnet',
          networkPassphrase: 'Test SDF Network ; September 2015',
          rpcUrl: 'https://soroban-testnet.stellar.org'
        }
      };

      const result = executionPending(request, 'pending-tx-hash', {
        ledger: 12345
      });

      expect(result.ledger).toBe(12345);
    });
  });

  describe('validateSorobanExecutionResult', () => {
    it('validates a correct execution result', () => {
      const result: SorobanExecutionResult = {
        sourceAccount: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        contractId: 'C123...',
        method: 'deposit',
        args: ['GUSER', '100'],
        network: {
          network: 'testnet',
          networkPassphrase: 'Test SDF Network ; September 2015',
          rpcUrl: 'https://soroban-testnet.stellar.org'
        },
        status: 'success'
      };

      const validated = validateSorobanExecutionResult(result);
      expect(validated).toEqual(result);
    });

    it('throws ValidationError for missing source account', () => {
      const result = {
        contractId: 'C123...',
        method: 'deposit',
        args: ['GUSER', '100'],
        network: {
          network: 'testnet',
          networkPassphrase: 'Test SDF Network ; September 2015',
          rpcUrl: 'https://soroban-testnet.stellar.org'
        },
        status: 'success'
      };

      expect(() => validateSorobanExecutionResult(result)).toThrow(ValidationError);
    });

    it('throws ValidationError for invalid status', () => {
      const result = {
        sourceAccount: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        contractId: 'C123...',
        method: 'deposit',
        args: ['GUSER', '100'],
        network: {
          network: 'testnet',
          networkPassphrase: 'Test SDF Network ; September 2015',
          rpcUrl: 'https://soroban-testnet.stellar.org'
        },
        status: 'invalid_status'
      };

      expect(() => validateSorobanExecutionResult(result)).toThrow(ValidationError);
    });
  });
});

describe('Execution Schemas', () => {
  describe('validateExecutionNetwork', () => {
    it('validates a correct network configuration', () => {
      const network: ExecutionNetwork = {
        network: 'testnet',
        networkPassphrase: 'Test SDF Network ; September 2015',
        rpcUrl: 'https://soroban-testnet.stellar.org'
      };

      const validated = validateExecutionNetwork(network);
      expect(validated).toEqual(network);
    });

    it('validates network with optional horizon URL', () => {
      const network: ExecutionNetwork = {
        network: 'testnet',
        networkPassphrase: 'Test SDF Network ; September 2015',
        rpcUrl: 'https://soroban-testnet.stellar.org',
        horizonUrl: 'https://horizon-testnet.stellar.org'
      };

      const validated = validateExecutionNetwork(network);
      expect(validated).toEqual(network);
    });

    it('trims whitespace from network fields', () => {
      const network = {
        network: '  testnet  ',
        networkPassphrase: '  Test SDF Network ; September 2015  ',
        rpcUrl: '  https://soroban-testnet.stellar.org  '
      };

      const validated = validateExecutionNetwork(network);
      expect(validated.network).toBe('testnet');
      expect(validated.networkPassphrase).toBe('Test SDF Network ; September 2015');
      expect(validated.rpcUrl).toBe('https://soroban-testnet.stellar.org');
    });

    it('throws ValidationError for missing network name', () => {
      const network = {
        network: '',
        networkPassphrase: 'Test SDF Network ; September 2015',
        rpcUrl: 'https://soroban-testnet.stellar.org'
      };

      expect(() => validateExecutionNetwork(network)).toThrow(ValidationError);
    });

    it('throws ValidationError for missing network passphrase', () => {
      const network = {
        network: 'testnet',
        networkPassphrase: '',
        rpcUrl: 'https://soroban-testnet.stellar.org'
      };

      expect(() => validateExecutionNetwork(network)).toThrow(ValidationError);
    });

    it('throws ValidationError for missing RPC URL', () => {
      const network = {
        network: 'testnet',
        networkPassphrase: 'Test SDF Network ; September 2015',
        rpcUrl: ''
      };

      expect(() => validateExecutionNetwork(network)).toThrow(ValidationError);
    });

    it('throws ValidationError for invalid horizon URL', () => {
      const network = {
        network: 'testnet',
        networkPassphrase: 'Test SDF Network ; September 2015',
        rpcUrl: 'https://soroban-testnet.stellar.org',
        horizonUrl: ''
      };

      expect(() => validateExecutionNetwork(network)).toThrow(ValidationError);
    });
  });

  describe('validateSimulationResult', () => {
    it('validates a successful simulation result', () => {
      const simulation: SimulationResult = {
        status: 'success',
        hash: 'sim-hash',
        result: { value: 42 },
        fee: 100n,
        cpuInstructions: 1000,
        memoryBytes: 500
      };

      const validated = validateSimulationResult(simulation);
      expect(validated).toEqual(simulation);
    });

    it('validates a failed simulation result', () => {
      const simulation: SimulationResult = {
        status: 'failure',
        error: {
          message: 'Contract error',
          code: 1
        }
      };

      const validated = validateSimulationResult(simulation);
      expect(validated).toEqual(simulation);
    });

    it('validates a restore simulation result', () => {
      const simulation: SimulationResult = {
        status: 'restore',
        fee: 200n,
        cpuInstructions: 2000,
        memoryBytes: 1000
      };

      const validated = validateSimulationResult(simulation);
      expect(validated).toEqual(simulation);
    });

    it('converts fee to bigint', () => {
      const simulation = {
        status: 'success' as const,
        fee: '100' // string
      };

      const validated = validateSimulationResult(simulation);
      expect(validated.fee).toBe(100n);
    });

    it('throws ValidationError for invalid status', () => {
      const simulation = {
        status: 'invalid_status'
      };

      expect(() => validateSimulationResult(simulation)).toThrow(ValidationError);
    });

    it('throws ValidationError for empty hash when provided', () => {
      const simulation = {
        status: 'success' as const,
        hash: ''
      };

      expect(() => validateSimulationResult(simulation)).toThrow(ValidationError);
    });

    it('throws ValidationError for invalid error object', () => {
      const simulation = {
        status: 'failure' as const,
        error: 'not an object'
      };

      expect(() => validateSimulationResult(simulation)).toThrow(ValidationError);
    });

    it('throws ValidationError for negative cpu instructions', () => {
      const simulation = {
        status: 'success' as const,
        cpuInstructions: -1
      };

      expect(() => validateSimulationResult(simulation)).toThrow(ValidationError);
    });

    it('throws ValidationError for negative memory bytes', () => {
      const simulation = {
        status: 'success' as const,
        memoryBytes: -1
      };

      expect(() => validateSimulationResult(simulation)).toThrow(ValidationError);
    });
  });

  describe('validateSorobanExecutionRequestSchema', () => {
    it('validates a complete execution request', () => {
      const request: SorobanExecutionRequest = {
        sourceAccount: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        contractId: 'C123...',
        method: 'deposit',
        args: ['GUSER', '100'],
        network: {
          network: 'testnet',
          networkPassphrase: 'Test SDF Network ; September 2015',
          rpcUrl: 'https://soroban-testnet.stellar.org'
        },
        simulationResult: {
          status: 'success',
          hash: 'sim-hash'
        },
        signedXdr: 'AAAAAgAAAAA...',
        metadata: { requestId: 'req-123' }
      };

      const validated = validateSorobanExecutionRequestSchema(request);
      expect(validated).toEqual(request);
    });

    it('validates a minimal execution request', () => {
      const request: SorobanExecutionRequest = {
        sourceAccount: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        contractId: 'C123...',
        method: 'deposit',
        args: [],
        network: {
          network: 'testnet',
          networkPassphrase: 'Test SDF Network ; September 2015',
          rpcUrl: 'https://soroban-testnet.stellar.org'
        }
      };

      const validated = validateSorobanExecutionRequestSchema(request);
      expect(validated).toEqual(request);
    });

    it('throws ValidationError for missing source account', () => {
      const request = {
        contractId: 'C123...',
        method: 'deposit',
        args: [],
        network: {
          network: 'testnet',
          networkPassphrase: 'Test SDF Network ; September 2015',
          rpcUrl: 'https://soroban-testnet.stellar.org'
        }
      };

      expect(() => validateSorobanExecutionRequestSchema(request)).toThrow(ValidationError);
    });

    it('throws ValidationError for invalid network configuration', () => {
      const request = {
        sourceAccount: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        contractId: 'C123...',
        method: 'deposit',
        args: [],
        network: {
          network: 'testnet',
          networkPassphrase: '',
          rpcUrl: 'https://soroban-testnet.stellar.org'
        }
      };

      expect(() => validateSorobanExecutionRequestSchema(request)).toThrow(ValidationError);
    });

    it('throws ValidationError for invalid simulation result', () => {
      const request = {
        sourceAccount: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        contractId: 'C123...',
        method: 'deposit',
        args: [],
        network: {
          network: 'testnet',
          networkPassphrase: 'Test SDF Network ; September 2015',
          rpcUrl: 'https://soroban-testnet.stellar.org'
        },
        simulationResult: {
          status: 'invalid_status'
        }
      };

      expect(() => validateSorobanExecutionRequestSchema(request)).toThrow(ValidationError);
    });

    it('throws ValidationError for empty signed XDR', () => {
      const request = {
        sourceAccount: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        contractId: 'C123...',
        method: 'deposit',
        args: [],
        network: {
          network: 'testnet',
          networkPassphrase: 'Test SDF Network ; September 2015',
          rpcUrl: 'https://soroban-testnet.stellar.org'
        },
        signedXdr: ''
      };

      expect(() => validateSorobanExecutionRequestSchema(request)).toThrow(ValidationError);
    });
  });

  describe('validateSorobanExecutionResultSchema', () => {
    it('validates a complete execution result', () => {
      const result: SorobanExecutionResult = {
        sourceAccount: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        contractId: 'C123...',
        method: 'deposit',
        args: ['GUSER', '100'],
        network: {
          network: 'testnet',
          networkPassphrase: 'Test SDF Network ; September 2015',
          rpcUrl: 'https://soroban-testnet.stellar.org'
        },
        simulationResult: {
          status: 'success',
          hash: 'sim-hash'
        },
        signedXdr: 'AAAAAgAAAAA...',
        transactionHash: 'tx-hash',
        status: 'success',
        ledger: 12345,
        error: 'Some error',
        timestamp: '2024-01-15T10:30:00Z',
        raw: { _debug: true }
      };

      const validated = validateSorobanExecutionResultSchema(result);
      expect(validated).toEqual(result);
    });

    it('validates a minimal execution result', () => {
      const result: SorobanExecutionResult = {
        sourceAccount: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        contractId: 'C123...',
        method: 'deposit',
        args: [],
        network: {
          network: 'testnet',
          networkPassphrase: 'Test SDF Network ; September 2015',
          rpcUrl: 'https://soroban-testnet.stellar.org'
        },
        status: 'success'
      };

      const validated = validateSorobanExecutionResultSchema(result);
      expect(validated).toEqual(result);
    });

    it('throws ValidationError for invalid status', () => {
      const result = {
        sourceAccount: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        contractId: 'C123...',
        method: 'deposit',
        args: [],
        network: {
          network: 'testnet',
          networkPassphrase: 'Test SDF Network ; September 2015',
          rpcUrl: 'https://soroban-testnet.stellar.org'
        },
        status: 'invalid_status'
      };

      expect(() => validateSorobanExecutionResultSchema(result)).toThrow(ValidationError);
    });

    it('throws ValidationError for negative ledger', () => {
      const result = {
        sourceAccount: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        contractId: 'C123...',
        method: 'deposit',
        args: [],
        network: {
          network: 'testnet',
          networkPassphrase: 'Test SDF Network ; September 2015',
          rpcUrl: 'https://soroban-testnet.stellar.org'
        },
        status: 'success',
        ledger: -1
      };

      expect(() => validateSorobanExecutionResultSchema(result)).toThrow(ValidationError);
    });

    it('throws ValidationError for empty transaction hash', () => {
      const result = {
        sourceAccount: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
        contractId: 'C123...',
        method: 'deposit',
        args: [],
        network: {
          network: 'testnet',
          networkPassphrase: 'Test SDF Network ; September 2015',
          rpcUrl: 'https://soroban-testnet.stellar.org'
        },
        status: 'success',
        transactionHash: ''
      };

      expect(() => validateSorobanExecutionResultSchema(result)).toThrow(ValidationError);
    });
  });

  describe('Type Guards', () => {
    describe('isExecutionNetwork', () => {
      it('returns true for valid network', () => {
        const network: ExecutionNetwork = {
          network: 'testnet',
          networkPassphrase: 'Test SDF Network ; September 2015',
          rpcUrl: 'https://soroban-testnet.stellar.org'
        };

        expect(isExecutionNetwork(network)).toBe(true);
      });

      it('returns false for invalid network', () => {
        const network = {
          network: 'testnet',
          networkPassphrase: '',
          rpcUrl: 'https://soroban-testnet.stellar.org'
        };

        expect(isExecutionNetwork(network)).toBe(false);
      });

      it('returns false for non-object', () => {
        expect(isExecutionNetwork(null)).toBe(false);
        expect(isExecutionNetwork(undefined)).toBe(false);
        expect(isExecutionNetwork('string')).toBe(false);
      });
    });

    describe('isSimulationResult', () => {
      it('returns true for valid simulation result', () => {
        const simulation: SimulationResult = {
          status: 'success',
          hash: 'sim-hash'
        };

        expect(isSimulationResult(simulation)).toBe(true);
      });

      it('returns false for invalid simulation result', () => {
        const simulation = {
          status: 'invalid_status'
        };

        expect(isSimulationResult(simulation)).toBe(false);
      });

      it('returns false for non-object', () => {
        expect(isSimulationResult(null)).toBe(false);
        expect(isSimulationResult(undefined)).toBe(false);
      });
    });

    describe('isSorobanExecutionRequest', () => {
      it('returns true for valid execution request', () => {
        const request: SorobanExecutionRequest = {
          sourceAccount: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
          contractId: 'C123...',
          method: 'deposit',
          args: [],
          network: {
            network: 'testnet',
            networkPassphrase: 'Test SDF Network ; September 2015',
            rpcUrl: 'https://soroban-testnet.stellar.org'
          }
        };

        expect(isSorobanExecutionRequest(request)).toBe(true);
      });

      it('returns false for invalid execution request', () => {
        const request = {
          sourceAccount: '',
          contractId: 'C123...',
          method: 'deposit',
          args: [],
          network: {
            network: 'testnet',
            networkPassphrase: 'Test SDF Network ; September 2015',
            rpcUrl: 'https://soroban-testnet.stellar.org'
          }
        };

        expect(isSorobanExecutionRequest(request)).toBe(false);
      });
    });

    describe('isSorobanExecutionResult', () => {
      it('returns true for valid execution result', () => {
        const result: SorobanExecutionResult = {
          sourceAccount: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
          contractId: 'C123...',
          method: 'deposit',
          args: [],
          network: {
            network: 'testnet',
            networkPassphrase: 'Test SDF Network ; September 2015',
            rpcUrl: 'https://soroban-testnet.stellar.org'
          },
          status: 'success'
        };

        expect(isSorobanExecutionResult(result)).toBe(true);
      });

      it('returns false for invalid execution result', () => {
        const result = {
          sourceAccount: 'GABC1234567890ABCDEFGHIJKLMNOPQRSTUVWXYZ',
          contractId: 'C123...',
          method: 'deposit',
          args: [],
          network: {
            network: 'testnet',
            networkPassphrase: 'Test SDF Network ; September 2015',
            rpcUrl: 'https://soroban-testnet.stellar.org'
          },
          status: 'invalid_status'
        };

        expect(isSorobanExecutionResult(result)).toBe(false);
      });
    });
  });
});
