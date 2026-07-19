import { UnsupportedAbiVersionError } from '../errors/axionveraError';
import type {
  AbiVersion,
  AbiVersionDescriptor,
  AbiVersionDetectionResult,
  AbiVersionProbe,
} from '../types/abi';

/**
 * Registry of {@link AbiVersionDescriptor}s for one or more logical
 * contracts, keyed by contract id then version. Versions are tracked in
 * registration order per contract — register them oldest-to-newest so
 * {@link getLatestVersion} and the newest-first search in
 * {@link detectVersion} behave correctly.
 *
 * @example
 * ```typescript
 * const registry = new AbiVersionRegistry();
 * registry.register({
 *   contractId: 'Vault',
 *   version: 'v1',
 *   methods: {
 *     getBalance: { rawMethod: 'balance_of' },
 *   },
 * });
 * const versions = registry.listVersions('Vault'); // ['v1']
 * ```
 */
export class AbiVersionRegistry {
  private readonly versionsByContract = new Map<string, Map<AbiVersion, AbiVersionDescriptor>>();
  private readonly orderByContract = new Map<string, AbiVersion[]>();

  /** Registers (or replaces) a version descriptor for its contract. */
  register(descriptor: AbiVersionDescriptor): void {
    const versions =
      this.versionsByContract.get(descriptor.contractId) ??
      new Map<AbiVersion, AbiVersionDescriptor>();
    versions.set(descriptor.version, descriptor);
    this.versionsByContract.set(descriptor.contractId, versions);

    const order = this.orderByContract.get(descriptor.contractId) ?? [];
    if (!order.includes(descriptor.version)) {
      order.push(descriptor.version);
      this.orderByContract.set(descriptor.contractId, order);
    }
  }

  /** Removes a previously registered version. Returns `false` if it wasn't registered. */
  unregister(contractId: string, version: AbiVersion): boolean {
    const versions = this.versionsByContract.get(contractId);
    if (!versions) return false;

    const removed = versions.delete(version);
    if (removed) {
      const order = this.orderByContract.get(contractId) ?? [];
      this.orderByContract.set(
        contractId,
        order.filter((existing) => existing !== version)
      );
    }
    return removed;
  }

  /** Returns the descriptor for `contractId`/`version`, or `undefined` if unregistered. */
  get(contractId: string, version: AbiVersion): AbiVersionDescriptor | undefined {
    return this.versionsByContract.get(contractId)?.get(version);
  }

  /** Like {@link get}, but throws {@link UnsupportedAbiVersionError} instead of returning `undefined`. */
  require(contractId: string, version: AbiVersion): AbiVersionDescriptor {
    const descriptor = this.get(contractId, version);
    if (!descriptor) {
      throw new UnsupportedAbiVersionError(contractId, version, this.listVersions(contractId));
    }
    return descriptor;
  }

  has(contractId: string, version: AbiVersion): boolean {
    return this.versionsByContract.get(contractId)?.has(version) ?? false;
  }

  /** Every registered version for `contractId`, oldest-registered first. */
  listVersions(contractId: string): AbiVersion[] {
    return [...(this.orderByContract.get(contractId) ?? [])];
  }

  /** Every registered descriptor for `contractId`, oldest-registered first. */
  list(contractId: string): AbiVersionDescriptor[] {
    const descriptors: AbiVersionDescriptor[] = [];
    for (const version of this.listVersions(contractId)) {
      const descriptor = this.get(contractId, version);
      if (descriptor) descriptors.push(descriptor);
    }
    return descriptors;
  }

  /** The most-recently-registered version for a contract, or `undefined` if none are registered. */
  getLatestVersion(contractId: string): AbiVersion | undefined {
    const order = this.orderByContract.get(contractId);
    return order && order.length > 0 ? order[order.length - 1] : undefined;
  }

  /**
   * Determines which registered ABI version a deployed contract instance is
   * running, without requiring the caller to know it up front.
   *
   * Resolution order:
   * 1. **Explicit** — if `probe.readExplicitVersion` is supplied and returns a
   *    version that's registered for this contract, that's used directly.
   * 2. **Inferred** — otherwise, every registered version is tried newest
   *    first; the first one whose fingerprint methods (see
   *    {@link AbiVersionDescriptor.fingerprintMethods}) are ALL present on
   *    the deployed contract wins.
   * 3. **Unknown** — if neither resolves anything, `{ version: undefined,
   *    confidence: 'unknown', matchedMethods: [] }` is returned. Callers
   *    typically fall back to a configured default version at this point
   *    (see `AbiCompatAdapter`'s `fallbackVersion` option) or surface an error.
   */
  async detectVersion(
    contractId: string,
    probe: AbiVersionProbe
  ): Promise<AbiVersionDetectionResult> {
    if (probe.readExplicitVersion) {
      const explicit = await probe.readExplicitVersion();
      if (explicit && this.has(contractId, explicit)) {
        return { version: explicit, confidence: 'explicit', matchedMethods: [] };
      }
    }

    const newestFirst = [...this.listVersions(contractId)].reverse();
    for (const version of newestFirst) {
      const descriptor = this.get(contractId, version);
      if (!descriptor) continue;
      const candidates = descriptor.fingerprintMethods?.length
        ? descriptor.fingerprintMethods
        : Object.values(descriptor.methods).map((method) => method.rawMethod);
      const uniqueCandidates = [...new Set(candidates)];
      if (uniqueCandidates.length === 0) continue;

      const matched: string[] = [];
      let allPresent = true;
      for (const rawMethod of uniqueCandidates) {
        // Sequential by design: this is a small, fixed fingerprint list, and
        // short-circuiting on the first miss avoids probing methods we
        // already know rule out this version.
        // eslint-disable-next-line no-await-in-loop
        const present = await probe.hasMethod(rawMethod);
        if (!present) {
          allPresent = false;
          break;
        }
        matched.push(rawMethod);
      }

      if (allPresent) {
        return { version, confidence: 'inferred', matchedMethods: matched };
      }
    }

    return { version: undefined, confidence: 'unknown', matchedMethods: [] };
  }
}

/**
 * Shared, SDK-wide ABI version registry. Built-in contract ABI versions (see
 * `src/contracts/vaultAbiVersions.ts`) register themselves here; consumers
 * can register their own contracts' versions on this same instance, or
 * create an isolated `new AbiVersionRegistry()` for tests.
 */
export const defaultAbiVersionRegistry = new AbiVersionRegistry();
