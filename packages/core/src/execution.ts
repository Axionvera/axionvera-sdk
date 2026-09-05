import { ValidationError } from './errors';
import type { TransactionStatus } from './types';

/**
 * Network configuration for Soroban transaction execution.
 */
export interface ExecutionNetwork {
  /** Network identifier (e.g., 'testnet', 'mainnet', 'futurenet') */
  network: string;
  /** Stellar network passphrase for transaction signing */
  networkPassphrase: string;
  /** RPC endpoint for the network */
  rpcUrl: string;
  /** Optional Horizon endpoint for the network */
  horizonUrl?: string;
}

/**
 * Simulation result from Soroban transaction simulation.
 * This mirrors the structure returned by Stellar's simulateTransaction RPC method.
 */
export interface SimulationResult {
  /** Status of the simulation */
  status: 'success' | 'failure' | 'restore';
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
 * Request for executing a Soroban transaction.
 * This schema describes the complete input needed for transaction execution,
 * from simulation through submission.
 */
export interface SorobanExecutionRequest {
  /** Source account public key for the transaction */
  sourceAccount: string;
  /** The Stellar contract ID to invoke */
  contractId: string;
  /** The method name to call on the contract */
  method: string;
  /** Arguments to pass to the contract method, preserved in order */
  args: readonly unknown[];
  /** Network configuration for the transaction */
  network: ExecutionNetwork;
  /** Optional simulation result if pre-simulated */
  simulationResult?: SimulationResult;
  /** Optional signed transaction XDR (if already signed) */
  signedXdr?: string;
  /** Optional metadata for tracking and debugging */
  metadata?: Record<string, unknown>;
}

/**
 * Result of a Soroban transaction execution.
 * This schema describes the complete output from transaction execution,
 * including simulation, signing, and submission results.
 */
export interface SorobanExecutionResult {
  /** The source account used for the transaction */
  sourceAccount: string;
  /** The contract ID that was invoked */
  contractId: string;
  /** The method that was called */
  method: string;
  /** The arguments that were passed */
  args: readonly unknown[];
  /** Network configuration used */
  network: ExecutionNetwork;
  /** Simulation result (if simulation was performed) */
  simulationResult?: SimulationResult;
  /** Signed transaction XDR (if signing was performed) */
  signedXdr?: string;
  /** Final transaction hash (if submission was performed) */
  transactionHash?: string;
  /** Final transaction status */
  status: TransactionStatus;
  /** Optional ledger number when transaction was included */
  ledger?: number;
  /** Optional error message if transaction failed */
  error?: string;
  /** Optional timestamp of execution */
  timestamp?: string;
  /** Optional raw response from RPC for debugging */
  raw?: unknown;
}

/**
 * Input parameters for building a Soroban execution request.
 */
export interface SorobanExecutionRequestInput {
  /** Source account public key for the transaction */
  sourceAccount: string;
  /** The Stellar contract ID to invoke */
  contractId: string;
  /** The method name to call on the contract */
  method: string;
  /** Arguments to pass to the contract method */
  args?: readonly unknown[];
  /** Network configuration for the transaction */
  network: ExecutionNetwork;
  /** Optional simulation result if pre-simulated */
  simulationResult?: SimulationResult;
  /** Optional signed transaction XDR (if already signed) */
  signedXdr?: string;
  /** Optional metadata for tracking and debugging */
  metadata?: Record<string, unknown>;
}

/**
 * Validates and builds a Soroban execution request.
 *
 * @param input - The request parameters to validate and build
 * @returns A validated SorobanExecutionRequest object
 * @throws ValidationError if required fields are invalid
 */
export function buildSorobanExecutionRequest(
  input: SorobanExecutionRequestInput
): SorobanExecutionRequest {
  if (typeof input.sourceAccount !== 'string' || !input.sourceAccount.trim()) {
    throw new ValidationError('sourceAccount is required and must be a non-empty string');
  }

  if (typeof input.contractId !== 'string' || !input.contractId.trim()) {
    throw new ValidationError('contractId is required and must be a non-empty string');
  }

  if (typeof input.method !== 'string' || !input.method.trim()) {
    throw new ValidationError('method is required and must be a non-empty string');
  }

  if (input.args !== undefined && !Array.isArray(input.args)) {
    throw new ValidationError('args must be an array when provided');
  }

  // Validate network configuration
  if (!input.network || typeof input.network !== 'object') {
    throw new ValidationError('network is required and must be an object');
  }

  const network = input.network as unknown as Record<string, unknown>;
  if (typeof network.network !== 'string' || !network.network.trim()) {
    throw new ValidationError('network.network is required and must be a non-empty string');
  }

  if (typeof network.networkPassphrase !== 'string' || !network.networkPassphrase.trim()) {
    throw new ValidationError('network.networkPassphrase is required and must be a non-empty string');
  }

  if (typeof network.rpcUrl !== 'string' || !network.rpcUrl.trim()) {
    throw new ValidationError('network.rpcUrl is required and must be a non-empty string');
  }

  // Validate optional fields
  if (input.signedXdr !== undefined) {
    if (typeof input.signedXdr !== 'string' || !input.signedXdr.trim()) {
      throw new ValidationError('signedXdr must be a non-empty string when provided');
    }
  }

  if (input.metadata !== undefined && typeof input.metadata !== 'object') {
    throw new ValidationError('metadata must be an object when provided');
  }

  // Build the validated request
  const networkConfig: ExecutionNetwork = {
    network: network.network.trim(),
    networkPassphrase: network.networkPassphrase.trim(),
    rpcUrl: network.rpcUrl.trim()
  };

  if (network.horizonUrl !== undefined && typeof network.horizonUrl === 'string') {
    (networkConfig as ExecutionNetwork & { horizonUrl: string }).horizonUrl = network.horizonUrl.trim();
  }

  const result: SorobanExecutionRequest = {
    sourceAccount: input.sourceAccount.trim(),
    contractId: input.contractId.trim(),
    method: input.method.trim(),
    args: input.args ?? [],
    network: networkConfig
  };

  if (input.simulationResult !== undefined) {
    (result as SorobanExecutionRequest & { simulationResult: SimulationResult }).simulationResult = input.simulationResult;
  }

  if (input.signedXdr !== undefined) {
    (result as SorobanExecutionRequest & { signedXdr: string }).signedXdr = input.signedXdr.trim();
  }

  if (input.metadata !== undefined) {
    (result as SorobanExecutionRequest & { metadata: Record<string, unknown> }).metadata = input.metadata;
  }

  return result;
}

/**
 * Creates a successful Soroban execution result.
 *
 * @param request - The original execution request
 * @param transactionHash - The transaction hash
 * @param overrides - Optional fields to override in the result
 * @returns A SorobanExecutionResult with success status
 */
export function executionSuccess(
  request: SorobanExecutionRequest,
  transactionHash: string,
  overrides: Partial<SorobanExecutionResult> = {}
): SorobanExecutionResult {
  if (!transactionHash || typeof transactionHash !== 'string' || !transactionHash.trim()) {
    throw new ValidationError('transactionHash is required and must be a non-empty string');
  }

  const result: SorobanExecutionResult = {
    sourceAccount: request.sourceAccount,
    contractId: request.contractId,
    method: request.method,
    args: request.args,
    network: request.network,
    transactionHash: transactionHash.trim(),
    status: 'success',
    timestamp: new Date().toISOString(),
    ...overrides
  };

  // Conditionally add optional fields
  if (request.simulationResult !== undefined) {
    (result as SorobanExecutionResult & { simulationResult: SimulationResult }).simulationResult = request.simulationResult;
  }
  if (request.signedXdr !== undefined) {
    (result as SorobanExecutionResult & { signedXdr: string }).signedXdr = request.signedXdr;
  }

  return result;
}

/**
 * Creates a failed Soroban execution result.
 *
 * @param request - The original execution request
 * @param error - Error message describing the failure
 * @param overrides - Optional fields to override in the result
 * @returns A SorobanExecutionResult with failed status
 */
export function executionFailed(
  request: SorobanExecutionRequest,
  error: string,
  overrides: Partial<SorobanExecutionResult> = {}
): SorobanExecutionResult {
  if (!error || typeof error !== 'string' || !error.trim()) {
    throw new ValidationError('error is required and must be a non-empty string');
  }

  const result: SorobanExecutionResult = {
    sourceAccount: request.sourceAccount,
    contractId: request.contractId,
    method: request.method,
    args: request.args,
    network: request.network,
    status: 'failed',
    error: error.trim(),
    timestamp: new Date().toISOString(),
    ...overrides
  };

  // Conditionally add optional fields
  if (request.simulationResult !== undefined) {
    (result as SorobanExecutionResult & { simulationResult: SimulationResult }).simulationResult = request.simulationResult;
  }
  if (request.signedXdr !== undefined) {
    (result as SorobanExecutionResult & { signedXdr: string }).signedXdr = request.signedXdr;
  }

  return result;
}

/**
 * Creates a pending Soroban execution result.
 *
 * @param request - The original execution request
 * @param transactionHash - The transaction hash
 * @param overrides - Optional fields to override in the result
 * @returns A SorobanExecutionResult with pending status
 */
export function executionPending(
  request: SorobanExecutionRequest,
  transactionHash: string,
  overrides: Partial<SorobanExecutionResult> = {}
): SorobanExecutionResult {
  if (!transactionHash || typeof transactionHash !== 'string' || !transactionHash.trim()) {
    throw new ValidationError('transactionHash is required and must be a non-empty string');
  }

  const result: SorobanExecutionResult = {
    sourceAccount: request.sourceAccount,
    contractId: request.contractId,
    method: request.method,
    args: request.args,
    network: request.network,
    transactionHash: transactionHash.trim(),
    status: 'pending',
    timestamp: new Date().toISOString(),
    ...overrides
  };

  // Conditionally add optional fields
  if (request.simulationResult !== undefined) {
    (result as SorobanExecutionResult & { simulationResult: SimulationResult }).simulationResult = request.simulationResult;
  }
  if (request.signedXdr !== undefined) {
    (result as SorobanExecutionResult & { signedXdr: string }).signedXdr = request.signedXdr;
  }

  return result;
}

/**
 * Validates a Soroban execution result.
 * This is a lightweight validation that checks basic structure.
 * For full schema validation, use validateSorobanExecutionResultSchema from executionSchemas.ts.
 *
 * @param result - The execution result to validate
 * @returns The validated result
 * @throws ValidationError if the result is invalid
 */
export function validateSorobanExecutionResult(
  result: unknown
): SorobanExecutionResult {
  if (!result || typeof result !== 'object') {
    throw new ValidationError('Execution result must be an object');
  }

  const record = result as Record<string, unknown>;

  if (typeof record.sourceAccount !== 'string' || !record.sourceAccount.trim()) {
    throw new ValidationError('sourceAccount is required and must be a non-empty string');
  }

  if (typeof record.contractId !== 'string' || !record.contractId.trim()) {
    throw new ValidationError('contractId is required and must be a non-empty string');
  }

  if (typeof record.method !== 'string' || !record.method.trim()) {
    throw new ValidationError('method is required and must be a non-empty string');
  }

  if (!Array.isArray(record.args)) {
    throw new ValidationError('args must be an array');
  }

  if (!record.network || typeof record.network !== 'object') {
    throw new ValidationError('network is required and must be an object');
  }

  const network = record.network as Record<string, unknown>;
  if (typeof network.network !== 'string' || !network.network.trim()) {
    throw new ValidationError('network.network is required and must be a non-empty string');
  }

  const validStatuses: TransactionStatus[] = ['pending', 'success', 'failed', 'not_found'];
  if (typeof record.status !== 'string' || !validStatuses.includes(record.status as TransactionStatus)) {
    throw new ValidationError(`status must be one of: ${validStatuses.join(', ')}`);
  }

  return result as SorobanExecutionResult;
}
