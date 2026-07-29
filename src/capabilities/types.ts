import type { ContractCapability } from '../discovery';

/**
 * The presence status of a single declared contract method, resolved by
 * matching the descriptor's {@link import('../discovery/types').ContractMethodDescriptor}
 * names against the methods actually exposed by a reflected ABI.
 */
export interface DetectedMethod {
  /** Method name as declared by the descriptor, e.g. `'deposit'`. */
  name: string;
  /** Capability this method backs, per the descriptor's method->capability map. */
  capability: ContractCapability;
  /** Whether a method of this name is actually present in the reflected ABI. */
  present: boolean;
}

/**
 * The outcome of reconciling a contract's declared
 * {@link import('../discovery/types').ContractDescriptor} against the methods
 * its ABI actually exposes.
 *
 * Detection is purely ABI-derived: a capability counts as {@link supported}
 * only when *all* of its defining methods are present in the ABI. The
 * reconciliation is bidirectional — {@link missing} reports declared
 * capabilities the ABI cannot back, and {@link undeclaredMethods} reports ABI
 * methods the descriptor never mapped to any capability.
 *
 * This is detection, not negotiation: nothing here queries a live deployment
 * or relies on an on-chain feature-advertisement mechanism.
 */
export interface CapabilityDetectionResult {
  /** Capabilities whose every defining method is present in the ABI. */
  supported: ContractCapability[];
  /** Declared capabilities missing at least one defining method in the ABI. */
  missing: ContractCapability[];
  /** Per-declared-method presence detail; the contract compatibility matrix. */
  methods: DetectedMethod[];
  /** ABI method names with no descriptor capability mapping. */
  undeclaredMethods: string[];
  /** True when no declared capability is {@link missing}. */
  complete: boolean;
}

/** Options accepted by {@link import('./capabilityDetector').CapabilityDetector} methods. */
export interface DetectOptions {
  /**
   * Explicit cache key for this contract/ABI detection result. When omitted, a
   * stable key is derived from the descriptor's `contractId` (or `type`) and
   * the ABI, so identical inputs share a cache entry.
   */
  cacheKey?: string;
  /**
   * Whether to validate the descriptor (via the existing
   * {@link import('../registry/capabilityRegistry').CapabilityRegistry}) before
   * detecting. Defaults to `true`; invalid descriptors throw a `ValidationError`.
   */
  validate?: boolean;
}
