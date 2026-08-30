import * as v from 'valibot';

/**
 * Schema for a single contract deployment in a handoff artifact.
 */
export const ContractHandoffSchema = v.object({
  contractId: v.pipe(
    v.string(),
    v.minLength(5, 'Contract ID is too short'),
    v.check((val: string) => {
      const isSorobanId = /^C[A-Z2-7]{55}$/.test(val);
      const isPlaceholder = val.startsWith('PLACEHOLDER_');
      return isSorobanId || isPlaceholder;
    }, 'Invalid Soroban contract ID format or placeholder')
  ),
  network: v.union([
    v.literal('mainnet'),
    v.literal('testnet'),
    v.literal('futurenet')
  ]),
  version: v.optional(v.string()),
  metadata: v.optional(v.record(v.string(), v.unknown()))
});

/**
 * Schema for a complete handoff artifact containing multiple contract deployments.
 */
export const HandoffArtifactSchema = v.record(v.string(), ContractHandoffSchema);

export type ContractHandoff = v.InferOutput<typeof ContractHandoffSchema>;
export type HandoffArtifact = v.InferOutput<typeof HandoffArtifactSchema>;
