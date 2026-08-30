import * as v from 'valibot';

/**
 * Schema for the SDK smoke test configuration.
 * Used by maintainers to validate environment readiness.
 */
export const SmokeTestConfigSchema = v.object({
  network: v.union([
    v.literal('mainnet'),
    v.literal('testnet'),
    v.literal('futurenet'),
    v.literal('mock')
  ]),
  rpcUrl: v.optional(v.string()),
  contracts: v.record(
    v.string(),
    v.object({
      contractId: v.string(),
      requiredMethods: v.array(v.string())
    })
  ),
  wallet: v.optional(v.object({
    address: v.string(),
    secret: v.optional(v.string()) // Never hardcode secrets in config
  })),
  options: v.optional(v.object({
    dryRun: v.boolean(),
    timeoutMs: v.number(),
    verbose: v.boolean()
  }))
});

export type SmokeTestConfig = v.InferOutput<typeof SmokeTestConfigSchema>;
