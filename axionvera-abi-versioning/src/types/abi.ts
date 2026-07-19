/**
 * Types backing the SDK's ABI version compatibility framework.
 *
 * The framework lets a single logical contract (e.g. `"Vault"`) have several
 * on-chain ABI versions in flight at once — different environments, or a
 * contract mid-rollout — while every consumer of the SDK keeps calling one
 * stable, "canonical" method interface. Each {@link AbiVersionDescriptor}
 * maps that canonical interface onto whatever the deployed contract actually
 * exposes for its version, converting arguments and results at the edges.
 *
 * This is deliberately a different concern from `src/migrations`: the
 * migration toolkit transforms *persisted state* from one shape to another
 * (a one-time, offline operation you run against stored data). This module
 * governs *live RPC calls* — which method name to invoke and how to
 * translate its arguments/results — for whichever ABI version happens to be
 * deployed right now. The two can be composed: see
 * `src/contracts/vaultAbiVersions.ts` for an example that reuses
 * `defaultMigrationRegistry` to upgrade an older version's raw result into
 * the latest canonical shape.
 */

/** A contract ABI version identifier. Not required to be numeric — `"v1"`, `"2024-01"`, `"1.2.0"` are all valid. */
export type AbiVersion = string;

/**
 * Maps one canonical method onto a specific ABI version's on-chain reality.
 *
 * `serializeArgs`/`deserializeResult` are optional: omit them when the
 * canonical shape already matches the raw on-chain shape (only the method
 * name differs, or nothing differs at all).
 */
export interface AbiMethodAdapter {
  /** The method name as actually invoked on the deployed contract for this ABI version. */
  rawMethod: string;
  /** Converts canonical (latest-shape) call arguments into this version's raw on-chain call arguments. */
  serializeArgs?: (...args: unknown[]) => unknown[];
  /**
   * Converts this version's raw on-chain result into the canonical
   * (latest-shape) result. May return a `Promise` to allow reuse of async
   * migration steps (see module doc above) — callers always `await` this.
   */
  deserializeResult?: (raw: unknown) => unknown;
}

/**
 * Describes one ABI version of a logical contract: which canonical methods
 * it supports, and how each maps onto a raw on-chain call.
 */
export interface AbiVersionDescriptor {
  /** Logical contract id, e.g. `"Vault"` — matches the id used across `src/registry` and `src/migrations`. */
  contractId: string;
  version: AbiVersion;
  description?: string;
  /** Canonical method name -> mapping onto this version's raw contract call. A method absent here is unsupported at this version. */
  methods: Record<string, AbiMethodAdapter>;
  /**
   * Raw method names that exist ONLY at this version (or first appear at
   * this version and persist forward), used by {@link AbiVersionRegistry.detectVersion}
   * to fingerprint a deployed contract without an explicit version tag.
   * Defaults to every method's `rawMethod` when omitted.
   */
  fingerprintMethods?: string[];
}

/** Confidence level of a version-detection result. */
export type AbiDetectionConfidence = 'explicit' | 'inferred' | 'unknown';

export interface AbiVersionDetectionResult {
  version: AbiVersion | undefined;
  confidence: AbiDetectionConfidence;
  /** Which fingerprint methods were confirmed present (empty for `explicit` or `unknown` results). */
  matchedMethods: string[];
}

/**
 * The minimal surface a caller supplies so {@link AbiVersionRegistry.detectVersion}
 * can figure out which ABI version a specific deployed contract is running,
 * without the registry itself needing to know how to talk to Soroban RPC.
 */
export interface AbiVersionProbe {
  /** Returns true if `rawMethod` is present/invokable on the deployed contract. */
  hasMethod(rawMethod: string): Promise<boolean>;
  /** Optional: reads an explicit version tag directly off the contract (e.g. a `version()` view call or a metadata entry). */
  readExplicitVersion?(): Promise<AbiVersion | undefined>;
}
