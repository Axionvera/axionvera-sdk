import * as v from 'valibot';
import { ValidationError } from './errors';
import { HandoffArtifactSchema, type HandoffArtifact } from './schemas/handoff';
import type { AxionveraNetwork } from './types';

/**
 * Options for loading a contract ID from a handoff artifact.
 */
export interface LoadContractIdOptions {
  /** The logical name of the contract (e.g., 'vault') */
  contractName: string;
  /** The expected network for the contract */
  network: AxionveraNetwork;
  /** Whether to allow placeholder contract IDs (starting with 'PLACEHOLDER_') */
  allowPlaceholders?: boolean;
}

/**
 * Loads and validates a contract ID from a handoff artifact.
 * 
 * @param artifact - The raw handoff artifact object
 * @param options - Loading options
 * @returns The validated contract ID
 * @throws ValidationError if the artifact is malformed, the contract is missing, or the network is wrong
 */
export function loadContractIdFromHandoff(
  artifact: unknown,
  options: LoadContractIdOptions
): string {
  const { contractName, network, allowPlaceholders = false } = options;

  // 1. Validate artifact structure
  let validatedArtifact: HandoffArtifact;
  try {
    validatedArtifact = v.parse(HandoffArtifactSchema, artifact);
  } catch (error) {
    if (error instanceof v.ValiError) {
      throw new ValidationError(`Malformed handoff artifact: ${error.message}`, error);
    }
    throw error;
  }

  // 2. Check if contract exists in artifact
  const handoff = validatedArtifact[contractName];
  if (!handoff) {
    throw new ValidationError(`Contract "${contractName}" not found in handoff artifact`);
  }

  // 3. Verify network
  if (handoff.network !== network) {
    throw new ValidationError(
      `Contract "${contractName}" is deployed on ${handoff.network}, but expected ${network}`
    );
  }

  // 4. Handle placeholders
  if (handoff.contractId.startsWith('PLACEHOLDER_')) {
    if (!allowPlaceholders) {
      throw new ValidationError(
        `Contract "${contractName}" has a placeholder ID and placeholders are not allowed`
      );
    }
    return handoff.contractId;
  }

  return handoff.contractId;
}
