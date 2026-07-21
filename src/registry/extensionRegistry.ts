import { ValidationError } from '../errors/axionveraError';
import type {
  ExtensionCompatibility,
  ExtensionDiscoveryQuery,
  ExtensionMetadata,
  ExtensionRegistrationOptions,
  ExtensionRegistryConfig,
  ExtensionRegistryEntry,
  ExtensionValidationResult,
  SDKExtension,
} from '../interfaces';
import { compareSemVer, parseSemVer, satisfiesMinVersion } from '../plugin/validation';

const EXTENSION_ID_REGEX = /^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)*$/i;
const KNOWN_EXTENSION_KINDS = new Set(['module', 'plugin', 'package']);
const KNOWN_RUNTIMES = new Set(['node', 'browser', 'react-native']);

const uniqueStrings = (values: string[] = []): string[] =>
  Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter(Boolean),
    ),
  );

export class ExtensionRegistry {
  private readonly entries = new Map<string, ExtensionRegistryEntry>();
  private readonly config: Required<ExtensionRegistryConfig>;

  constructor(config: ExtensionRegistryConfig = {}) {
    this.config = {
      sdkVersion: config.sdkVersion ?? '0.0.0',
      allowIncompatible: config.allowIncompatible ?? false,
    };
  }

  register<TExports = unknown>(
    extension: SDKExtension<TExports>,
    options: ExtensionRegistrationOptions = {},
  ): ExtensionRegistryEntry<TExports> {
    const normalized = this.normalizeExtension(extension);
    const { metadata } = normalized;

    if (this.entries.has(metadata.id)) {
      throw new Error(`Extension "${metadata.id}" is already registered.`);
    }

    const validation = this.validate(normalized);
    if (!validation.valid) {
      throw new ValidationError(
        `Invalid extension metadata for ${metadata.id}: ${validation.errors.join('; ')}`,
      );
    }

    if (!validation.compatible && !this.config.allowIncompatible) {
      throw new Error(
        `Extension "${metadata.id}" is incompatible with SDK ${this.config.sdkVersion}: ${validation.incompatibilities.join(
          '; ',
        )}`,
      );
    }

    const entry: ExtensionRegistryEntry<TExports> = {
      extension: normalized,
      source: options.source?.trim() || 'runtime',
      autoRegistered: options.autoRegistered ?? false,
      registeredAt: new Date(),
      validation,
    };

    this.entries.set(metadata.id, entry);
    return this.cloneEntry(entry);
  }

  unregister(extensionId: string): void {
    if (!this.entries.has(extensionId)) {
      throw new Error(`Extension "${extensionId}" not found.`);
    }

    const dependents = this.getDependents(extensionId);
    if (dependents.length > 0) {
      throw new Error(
        `Cannot unregister "${extensionId}" because it is a dependency of: ${dependents.join(', ')}`,
      );
    }

    this.entries.delete(extensionId);
  }

  get<TExports = unknown>(extensionId: string): ExtensionRegistryEntry<TExports> | undefined {
    const entry = this.entries.get(extensionId);
    return entry ? this.cloneEntry(entry as ExtensionRegistryEntry<TExports>) : undefined;
  }

  has(extensionId: string): boolean {
    return this.entries.has(extensionId);
  }

  list<TExports = unknown>(
    query: ExtensionDiscoveryQuery = {},
  ): ExtensionRegistryEntry<TExports>[] {
    return Array.from(this.entries.values())
      .filter((entry) => this.matchesQuery(entry, query))
      .map((entry) => this.cloneEntry(entry as ExtensionRegistryEntry<TExports>));
  }

  discover<TExports = unknown>(
    query: ExtensionDiscoveryQuery = {},
  ): ExtensionRegistryEntry<TExports>[] {
    return this.list(query);
  }

  search<TExports = unknown>(query: string): ExtensionRegistryEntry<TExports>[] {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return this.list();
    }

    return this.list<TExports>({
      keyword: normalizedQuery,
    });
  }

  findByCapability<TExports = unknown>(
    capability: string,
  ): ExtensionRegistryEntry<TExports>[] {
    return this.list<TExports>({ capability });
  }

  getAvailableCapabilities(): string[] {
    const capabilities = new Set<string>();

    for (const entry of this.entries.values()) {
      entry.extension.metadata.capabilities.forEach((capability) =>
        capabilities.add(capability),
      );
    }

    return Array.from(capabilities).sort();
  }

  getDependents(extensionId: string): string[] {
    const dependents: string[] = [];

    for (const entry of this.entries.values()) {
      const dependsOnExtension = entry.extension.metadata.dependencies?.some(
        (dependency) => dependency.extensionId === extensionId,
      );

      if (dependsOnExtension) {
        dependents.push(entry.extension.metadata.id);
      }
    }

    return dependents;
  }

  resolveDependencies<TExports = unknown>(
    extensionId: string,
  ): ExtensionRegistryEntry<TExports>[] {
    const resolved: ExtensionRegistryEntry<TExports>[] = [];
    const seen = new Set<string>();

    const visit = (currentId: string): void => {
      if (seen.has(currentId)) {
        return;
      }
      seen.add(currentId);

      const entry = this.entries.get(currentId);
      if (!entry) {
        throw new Error(`Extension "${currentId}" not found.`);
      }

      for (const dependency of entry.extension.metadata.dependencies ?? []) {
        const dependencyEntry = this.entries.get(dependency.extensionId);
        if (!dependencyEntry) {
          if (dependency.optional) {
            continue;
          }

          throw new Error(
            `Extension "${currentId}" requires missing dependency "${dependency.extensionId}".`,
          );
        }

        visit(dependency.extensionId);
      }

      resolved.push(this.cloneEntry(entry as ExtensionRegistryEntry<TExports>));
    };

    visit(extensionId);
    return resolved;
  }

  validate<TExports = unknown>(extension: SDKExtension<TExports>): ExtensionValidationResult {
    const normalized = this.normalizeExtension(extension);
    const { metadata } = normalized;
    const errors: string[] = [];
    const warnings: string[] = [];
    const incompatibilities: string[] = [];

    if (!metadata.id) {
      errors.push('metadata.id is required');
    } else if (!EXTENSION_ID_REGEX.test(metadata.id)) {
      errors.push(
        `metadata.id "${metadata.id}" is invalid. Use alphanumeric characters, dots, and hyphens.`,
      );
    }

    if (!metadata.name) {
      errors.push('metadata.name is required');
    }

    if (!metadata.version) {
      errors.push('metadata.version is required');
    } else if (!parseSemVer(metadata.version)) {
      errors.push(`metadata.version "${metadata.version}" is not valid semver.`);
    }

    if (!metadata.kind || !KNOWN_EXTENSION_KINDS.has(metadata.kind)) {
      errors.push('metadata.kind must be one of: module, plugin, package');
    }

    if (!metadata.capabilities.length) {
      errors.push('metadata.capabilities must contain at least one capability');
    }

    for (const dependency of metadata.dependencies ?? []) {
      if (!dependency.extensionId?.trim()) {
        errors.push('dependencies[].extensionId is required');
      } else if (dependency.extensionId === metadata.id) {
        errors.push('extensions cannot depend on themselves');
      }

      if (dependency.minVersion && !parseSemVer(dependency.minVersion)) {
        errors.push(
          `dependency "${dependency.extensionId}" minVersion "${dependency.minVersion}" is not valid semver.`,
        );
      }
    }

    this.validateCompatibility(metadata.compatibility, errors, warnings, incompatibilities);

    return {
      valid: errors.length === 0,
      compatible: incompatibilities.length === 0,
      errors,
      warnings,
      incompatibilities,
    };
  }

  private validateCompatibility(
    compatibility: ExtensionCompatibility | undefined,
    errors: string[],
    warnings: string[],
    incompatibilities: string[],
  ): void {
    if (!compatibility) {
      return;
    }

    if (
      compatibility.minSDKVersion &&
      !parseSemVer(compatibility.minSDKVersion)
    ) {
      errors.push(
        `compatibility.minSDKVersion "${compatibility.minSDKVersion}" is not valid semver.`,
      );
    }

    if (
      compatibility.maxSDKVersion &&
      !parseSemVer(compatibility.maxSDKVersion)
    ) {
      errors.push(
        `compatibility.maxSDKVersion "${compatibility.maxSDKVersion}" is not valid semver.`,
      );
    }

    for (const version of compatibility.testedSDKVersions ?? []) {
      if (!parseSemVer(version)) {
        errors.push(`compatibility.testedSDKVersions contains invalid semver "${version}".`);
      }
    }

    for (const runtime of compatibility.runtimes ?? []) {
      if (!KNOWN_RUNTIMES.has(runtime)) {
        errors.push(`compatibility.runtimes contains unsupported runtime "${runtime}".`);
      }
    }

    const currentSDKVersion = this.config.sdkVersion;
    const parsedSDKVersion = parseSemVer(currentSDKVersion);
    if (!parsedSDKVersion) {
      warnings.push(
        `SDK version "${currentSDKVersion}" is not valid semver; compatibility checks were skipped.`,
      );
      return;
    }

    if (
      compatibility.minSDKVersion &&
      compareSemVer(parsedSDKVersion, parseSemVer(compatibility.minSDKVersion)!) < 0
    ) {
      incompatibilities.push(
        `requires SDK >= ${compatibility.minSDKVersion}, current version is ${currentSDKVersion}`,
      );
    }

    if (
      compatibility.maxSDKVersion &&
      compareSemVer(parsedSDKVersion, parseSemVer(compatibility.maxSDKVersion)!) > 0
    ) {
      incompatibilities.push(
        `requires SDK <= ${compatibility.maxSDKVersion}, current version is ${currentSDKVersion}`,
      );
    }

    if (
      compatibility.testedSDKVersions?.length &&
      !compatibility.testedSDKVersions.includes(currentSDKVersion)
    ) {
      warnings.push(
        `SDK version ${currentSDKVersion} is outside compatibility.testedSDKVersions.`,
      );
    }
  }

  private matchesQuery(
    entry: ExtensionRegistryEntry,
    query: ExtensionDiscoveryQuery,
  ): boolean {
    const metadata = entry.extension.metadata;
    const normalizedKeyword = query.keyword?.trim().toLowerCase();

    if (query.capability && !metadata.capabilities.includes(query.capability)) {
      return false;
    }

    if (query.kind && metadata.kind !== query.kind) {
      return false;
    }

    if (query.compatibleOnly && !entry.validation.compatible) {
      return false;
    }

    if (normalizedKeyword) {
      const haystack = [
        metadata.id,
        metadata.name,
        metadata.description,
        metadata.packageName,
        ...(metadata.keywords ?? []),
        ...(metadata.tags ?? []),
        ...metadata.capabilities,
      ]
        .filter((value): value is string => Boolean(value))
        .map((value) => value.toLowerCase());

      if (!haystack.some((value) => value.includes(normalizedKeyword))) {
        return false;
      }
    }

    return true;
  }

  private normalizeExtension<TExports>(extension: SDKExtension<TExports>): SDKExtension<TExports> {
    const metadata = extension.metadata;

    return {
      ...extension,
      metadata: {
        ...metadata,
        id: metadata.id?.trim(),
        kind: metadata.kind,
        name: metadata.name?.trim(),
        version: metadata.version?.trim(),
        description: metadata.description?.trim(),
        packageName: metadata.packageName?.trim(),
        entryPoint: metadata.entryPoint?.trim(),
        author: metadata.author?.trim(),
        homepage: metadata.homepage?.trim(),
        license: metadata.license?.trim(),
        keywords: uniqueStrings(metadata.keywords),
        tags: uniqueStrings(metadata.tags),
        capabilities: uniqueStrings(metadata.capabilities),
        compatibility: metadata.compatibility
          ? {
              ...metadata.compatibility,
              minSDKVersion: metadata.compatibility.minSDKVersion?.trim(),
              maxSDKVersion: metadata.compatibility.maxSDKVersion?.trim(),
              testedSDKVersions: uniqueStrings(
                metadata.compatibility.testedSDKVersions,
              ),
              runtimes: metadata.compatibility.runtimes
                ? [...new Set(metadata.compatibility.runtimes)]
                : undefined,
            }
          : undefined,
        dependencies: metadata.dependencies?.map((dependency) => ({
          ...dependency,
          extensionId: dependency.extensionId?.trim(),
          minVersion: dependency.minVersion?.trim(),
        })),
      },
    };
  }

  private cloneEntry<TExports>(
    entry: ExtensionRegistryEntry<TExports>,
  ): ExtensionRegistryEntry<TExports> {
    return {
      ...entry,
      registeredAt: new Date(entry.registeredAt),
      extension: this.cloneExtension(entry.extension),
      validation: {
        ...entry.validation,
        errors: [...entry.validation.errors],
        warnings: [...entry.validation.warnings],
        incompatibilities: [...entry.validation.incompatibilities],
      },
    };
  }

  private cloneExtension<TExports>(extension: SDKExtension<TExports>): SDKExtension<TExports> {
    return {
      ...extension,
      metadata: {
        ...extension.metadata,
        keywords: extension.metadata.keywords
          ? [...extension.metadata.keywords]
          : undefined,
        tags: extension.metadata.tags ? [...extension.metadata.tags] : undefined,
        capabilities: [...extension.metadata.capabilities],
        compatibility: extension.metadata.compatibility
          ? {
              ...extension.metadata.compatibility,
              testedSDKVersions: extension.metadata.compatibility.testedSDKVersions
                ? [...extension.metadata.compatibility.testedSDKVersions]
                : undefined,
              runtimes: extension.metadata.compatibility.runtimes
                ? [...extension.metadata.compatibility.runtimes]
                : undefined,
            }
          : undefined,
        dependencies: extension.metadata.dependencies?.map((dependency) => ({
          ...dependency,
        })),
      },
    };
  }
}

export function isExtensionDependencySatisfied(
  entry: ExtensionRegistryEntry,
  dependency: { extensionId: string; minVersion?: string },
): boolean {
  return (
    entry.extension.metadata.id === dependency.extensionId &&
    (!dependency.minVersion ||
      satisfiesMinVersion(entry.extension.metadata.version, dependency.minVersion))
  );
}
