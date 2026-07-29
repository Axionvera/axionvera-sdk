import type { AxionveraNetwork } from '../utils';

/**
 * Supported environment identifiers.
 * Extends the base network type with additional environment-level metadata.
 */
export type EnvironmentId = string;

/**
 * The four canonical environment tiers.
 */
export type EnvironmentTier = 'local' | 'testnet' | 'futurenet' | 'mainnet';

/**
 * Full configuration for a single environment.
 */
export interface EnvironmentConfig {
  /** Unique identifier for this environment (e.g. "local-standalone", "testnet-public"). */
  id: EnvironmentId;
  /** Human-readable name shown in logs and tooling. */
  name: string;
  /** The canonical tier this environment belongs to. */
  tier: EnvironmentTier;
  /** The underlying Stellar/Soroban network identifier. */
  network: AxionveraNetwork;
  /** The RPC URL for Soroban interactions. */
  rpcUrl: string;
  /** The Stellar network passphrase used for transaction signing. */
  networkPassphrase: string;
  /** Optional Horizon server URL for Stellar account operations. */
  horizonUrl?: string;
  /** Optional friendbot / faucet URL for testnet environments. */
  faucetUrl?: string;
  /** Whether this environment allows plain HTTP (non-localhost). */
  allowHttp?: boolean;
  /** Optional description surfaced in tooling and docs. */
  description?: string;
  /** Arbitrary metadata for custom tooling. */
  metadata?: Record<string, string>;
}

/**
 * Partial environment configuration used when registering or switching.
 * Only `tier` and `network` are required — everything else has sensible defaults.
 */
export interface EnvironmentOptions {
  /** Unique identifier. Defaults to the tier value if omitted. */
  id?: EnvironmentId;
  /** Human-readable name. */
  name?: string;
  /** The canonical tier. */
  tier: EnvironmentTier;
  /** The Stellar network. Defaults to matching the tier. */
  network?: AxionveraNetwork;
  /** RPC URL. Will be resolved from presets if omitted. */
  rpcUrl?: string;
  /** Network passphrase. Will be resolved from presets if omitted. */
  networkPassphrase?: string;
  /** Horizon URL. */
  horizonUrl?: string;
  /** Faucet URL. */
  faucetUrl?: string;
  /** Allow HTTP override. */
  allowHttp?: boolean;
  /** Description. */
  description?: string;
  /** Custom metadata. */
  metadata?: Record<string, string>;
}

/**
 * Result of an environment switch operation.
 */
export interface EnvironmentSwitchResult {
  /** The previously active environment id, or null if none was set. */
  previous: EnvironmentId | null;
  /** The newly activated environment id. */
  current: EnvironmentId;
  /** The full configuration of the new environment. */
  config: EnvironmentConfig;
}

/**
 * Listener callback for environment change events.
 */
export type EnvironmentChangeListener = (result: EnvironmentSwitchResult) => void;

/**
 * Validation result for an environment configuration.
 */
export interface EnvironmentValidationResult {
  /** Whether the configuration is valid. */
  valid: boolean;
  /** List of validation issues, if any. */
  issues: EnvironmentValidationIssue[];
}

/**
 * A single validation issue for an environment configuration.
 */
export interface EnvironmentValidationIssue {
  /** The field or property that failed validation. */
  field: string;
  /** Human-readable description of the issue. */
  message: string;
}
