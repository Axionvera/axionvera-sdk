import { ValidationError } from './errors';
import type {
  ExecutionNetwork,
  SorobanExecutionRequest,
  SorobanExecutionResult,
  SimulationResult
} from './execution';
import type { TransactionStatus } from './types';

/**
 * Validates an ExecutionNetwork object against the schema.
 *
 * @param network - The network configuration to validate
 * @returns The validated network configuration
 * @throws ValidationError if the network configuration is invalid
 */
export function validateExecutionNetwork(network: unknown): ExecutionNetwork {
  if (!network || typeof network !== 'object') {
    throw new ValidationError('Network must be an object');
  }

  const record = network as Record<string, unknown>;

  if (typeof record.network !== 'string' || !record.network.trim()) {
    throw new ValidationError('network.network is required and must be a non-empty string');
  }

  if (typeof record.networkPassphrase !== 'string' || !record.networkPassphrase.trim()) {
    throw new ValidationError('network.networkPassphrase is required and must be a non-empty string');
  }

  if (typeof record.rpcUrl !== 'string' || !record.rpcUrl.trim()) {
    throw new ValidationError('network.rpcUrl is required and must be a non-empty string');
  }

  if (record.horizonUrl !== undefined) {
    if (typeof record.horizonUrl !== 'string' || !record.horizonUrl.trim()) {
      throw new ValidationError('network.horizonUrl must be a non-empty string when provided');
    }
  }

  const validatedNetwork: ExecutionNetwork = {
    network: record.network.trim(),
    networkPassphrase: record.networkPassphrase.trim(),
    rpcUrl: record.rpcUrl.trim()
  };

  if (record.horizonUrl !== undefined && typeof record.horizonUrl === 'string') {
    (validatedNetwork as ExecutionNetwork & { horizonUrl: string }).horizonUrl = record.horizonUrl.trim();
  }

  return validatedNetwork;
}

/**
 * Validates a SimulationResult object against the schema.
 *
 * @param simulation - The simulation result to validate
 * @returns The validated simulation result
 * @throws ValidationError if the simulation result is invalid
 */
export function validateSimulationResult(simulation: unknown): SimulationResult {
  if (!simulation || typeof simulation !== 'object') {
    throw new ValidationError('Simulation result must be an object');
  }

  const record = simulation as Record<string, unknown>;

  const validStatuses = ['success', 'failure', 'restore'];
  if (typeof record.status !== 'string' || !validStatuses.includes(record.status)) {
    throw new ValidationError(`simulation.status must be one of: ${validStatuses.join(', ')}`);
  }

  const result: SimulationResult = {
    status: record.status as 'success' | 'failure' | 'restore'
  };

  if (record.hash !== undefined) {
    if (typeof record.hash !== 'string' || !record.hash.trim()) {
      throw new ValidationError('simulation.hash must be a non-empty string when provided');
    }
    result.hash = record.hash.trim();
  }

  if (record.result !== undefined) {
    result.result = record.result;
  }

  if (record.error !== undefined) {
    if (!record.error || typeof record.error !== 'object') {
      throw new ValidationError('simulation.error must be an object when provided');
    }
    const error = record.error as Record<string, unknown>;
    if (typeof error.message !== 'string' || !error.message.trim()) {
      throw new ValidationError('simulation.error.message is required and must be a non-empty string');
    }
    
    const errorObj: { message: string; code?: number } = {
      message: error.message.trim()
    };
    
    if (typeof error.code === 'number') {
      errorObj.code = error.code;
    }
    
    result.error = errorObj;
  }

  if (record.fee !== undefined) {
    // Convert fee to bigint
    const feeValue = typeof record.fee === 'bigint' 
      ? record.fee 
      : BigInt(record.fee as string | number);
    result.fee = feeValue;
  }

  if (record.cpuInstructions !== undefined) {
    if (typeof record.cpuInstructions !== 'number' || record.cpuInstructions < 0) {
      throw new ValidationError('simulation.cpuInstructions must be a non-negative number');
    }
    result.cpuInstructions = record.cpuInstructions;
  }

  if (record.memoryBytes !== undefined) {
    if (typeof record.memoryBytes !== 'number' || record.memoryBytes < 0) {
      throw new ValidationError('simulation.memoryBytes must be a non-negative number');
    }
    result.memoryBytes = record.memoryBytes;
  }

  return result;
}

/**
 * Validates a SorobanExecutionRequest object against the schema.
 *
 * @param request - The execution request to validate
 * @returns The validated execution request
 * @throws ValidationError if the execution request is invalid
 */
export function validateSorobanExecutionRequestSchema(
  request: unknown
): SorobanExecutionRequest {
  if (!request || typeof request !== 'object') {
    throw new ValidationError('Execution request must be an object');
  }

  const record = request as Record<string, unknown>;

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

  const network = validateExecutionNetwork(record.network);

  const validatedRequest: SorobanExecutionRequest = {
    sourceAccount: record.sourceAccount.trim(),
    contractId: record.contractId.trim(),
    method: record.method.trim(),
    args: record.args,
    network
  };

  if (record.simulationResult !== undefined) {
    validatedRequest.simulationResult = validateSimulationResult(record.simulationResult);
  }

  if (record.signedXdr !== undefined) {
    if (typeof record.signedXdr !== 'string' || !record.signedXdr.trim()) {
      throw new ValidationError('signedXdr must be a non-empty string when provided');
    }
    validatedRequest.signedXdr = record.signedXdr.trim();
  }

  if (record.metadata !== undefined) {
    if (typeof record.metadata !== 'object') {
      throw new ValidationError('metadata must be an object when provided');
    }
    validatedRequest.metadata = record.metadata as Record<string, unknown>;
  }

  return validatedRequest;
}

/**
 * Validates a SorobanExecutionResult object against the schema.
 * This provides full schema validation, unlike the lightweight validateSorobanExecutionResult in execution.ts.
 *
 * @param result - The execution result to validate
 * @returns The validated execution result
 * @throws ValidationError if the execution result is invalid
 */
export function validateSorobanExecutionResultSchema(
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

  const network = validateExecutionNetwork(record.network);

  const validStatuses: TransactionStatus[] = ['pending', 'success', 'failed', 'not_found'];
  if (typeof record.status !== 'string' || !validStatuses.includes(record.status as TransactionStatus)) {
    throw new ValidationError(`status must be one of: ${validStatuses.join(', ')}`);
  }

  const validatedResult: SorobanExecutionResult = {
    sourceAccount: record.sourceAccount.trim(),
    contractId: record.contractId.trim(),
    method: record.method.trim(),
    args: record.args,
    network,
    status: record.status as TransactionStatus
  };

  if (record.simulationResult !== undefined) {
    validatedResult.simulationResult = validateSimulationResult(record.simulationResult);
  }

  if (record.signedXdr !== undefined) {
    if (typeof record.signedXdr !== 'string' || !record.signedXdr.trim()) {
      throw new ValidationError('signedXdr must be a non-empty string when provided');
    }
    validatedResult.signedXdr = record.signedXdr.trim();
  }

  if (record.transactionHash !== undefined) {
    if (typeof record.transactionHash !== 'string' || !record.transactionHash.trim()) {
      throw new ValidationError('transactionHash must be a non-empty string when provided');
    }
    validatedResult.transactionHash = record.transactionHash.trim();
  }

  if (record.ledger !== undefined) {
    if (typeof record.ledger !== 'number' || record.ledger < 0) {
      throw new ValidationError('ledger must be a non-negative number when provided');
    }
    validatedResult.ledger = record.ledger;
  }

  if (record.error !== undefined) {
    if (typeof record.error !== 'string' || !record.error.trim()) {
      throw new ValidationError('error must be a non-empty string when provided');
    }
    validatedResult.error = record.error.trim();
  }

  if (record.timestamp !== undefined) {
    if (typeof record.timestamp !== 'string' || !record.timestamp.trim()) {
      throw new ValidationError('timestamp must be a non-empty string when provided');
    }
    validatedResult.timestamp = record.timestamp.trim();
  }

  if (record.raw !== undefined) {
    validatedResult.raw = record.raw;
  }

  return validatedResult;
}

/**
 * Type guard to check if an object is a valid ExecutionNetwork.
 */
export function isExecutionNetwork(value: unknown): value is ExecutionNetwork {
  try {
    validateExecutionNetwork(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Type guard to check if an object is a valid SimulationResult.
 */
export function isSimulationResult(value: unknown): value is SimulationResult {
  try {
    validateSimulationResult(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Type guard to check if an object is a valid SorobanExecutionRequest.
 */
export function isSorobanExecutionRequest(value: unknown): value is SorobanExecutionRequest {
  try {
    validateSorobanExecutionRequestSchema(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Type guard to check if an object is a valid SorobanExecutionResult.
 */
export function isSorobanExecutionResult(value: unknown): value is SorobanExecutionResult {
  try {
    validateSorobanExecutionResultSchema(value);
    return true;
  } catch {
    return false;
  }
}
