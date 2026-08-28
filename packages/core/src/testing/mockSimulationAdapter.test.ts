import { describe, expect, it } from 'vitest';

import { ContractError } from '../errors';
import type { SorobanInvokeRequest } from '../soroban';
import {
  MockSimulationAdapter,
  createMockSimulationAdapter,
  createSuccessSimulationAdapter,
  createFailureSimulationAdapter,
  type SimulationResult
} from './mockSimulationAdapter';

const CONTRACT_ID = 'CABCDEF0000000000000000000000000000000000000000000000000000000001';
const ADDRESS = 'GABC1234567890';

function createRequest(overrides: Partial<SorobanInvokeRequest> = {}): SorobanInvokeRequest {
  return {
    contractId: CONTRACT_ID,
    method: 'deposit',
    args: [ADDRESS, '100'],
    ...overrides
  };
}

describe('MockSimulationAdapter', () => {
  describe('constructor', () => {
    it('creates an adapter with no initial configuration', () => {
      const adapter = new MockSimulationAdapter();
      expect(adapter).toBeInstanceOf(MockSimulationAdapter);
    });

    it('creates an adapter with default response', () => {
      const defaultResponse: SimulationResult = {
        status: 'success',
        hash: 'default-hash'
      };
      const adapter = new MockSimulationAdapter({ defaultResponse });
      expect(adapter).toBeInstanceOf(MockSimulationAdapter);
    });

    it('creates an adapter with method-specific responses', () => {
      const responses = [
        {
          method: 'deposit',
          response: { status: 'success' as const, hash: 'deposit-hash' }
        }
      ];
      const adapter = new MockSimulationAdapter({ responses });
      expect(adapter).toBeInstanceOf(MockSimulationAdapter);
    });
  });

  describe('simulate - success flow', () => {
    it('returns configured success response for specific method', async () => {
      const successResponse: SimulationResult = {
        status: 'success',
        hash: 'tx-123',
        result: { amount: '100' },
        fee: 100n,
        cpuInstructions: 1000,
        memoryBytes: 500
      };

      const adapter = new MockSimulationAdapter({
        responses: [
          {
            method: 'deposit',
            response: successResponse
          }
        ]
      });

      const result = await adapter.simulate(createRequest({ method: 'deposit' }));

      expect(result).toEqual(successResponse);
      expect(result.status).toBe('success');
      expect(result.hash).toBe('tx-123');
      expect(result.result).toEqual({ amount: '100' });
    });

    it('returns default response when no method-specific config exists', async () => {
      const defaultResponse: SimulationResult = {
        status: 'success',
        hash: 'default-tx-hash',
        result: null,
        fee: 50n
      };

      const adapter = new MockSimulationAdapter({ defaultResponse });

      const result = await adapter.simulate(createRequest({ method: 'withdraw' }));

      expect(result).toEqual(defaultResponse);
    });

    it('preserves all simulation result fields', async () => {
      const fullResponse: SimulationResult = {
        status: 'success',
        hash: 'full-hash',
        result: { value: 42 },
        fee: 1000n,
        cpuInstructions: 5000,
        memoryBytes: 2000
      };

      const adapter = new MockSimulationAdapter({
        responses: [{ method: 'get_info', response: fullResponse }]
      });

      const result = await adapter.simulate(createRequest({ method: 'get_info', args: [] }));

      expect(result.status).toBe('success');
      expect(result.hash).toBe('full-hash');
      expect(result.result).toEqual({ value: 42 });
      expect(result.fee).toBe(1000n);
      expect(result.cpuInstructions).toBe(5000);
      expect(result.memoryBytes).toBe(2000);
    });

    it('handles simulation with no return value', async () => {
      const response: SimulationResult = {
        status: 'success',
        hash: 'no-return-hash',
        result: null,
        fee: 100n
      };

      const adapter = new MockSimulationAdapter({
        responses: [{ method: 'claim_rewards', response }]
      });

      const result = await adapter.simulate(createRequest({ method: 'claim_rewards', args: [ADDRESS] }));

      expect(result.result).toBeNull();
      expect(result.status).toBe('success');
    });
  });

  describe('simulate - failure flow', () => {
    it('returns configured failure response for specific method', async () => {
      const failureResponse: SimulationResult = {
        status: 'failure',
        error: {
          message: 'Insufficient balance',
          code: 1
        }
      };

      const adapter = new MockSimulationAdapter({
        responses: [{ method: 'withdraw', response: failureResponse }]
      });

      const result = await adapter.simulate(createRequest({ method: 'withdraw', args: [ADDRESS, '1000'] }));

      expect(result.status).toBe('failure');
      expect(result.error).toBeDefined();
      expect(result.error?.message).toBe('Insufficient balance');
      expect(result.error?.code).toBe(1);
    });

    it('returns default failure response when no method-specific config exists', async () => {
      const defaultFailure: SimulationResult = {
        status: 'failure',
        error: {
          message: 'Default simulation failure',
          code: 99
        }
      };

      const adapter = new MockSimulationAdapter({ defaultResponse: defaultFailure });

      const result = await adapter.simulate(createRequest({ method: 'unknown_method' }));

      expect(result.status).toBe('failure');
      expect(result.error?.message).toBe('Default simulation failure');
    });

    it('includes error details in failure response', async () => {
      const failureResponse: SimulationResult = {
        status: 'failure',
        error: {
          message: 'Contract invocation trapped: host error',
          code: 42
        }
      };

      const adapter = new MockSimulationAdapter({
        responses: [{ method: 'deposit', response: failureResponse }]
      });

      const result = await adapter.simulate(createRequest());

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('host error');
      expect(result.error?.code).toBe(42);
    });

    it('handles failure without error code', async () => {
      const failureResponse: SimulationResult = {
        status: 'failure',
        error: {
          message: 'Generic error'
        }
      };

      const adapter = new MockSimulationAdapter({
        responses: [{ method: 'deposit', response: failureResponse }]
      });

      const result = await adapter.simulate(createRequest());

      expect(result.error?.message).toBe('Generic error');
      expect(result.error?.code).toBeUndefined();
    });
  });

  describe('simulate - restore flow', () => {
    it('returns restore status when configured', async () => {
      const restoreResponse: SimulationResult = {
        status: 'restore',
        fee: 200n,
        cpuInstructions: 2000,
        memoryBytes: 1000
      };

      const adapter = new MockSimulationAdapter({
        responses: [{ method: 'deposit', response: restoreResponse }]
      });

      const result = await adapter.simulate(createRequest());

      expect(result.status).toBe('restore');
      expect(result.fee).toBe(200n);
      expect(result.cpuInstructions).toBe(2000);
      expect(result.memoryBytes).toBe(1000);
    });
  });

  describe('simulate - error handling', () => {
    it('throws ContractError when no response is configured', async () => {
      const adapter = new MockSimulationAdapter();

      await expect(adapter.simulate(createRequest({ method: 'unconfigured' }))).rejects.toThrow(
        ContractError
      );
    });

    it('includes method name in error message', async () => {
      const adapter = new MockSimulationAdapter();

      await expect(adapter.simulate(createRequest({ method: 'deposit' }))).rejects.toThrow(
        'No simulation response configured for method "deposit"'
      );
    });
  });

  describe('setSimulationResponse', () => {
    it('adds a new method response', async () => {
      const adapter = new MockSimulationAdapter();
      const response: SimulationResult = { status: 'success', hash: 'new-hash' };

      adapter.setSimulationResponse('new_method', response);

      const result = await adapter.simulate(createRequest({ method: 'new_method' }));
      expect(result).toEqual(response);
    });

    it('overwrites existing method response', async () => {
      const adapter = new MockSimulationAdapter({
        responses: [
          {
            method: 'deposit',
            response: { status: 'success', hash: 'old-hash' }
          }
        ]
      });

      const newResponse: SimulationResult = { status: 'success', hash: 'new-hash' };
      adapter.setSimulationResponse('deposit', newResponse);

      const result = await adapter.simulate(createRequest());
      expect(result.hash).toBe('new-hash');
    });

    it('is chainable', () => {
      const adapter = new MockSimulationAdapter();
      const response: SimulationResult = { status: 'success', hash: 'hash' };

      const result = adapter.setSimulationResponse('method1', response)
        .setSimulationResponse('method2', response);

      expect(result).toBe(adapter);
    });
  });

  describe('clearSimulationResponse', () => {
    it('removes a configured method response', async () => {
      const adapter = new MockSimulationAdapter({
        responses: [
          {
            method: 'deposit',
            response: { status: 'success', hash: 'hash' }
          }
        ]
      });

      adapter.clearSimulationResponse('deposit');

      await expect(adapter.simulate(createRequest())).rejects.toThrow(
        'No simulation response configured'
      );
    });

    it('is chainable', () => {
      const adapter = new MockSimulationAdapter();
      const result = adapter.clearSimulationResponse('any_method');
      expect(result).toBe(adapter);
    });
  });

  describe('reset', () => {
    it('clears all configured responses', async () => {
      const adapter = new MockSimulationAdapter({
        responses: [
          { method: 'deposit', response: { status: 'success', hash: 'hash1' } },
          { method: 'withdraw', response: { status: 'success', hash: 'hash2' } }
        ]
      });

      adapter.reset();

      await expect(adapter.simulate(createRequest({ method: 'deposit' }))).rejects.toThrow();
      await expect(adapter.simulate(createRequest({ method: 'withdraw' }))).rejects.toThrow();
    });
  });

  describe('static factory methods', () => {
    describe('createSuccessResult', () => {
      it('creates a success result with default fields', () => {
        const result = MockSimulationAdapter.createSuccessResult();

        expect(result.status).toBe('success');
        expect(result.hash).toBe('simulated-success-hash');
        expect(result.result).toBeNull();
        expect(result.fee).toBe(100n);
        expect(result.cpuInstructions).toBe(1000);
        expect(result.memoryBytes).toBe(500);
      });

      it('allows overriding default fields', () => {
        const result = MockSimulationAdapter.createSuccessResult({
          hash: 'custom-hash',
          result: { custom: 'value' },
          fee: 500n
        });

        expect(result.hash).toBe('custom-hash');
        expect(result.result).toEqual({ custom: 'value' });
        expect(result.fee).toBe(500n);
      });
    });

    describe('createFailureResult', () => {
      it('creates a failure result with error message', () => {
        const result = MockSimulationAdapter.createFailureResult('Test error');

        expect(result.status).toBe('failure');
        expect(result.error?.message).toBe('Test error');
        expect(result.error?.code).toBe(1);
      });

      it('allows overriding default fields', () => {
        const result = MockSimulationAdapter.createFailureResult('Custom error', {
          error: { message: 'Overridden', code: 42 }
        });

        expect(result.error?.message).toBe('Overridden');
        expect(result.error?.code).toBe(42);
      });
    });

    describe('createRestoreResult', () => {
      it('creates a restore result with default fields', () => {
        const result = MockSimulationAdapter.createRestoreResult();

        expect(result.status).toBe('restore');
        expect(result.fee).toBe(100n);
        expect(result.cpuInstructions).toBe(1000);
        expect(result.memoryBytes).toBe(500);
      });

      it('allows overriding default fields', () => {
        const result = MockSimulationAdapter.createRestoreResult({
          fee: 200n,
          cpuInstructions: 3000
        });

        expect(result.fee).toBe(200n);
        expect(result.cpuInstructions).toBe(3000);
      });
    });
  });

  describe('factory functions', () => {
    describe('createMockSimulationAdapter', () => {
      it('creates a MockSimulationAdapter instance', () => {
        const adapter = createMockSimulationAdapter();
        expect(adapter).toBeInstanceOf(MockSimulationAdapter);
      });

      it('passes options to constructor', async () => {
        const response: SimulationResult = { status: 'success', hash: 'hash' };
        const adapter = createMockSimulationAdapter({
          responses: [{ method: 'deposit', response }]
        });

        const result = await adapter.simulate(createRequest());
        expect(result).toEqual(response);
      });
    });

    describe('createSuccessSimulationAdapter', () => {
      it('creates adapter with default success response', async () => {
        const adapter = createSuccessSimulationAdapter();

        const result = await adapter.simulate(createRequest({ method: 'any_method' }));
        expect(result.status).toBe('success');
        expect(result.hash).toBe('simulated-success-hash');
      });

      it('works for multiple methods', async () => {
        const adapter = createSuccessSimulationAdapter();

        const result1 = await adapter.simulate(createRequest({ method: 'deposit' }));
        const result2 = await adapter.simulate(createRequest({ method: 'withdraw' }));

        expect(result1.status).toBe('success');
        expect(result2.status).toBe('success');
      });
    });

    describe('createFailureSimulationAdapter', () => {
      it('creates adapter with default failure response', async () => {
        const adapter = createFailureSimulationAdapter();

        const result = await adapter.simulate(createRequest({ method: 'any_method' }));
        expect(result.status).toBe('failure');
        expect(result.error?.message).toBe('Simulation failed');
      });

      it('accepts custom error message', async () => {
        const adapter = createFailureSimulationAdapter('Custom failure');

        const result = await adapter.simulate(createRequest());
        expect(result.error?.message).toBe('Custom failure');
      });

      it('works for multiple methods', async () => {
        const adapter = createFailureSimulationAdapter();

        const result1 = await adapter.simulate(createRequest({ method: 'deposit' }));
        const result2 = await adapter.simulate(createRequest({ method: 'withdraw' }));

        expect(result1.status).toBe('failure');
        expect(result2.status).toBe('failure');
      });
    });
  });

  describe('integration scenarios', () => {
    it('handles complex multi-step transaction flow', async () => {
      const adapter = new MockSimulationAdapter({
        responses: [
          {
            method: 'get_balance',
            response: MockSimulationAdapter.createSuccessResult({
              result: { balance: '1000' }
            })
          },
          {
            method: 'deposit',
            response: MockSimulationAdapter.createSuccessResult({
              hash: 'deposit-tx-hash',
              result: { new_balance: '1100' }
            })
          },
          {
            method: 'withdraw',
            response: MockSimulationAdapter.createFailureResult('Insufficient funds')
          }
        ]
      });

      // Check balance (success)
      const balanceResult = await adapter.simulate(
        createRequest({ method: 'get_balance', args: [ADDRESS] })
      );
      expect(balanceResult.status).toBe('success');
      expect(balanceResult.result).toEqual({ balance: '1000' });

      // Deposit (success)
      const depositResult = await adapter.simulate(
        createRequest({ method: 'deposit', args: [ADDRESS, '100'] })
      );
      expect(depositResult.status).toBe('success');
      expect(depositResult.hash).toBe('deposit-tx-hash');

      // Withdraw too much (failure)
      const withdrawResult = await adapter.simulate(
        createRequest({ method: 'withdraw', args: [ADDRESS, '2000'] })
      );
      expect(withdrawResult.status).toBe('failure');
      expect(withdrawResult.error?.message).toBe('Insufficient funds');
    });

    it('supports dynamic response updates during testing', async () => {
      const adapter = new MockSimulationAdapter({
        defaultResponse: MockSimulationAdapter.createSuccessResult()
      });

      // First call succeeds
      const result1 = await adapter.simulate(createRequest());
      expect(result1.status).toBe('success');

      // Update to fail
      adapter.setSimulationResponse(
        'deposit',
        MockSimulationAdapter.createFailureResult('Now failing')
      );

      // Second call fails
      const result2 = await adapter.simulate(createRequest());
      expect(result2.status).toBe('failure');

      // Clear and revert to default
      adapter.clearSimulationResponse('deposit');

      // Third call succeeds again
      const result3 = await adapter.simulate(createRequest());
      expect(result3.status).toBe('success');
    });
  });
});
