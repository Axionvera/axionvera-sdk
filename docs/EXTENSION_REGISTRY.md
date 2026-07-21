# Extension Registry Framework

The extension registry gives Axionvera SDK modules, plugins, and optional packages a single discovery model. Extension authors publish metadata once, self-register on import, and consumers can query capabilities without coupling their code to a specific package.

## Overview

The framework introduces three pieces:

- `ExtensionMetadata`: the canonical schema for extension identity, capabilities, dependencies, and SDK compatibility.
- `ExtensionRegistry`: a runtime catalog that validates metadata, stores registrations, exposes discovery APIs, and resolves dependencies.
- `defineExtension()`: a helper that auto-registers an extension with the default registry as soon as its module is imported.

## Metadata schema

```ts
import type { SDKExtension } from 'axionvera-sdk';

export const analyticsExtension: SDKExtension = {
  metadata: {
    id: 'com.axionvera.analytics',
    kind: 'plugin',
    name: 'Analytics Extension',
    version: '1.2.0',
    description: 'Adds telemetry hooks and metrics middleware.',
    packageName: '@axionvera/analytics-extension',
    capabilities: ['telemetry:collect', 'middleware:request'],
    keywords: ['analytics', 'telemetry'],
    compatibility: {
      minSDKVersion: '1.0.0',
      maxSDKVersion: '2.0.0',
      testedSDKVersions: ['1.5.0'],
      runtimes: ['node', 'browser'],
    },
    dependencies: [{ extensionId: 'com.axionvera.core-observability', minVersion: '1.0.0' }],
  },
};
```

## Self-registration workflow

Use `defineExtension()` at the module boundary. Importing the file is enough to register the extension with the shared registry.

```ts
import { defineExtension } from 'axionvera-sdk';
import { analyticsPlugin } from './analyticsPlugin';

export const analyticsExtension = defineExtension(
  {
    metadata: {
      id: 'com.axionvera.analytics',
      kind: 'plugin',
      name: 'Analytics Extension',
      version: '1.2.0',
      capabilities: ['telemetry:collect', 'middleware:request'],
      compatibility: {
        minSDKVersion: '1.0.0',
      },
    },
    exports: analyticsPlugin,
  },
  {
    source: 'npm:@axionvera/analytics-extension',
  },
);
```

If you already have a `PluginConfig`, keep using the plugin manager for lifecycle hooks and wrap the plugin in a registry entry for discovery. This separates runtime behavior from capability discovery.

## Discovery API

```ts
import {
  discoverExtensions,
  findExtensionsByCapability,
  getExtensionRegistry,
} from 'axionvera-sdk';

const registry = getExtensionRegistry();

const allExtensions = discoverExtensions();
const telemetryExtensions = findExtensionsByCapability('telemetry:collect');
const compatiblePackages = registry.discover({
  kind: 'package',
  compatibleOnly: true,
});
const dependencyOrder = registry.resolveDependencies('com.axionvera.analytics');
```

Discovery supports:

- filtering by `kind`
- filtering by `capability`
- keyword search across name, description, tags, keywords, and capabilities
- compatibility-only views
- dependency resolution for install or activation ordering

## Compatibility model

Registry validation checks:

- required metadata fields
- semver formatting for extension and dependency versions
- SDK compatibility through `minSDKVersion` and `maxSDKVersion`
- runtime target declarations
- self-dependency errors

By default, incompatible extensions are rejected at registration time. For migration or exploratory tooling, construct the registry with `allowIncompatible: true` to keep the entry while preserving its validation report.

```ts
import { ExtensionRegistry } from 'axionvera-sdk';

const registry = new ExtensionRegistry({
  sdkVersion: '1.5.0',
  allowIncompatible: true,
});
```

## Development workflow

1. Define an `SDKExtension` with stable metadata and explicit capabilities.
2. Call `defineExtension()` in the extension entry module so importing the package registers it automatically.
3. Use the `exports` field to expose the plugin, module factory, or package API the consumer should load.
4. Add tests that validate discovery, compatibility rules, and dependency resolution.

## Testing guidance

The extension test suite should cover:

- auto-registration through `defineExtension()`
- capability discovery through `discover()` and `findByCapability()`
- SDK compatibility pass/fail cases
- dependency resolution order
- defensive-copy behavior from registry reads
