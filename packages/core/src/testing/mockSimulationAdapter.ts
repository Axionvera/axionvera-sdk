import type { SorobanInvokeRequest } from '../soroban';
import { ContractError } from '../errors';

/**
 * Mock Soroban Simulation Adapter
 * 
 * This module provides a mocked implementation of Soroban transaction simulation
 * for SDK testing. See `README.md` in this directory for detailed documentation
 * and usage examples.
 */

/**
 * Simulation result status following Soroban simulation conventions.
 */
export type SimulationStatus = 'success' | 'failure' | 'restore';

/**
 * Soroban simulation response shape.
 * This mirrors the structure returned by Stellar's simulateTransaction RPC method,
 * allowing tests to verify transaction flow without real RPC calls.
 */
export interface SimulationResult {
  /** Status of the simulation */
  status: SimulationStatus;
  /** Transaction hash (present for successful simulations) */
  hash?: string;
  /** Parsed return value from the contract */
  result?: unknown;
  /** Error details (present for failed simulations) */
  error?: {
    /** Error message from the contract/host */
    message: string;
    /** Optional error code for specific failure types */
    code?: number;
  };
  /** Gas/fee estimates (present for successful simulations) */
  fee?: bigint;
  /** Required resource usage */
  cpuInstructions?: number;
  memoryBytes?: number;
}

/**
 * Configuration for method-specific simulation responses.
 */
export interface SimulationResponseConfig {
  /** The contract method this configuration applies to */
  method: string;
  /** The simulation result to return for this method */
  response: SimulationResult;
}

/**
 * Options for configuring the mock simulation adapter.
 */
export interface MockSimulationAdapterOptions {
  /** Optional default response when no method-specific config is found */
  defaultResponse?: SimulationResult;
  /** Pre-configured method-specific responses */
  responses?: SimulationResponseConfig[];
}

/**
 * Mock Soroban simulation adapter for SDK transaction flow testing.
 *
 * This adapter provides simulation-shaped behavior without calling real RPC.
 * It accepts invoke requests and returns predictable simulation-style outputs
 * for both success and failure cases, following the documented schema that
 * real Soroban simulation will use.
 *
 * @example
 * ```ts
 * const adapter = new MockSimulationAdapter({
 *   responses: [
 *     {
 *       method: 'deposit',
 *       response: {
 *         status: 'success',
 *         hash: 'simulated-tx-hash',
 *         result: { amount: '100' },
 *         fee: 100n
 *       }
 *     }
 *   ]
 * });
 *
 * const result = await adapter.simulate({
 *   contractId: 'C123...',
 *   method: 'deposit',
 *   args: ['GUSER', '100']
 * });
 * ```
 */
export class MockSimulationAdapter {
  private readonly methodResponses = new Map<string, SimulationResult>();
  private readonly defaultResponse: SimulationResult | undefined;

  constructor(options: MockSimulationAdapterOptions = {}) {
    this.defaultResponse = options.defaultResponse;
    
    if (options.responses) {
      for (const config of options.responses) {
        this.methodResponses.set(config.method, config.response);
      }
    }
  }

  /**
   * Simulate a Soroban contract invocation.
   *
   * @param request - The invocation request to simulate
   * @returns A simulation result following Soroban conventions
   * @throws ContractError if no response is configured and no default is provided
   */
  async simulate(request: SorobanInvokeRequest): Promise<SimulationResult> {
    const response = this.methodResponses.get(request.method) ?? this.defaultResponse;
    
    if (!response) {
      throw new ContractError(
        `No simulation response configured for method "${request.method}"`
      );
    }

    return response;
  }

  /**
   * Configure a simulation response for a specific method.
   *
   * @param method - The contract method name
   * @param response - The simulation result to return
   * @returns This adapter for chaining
   */
  setSimulationResponse(method: string, response: SimulationResult): this {
    this.methodResponses.set(method, response);
    return this;
  }

  /**
   * Remove a configured method response.
   *
   * @param method - The contract method name to remove
   * @returns This adapter for chaining
   */
  clearSimulationResponse(method: string): this {
    this.methodResponses.delete(method);
    return this;
  }

  /**
   * Reset all configured responses.
   */
  reset(): void {
    this.methodResponses.clear();
  }

  /**
   * Create a successful simulation result.
   *
   * @param overrides - Optional fields to override in the success response
   * @returns A simulation result with success status
   */
  static createSuccessResult(overrides: Partial<SimulationResult> = {}): SimulationResult {
    return {
      status: 'success',
      hash: 'simulated-success-hash',
      result: null,
      fee: 100n,
      cpuInstructions: 1000,
      memoryBytes: 500,
      ...overrides
    };
  }

  /**
   * Create a failed simulation result.
   *
   * @param message - Error message describing the failure
   * @param overrides - Optional fields to override in the failure response
   * @returns A simulation result with failure status
   */
  static createFailureResult(
    message: string,
    overrides: Partial<SimulationResult> = {}
  ): SimulationResult {
    return {
      status: 'failure',
      error: {
        message,
        code: 1
      },
      ...overrides
    };
  }

  /**
   * Create a restore simulation result (for transactions requiring restore).
   *
   * @param overrides - Optional fields to override in the restore response
   * @returns A simulation result with restore status
   */
  static createRestoreResult(overrides: Partial<SimulationResult> = {}): SimulationResult {
    return {
      status: 'restore',
      fee: 100n,
      cpuInstructions: 1000,
      memoryBytes: 500,
      ...overrides
    };
  }
}

/**
 * Factory function to create a mock simulation adapter with common configurations.
 */
export function createMockSimulationAdapter(
  options?: MockSimulationAdapterOptions
): MockSimulationAdapter {
  return new MockSimulationAdapter(options);
}

/**
 * Pre-configured mock adapter for successful simulations.
 * Returns success responses for all methods by default.
 */
export function createSuccessSimulationAdapter(): MockSimulationAdapter {
  return new MockSimulationAdapter({
    defaultResponse: MockSimulationAdapter.createSuccessResult()
  });
}

/**
 * Pre-configured mock adapter for failed simulations.
 * Returns failure responses for all methods by default.
 */
export function createFailureSimulationAdapter(
  errorMessage: string = 'Simulation failed'
): MockSimulationAdapter {
  return new MockSimulationAdapter({
    defaultResponse: MockSimulationAdapter.createFailureResult(errorMessage)
  });
}
