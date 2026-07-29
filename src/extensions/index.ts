import type {
  ExtensionDiscoveryQuery,
  ExtensionRegistrationOptions,
  ExtensionRegistryEntry,
  SDKExtension,
} from '../interfaces';
import { ExtensionRegistry } from '../registry';

let defaultExtensionRegistry: ExtensionRegistry | undefined;

export function getExtensionRegistry(): ExtensionRegistry {
  if (!defaultExtensionRegistry) {
    defaultExtensionRegistry = new ExtensionRegistry();
  }

  return defaultExtensionRegistry;
}

export function setExtensionRegistry(registry: ExtensionRegistry): void {
  defaultExtensionRegistry = registry;
}

export function registerExtension<TExports = unknown>(
  extension: SDKExtension<TExports>,
  options: ExtensionRegistrationOptions = {},
): ExtensionRegistryEntry<TExports> {
  return getExtensionRegistry().register(extension, options);
}

export function defineExtension<TExports = unknown>(
  extension: SDKExtension<TExports>,
  options: Omit<ExtensionRegistrationOptions, 'autoRegistered'> = {},
): SDKExtension<TExports> {
  registerExtension(extension, {
    ...options,
    autoRegistered: true,
  });

  return extension;
}

export function discoverExtensions<TExports = unknown>(
  query: ExtensionDiscoveryQuery = {},
): ExtensionRegistryEntry<TExports>[] {
  return getExtensionRegistry().discover<TExports>(query);
}

export function findExtensionsByCapability<TExports = unknown>(
  capability: string,
): ExtensionRegistryEntry<TExports>[] {
  return getExtensionRegistry().findByCapability<TExports>(capability);
}
