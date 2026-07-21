export type ExtensionKind = 'module' | 'plugin' | 'package';

export type ExtensionRuntime = 'node' | 'browser' | 'react-native';

export type ExtensionCapability = string;

export interface ExtensionDependency {
  extensionId: string;
  minVersion?: string;
  optional?: boolean;
}

export interface ExtensionCompatibility {
  minSDKVersion?: string;
  maxSDKVersion?: string;
  testedSDKVersions?: string[];
  runtimes?: ExtensionRuntime[];
}

export interface ExtensionMetadata {
  id: string;
  kind: ExtensionKind;
  name: string;
  version: string;
  description?: string;
  packageName?: string;
  entryPoint?: string;
  author?: string;
  homepage?: string;
  license?: string;
  keywords?: string[];
  tags?: string[];
  capabilities: ExtensionCapability[];
  compatibility?: ExtensionCompatibility;
  dependencies?: ExtensionDependency[];
}

export interface SDKExtension<TExports = unknown> {
  metadata: ExtensionMetadata;
  exports?: TExports;
}

export interface ExtensionValidationResult {
  valid: boolean;
  compatible: boolean;
  errors: string[];
  warnings: string[];
  incompatibilities: string[];
}

export interface ExtensionRegistryEntry<TExports = unknown> {
  extension: SDKExtension<TExports>;
  source: string;
  autoRegistered: boolean;
  registeredAt: Date;
  validation: ExtensionValidationResult;
}

export interface ExtensionDiscoveryQuery {
  capability?: ExtensionCapability;
  kind?: ExtensionKind;
  keyword?: string;
  compatibleOnly?: boolean;
}

export interface ExtensionRegistryConfig {
  sdkVersion?: string;
  allowIncompatible?: boolean;
}

export interface ExtensionRegistrationOptions {
  source?: string;
  autoRegistered?: boolean;
}
