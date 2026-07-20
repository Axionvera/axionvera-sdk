export { CapabilityRegistry } from './capabilityRegistry';
export {
  ContractMetadataRegistry,
  contractMetadataRegistry,
} from './contractMetadataRegistry';
export { ExtensionRegistry, isExtensionDependencySatisfied } from './extensionRegistry';
export type {
  ContractEnvironment,
  ContractCapability,
  ContractFeature,
  ContractDeploymentMetadata,
  ContractMetadata,
  ContractLookupOptions,
  ContractValidationResult,
} from './contractMetadataRegistry';
export type {
  ExtensionCapability,
  ExtensionCompatibility,
  ExtensionDependency,
  ExtensionDiscoveryQuery,
  ExtensionKind,
  ExtensionMetadata,
  ExtensionRegistryConfig,
  ExtensionRegistryEntry,
  ExtensionRuntime,
  ExtensionValidationResult,
  SDKExtension,
} from '../interfaces';
