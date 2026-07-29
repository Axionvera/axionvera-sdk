import { ethers } from 'ethers';
import { ValidationError } from '../errors';
import { ContractReflectionService, contractReflection } from '../reflection';
import { CapabilityRegistry } from '../registry';
import type { ContractCapability, ContractDescriptor } from '../discovery';
import type { CapabilityDetectionResult, DetectedMethod, DetectOptions } from './types';

/**
 * Detects which {@link ContractCapability}s a contract actually supports by
 * reconciling its declared {@link ContractDescriptor} against the methods its
 * ABI exposes.
 *
 * Detection reuses the SDK's existing pieces rather than introducing parallel
 * concepts: method-level reflection comes from {@link ContractReflectionService}
 * (issue #287), the capability taxonomy and method->capability map come from
 * the discovery {@link ContractDescriptor}, and descriptor validation reuses
 * {@link CapabilityRegistry.validate}.
 *
 * A capability is reported as supported only when *every* method the descriptor
 * declares for it is present in the ABI. The reconciliation is bidirectional:
 * declared capabilities the ABI cannot back appear in
 * {@link CapabilityDetectionResult.missing}, and ABI methods the descriptor
 * never mapped appear in {@link CapabilityDetectionResult.undeclaredMethods}.
 *
 * This is capability *detection*, derived entirely from the ABI and descriptor.
 * It is **not** live on-chain negotiation: it never queries a deployed contract
 * and does not rely on an ERC-165-style `supportsInterface` or any wire
 * feature-advertisement protocol, because the SDK exposes no such mechanism.
 *
 * Results are cached per contract/ABI and returned as deep clones, mirroring
 * the clone-on-read behaviour of {@link ContractReflectionService}.
 *
 * @example
 * ```typescript
 * import { capabilityDetector, VaultContractDescriptor, VaultABI } from 'axionvera-sdk';
 *
 * const result = capabilityDetector.detect(VaultContractDescriptor, VaultABI);
 * if (result.supported.includes('assets:deposit')) {
 *   // safe to call deposit
 * }
 * ```
 */
export class CapabilityDetector {
  private readonly cache = new Map<string, CapabilityDetectionResult>();

  constructor(
    private readonly reflection: ContractReflectionService = contractReflection,
    private readonly registry: CapabilityRegistry = new CapabilityRegistry()
  ) {}

  /**
   * Reconciles a descriptor against an ABI and returns the detected
   * capabilities.
   *
   * @param descriptor - The contract's declared discovery descriptor.
   * @param abi - A standard JSON ABI (array or ethers-compatible string).
   * @param options - Optional cache key and validation toggle.
   * @returns The bidirectional capability detection result.
   * @throws {@link ValidationError} if the descriptor is invalid (unless
   *   `options.validate` is `false`) or if the ABI cannot be parsed.
   */
  detect(
    descriptor: ContractDescriptor,
    abi: ethers.InterfaceAbi,
    options: DetectOptions = {}
  ): CapabilityDetectionResult {
    if (options.validate !== false) {
      const validation = this.registry.validate(descriptor);
      if (!validation.valid) {
        throw new ValidationError(
          `Cannot detect capabilities: invalid descriptor: ${validation.errors.join('; ')}`
        );
      }
    }

    const key = options.cacheKey ?? this.cacheKeyFor(descriptor, abi);

    let result = this.cache.get(key);
    if (!result) {
      result = this.buildResult(descriptor, abi);
      this.cache.set(key, result);
    }

    return this.cloneResult(result);
  }

  /**
   * Returns whether the contract supports a capability, i.e. whether every
   * method the descriptor declares for it is present in the ABI.
   */
  supports(
    descriptor: ContractDescriptor,
    abi: ethers.InterfaceAbi,
    capability: ContractCapability,
    options: DetectOptions = {}
  ): boolean {
    return this.detect(descriptor, abi, options).supported.includes(capability);
  }

  /** Clears all cached detection results. */
  clearCache(): void {
    this.cache.clear();
  }

  private buildResult(
    descriptor: ContractDescriptor,
    abi: ethers.InterfaceAbi
  ): CapabilityDetectionResult {
    const abiMethodNames = new Set(this.reflection.getMethods(abi).map((method) => method.name));
    const declaredNames = new Set(descriptor.methods.map((method) => method.name));

    const methods: DetectedMethod[] = descriptor.methods.map((method) => ({
      name: method.name,
      capability: method.capability,
      present: abiMethodNames.has(method.name),
    }));

    // A capability is supported only when all of its defining methods are present.
    const missingCapabilities = new Set<ContractCapability>();
    for (const method of methods) {
      if (!method.present) {
        missingCapabilities.add(method.capability);
      }
    }

    const declaredCapabilities = unique(descriptor.methods.map((method) => method.capability));
    const supported = declaredCapabilities.filter(
      (capability) => !missingCapabilities.has(capability)
    );
    const missing = declaredCapabilities.filter((capability) =>
      missingCapabilities.has(capability)
    );

    const undeclaredMethods = [...abiMethodNames].filter((name) => !declaredNames.has(name));

    return {
      supported,
      missing,
      methods,
      undeclaredMethods,
      complete: missing.length === 0,
    };
  }

  private cacheKeyFor(descriptor: ContractDescriptor, abi: ethers.InterfaceAbi): string {
    const scope = descriptor.contractId ?? descriptor.type;
    const abiKey = typeof abi === 'string' ? abi : JSON.stringify(abi);
    return `${scope}:${abiKey}`;
  }

  private cloneResult(result: CapabilityDetectionResult): CapabilityDetectionResult {
    return {
      supported: [...result.supported],
      missing: [...result.missing],
      methods: result.methods.map((method) => ({ ...method })),
      undeclaredMethods: [...result.undeclaredMethods],
      complete: result.complete,
    };
  }
}

const unique = <T>(values: T[]): T[] => Array.from(new Set(values));

/** Shared {@link CapabilityDetector} instance for typical usage. */
export const capabilityDetector = new CapabilityDetector();
