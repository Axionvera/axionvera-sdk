import { AbiVersionDetectionError, UnsupportedContractMethodError } from '../errors/axionveraError';
import type { AbiVersionRegistry } from '../registry/abiVersionRegistry';
import type { AbiVersion, AbiVersionProbe } from '../types/abi';
import type { ContractAdapter, ContractMethodArg } from './types';

/**
 * The underlying transport `AbiCompatAdapter` calls once it has resolved a
 * canonical method name down to a raw on-chain method name. Implement this
 * over `StellarClient`/`VaultContract` (or a mock, for tests) — it never
 * needs to know about ABI versions itself.
 */
export interface RawContractCaller {
  read<T = unknown>(
    contractId: string,
    rawMethod: string,
    ...args: ContractMethodArg[]
  ): Promise<T>;
  write(contractId: string, rawMethod: string, ...args: ContractMethodArg[]): Promise<string>;
}

export interface AbiCompatAdapterOptions {
  /** Adapter name, as registered with `AdapterRegistry`. */
  name: string;
  /** Logical contract id (e.g. `"Vault"`) this adapter serves — must match the id used when registering ABI versions. */
  contractId: string;
  registry: AbiVersionRegistry;
  raw: RawContractCaller;
  /** Builds a version probe for a specific deployed contract address, used for auto-detection. */
  createProbe: (deployedContractId: string) => AbiVersionProbe;
  /** Used when detection can't determine a version (no explicit tag, no fingerprint match). If omitted, an unresolved detection throws {@link AbiVersionDetectionError}. */
  fallbackVersion?: AbiVersion;
}

/**
 * A {@link ContractAdapter} that presents one stable, canonical method
 * interface over a contract that may be deployed at different ABI versions
 * across environments (or mid-rollout within the same environment).
 *
 * On first call for a given deployed contract address, the adapter detects
 * its ABI version via `options.registry.detectVersion` and caches the
 * result. Every subsequent canonical `read`/`write` call is translated
 * through that version's {@link AbiVersionDescriptor} — argument
 * serialization, raw method dispatch, then result deserialization — so
 * callers never need to branch on which version is deployed.
 *
 * @example
 * ```typescript
 * const adapter = new AbiCompatAdapter({
 *   name: 'vault-abi-compat',
 *   contractId: 'Vault',
 *   registry: defaultAbiVersionRegistry,
 *   raw: myRawCaller,
 *   createProbe: (contractId) => new MyOnChainProbe(contractId),
 * });
 *
 * // Works the same whether the deployed Vault is on ABI v1, v2, or v3.
 * const info = await adapter.read('CATZ...', 'getVaultInfo');
 * ```
 */
export class AbiCompatAdapter implements ContractAdapter {
  readonly name: string;
  /** Framework version of this adapter shape — distinct from the contract's ABI version, which varies per deployed address. */
  readonly version = '1.0.0';

  private readonly detectedVersions = new Map<string, AbiVersion>();

  constructor(private readonly options: AbiCompatAdapterOptions) {
    this.name = options.name;
  }

  supports(contractId: string): Promise<boolean> {
    // AbiCompatAdapter is intended to be instantiated per logical contract,
    // so "supports" just checks it looks like a Soroban contract address.
    // Consumers with multiple deployed addresses for the same logical
    // contract can override via a custom ContractAdapter if they need
    // stricter matching.
    void this.options.contractId;
    return Promise.resolve(contractId.startsWith('C') && contractId.length === 56);
  }

  /** Resolves (and caches) the ABI version for a specific deployed contract address. */
  async resolveVersion(deployedContractId: string): Promise<AbiVersion> {
    const cached = this.detectedVersions.get(deployedContractId);
    if (cached) return cached;

    const probe = this.options.createProbe(deployedContractId);
    const detection = await this.options.registry.detectVersion(this.options.contractId, probe);

    const resolved = detection.version ?? this.options.fallbackVersion;
    if (!resolved) {
      throw new AbiVersionDetectionError(this.options.contractId);
    }

    this.detectedVersions.set(deployedContractId, resolved);
    return resolved;
  }

  /** Clears the cached ABI version for `deployedContractId` (or every cached version, if omitted), forcing re-detection on the next call. */
  invalidate(deployedContractId?: string): void {
    if (deployedContractId) this.detectedVersions.delete(deployedContractId);
    else this.detectedVersions.clear();
  }

  async read<T = unknown>(
    contractId: string,
    method: string,
    ...args: ContractMethodArg[]
  ): Promise<T> {
    const version = await this.resolveVersion(contractId);
    const methodAdapter = this.options.registry.require(this.options.contractId, version).methods[
      method
    ];
    // Record index access is typed as always-defined without
    // `noUncheckedIndexedAccess`, but an arbitrary `method` string can
    // genuinely miss at runtime — this check is real, not redundant.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!methodAdapter) {
      throw new UnsupportedContractMethodError(this.options.contractId, method, version);
    }

    const rawArgs = methodAdapter.serializeArgs
      ? methodAdapter.serializeArgs(...args)
      : (args as unknown[]);
    const rawResult = await this.options.raw.read(
      contractId,
      methodAdapter.rawMethod,
      ...(rawArgs as ContractMethodArg[])
    );
    const result = methodAdapter.deserializeResult
      ? await methodAdapter.deserializeResult(rawResult)
      : rawResult;
    return result as T;
  }

  async write(contractId: string, method: string, ...args: ContractMethodArg[]): Promise<string> {
    const version = await this.resolveVersion(contractId);
    const methodAdapter = this.options.registry.require(this.options.contractId, version).methods[
      method
    ];
    // Record index access is typed as always-defined without
    // `noUncheckedIndexedAccess`, but an arbitrary `method` string can
    // genuinely miss at runtime — this check is real, not redundant.
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (!methodAdapter) {
      throw new UnsupportedContractMethodError(this.options.contractId, method, version);
    }

    const rawArgs = methodAdapter.serializeArgs
      ? methodAdapter.serializeArgs(...args)
      : (args as unknown[]);
    return this.options.raw.write(
      contractId,
      methodAdapter.rawMethod,
      ...(rawArgs as ContractMethodArg[])
    );
  }
}
