import {
  defineExtension,
  getExtensionRegistry,
  setExtensionRegistry,
} from '../../src/extensions';
import type {
  ExtensionMetadata,
  ExtensionRegistryEntry,
  SDKExtension,
} from '../../src/interfaces';
import { ExtensionRegistry } from '../../src/registry';

function makeExtension(
  metadata: Partial<ExtensionMetadata> = {},
): SDKExtension<{ activate: () => string }> {
  return {
    metadata: {
      id: 'com.test.extension',
      kind: 'plugin',
      name: 'Test Extension',
      version: '1.0.0',
      description: 'Registers extra SDK capabilities',
      capabilities: ['client:extend'],
      compatibility: {
        minSDKVersion: '1.0.0',
      },
      keywords: ['sdk', 'extension'],
      ...metadata,
    },
    exports: {
      activate: () => 'ready',
    },
  };
}

describe('ExtensionRegistry', () => {
  beforeEach(() => {
    setExtensionRegistry(
      new ExtensionRegistry({
        sdkVersion: '1.5.0',
      }),
    );
  });

  it('auto-registers extensions through defineExtension', () => {
    const extension = makeExtension();

    const definedExtension = defineExtension(extension, {
      source: 'npm:@axionvera/test-extension',
    });

    expect(definedExtension).toBe(extension);

    const entry = getExtensionRegistry().get(extension.metadata.id);
    expect(entry?.autoRegistered).toBe(true);
    expect(entry?.source).toBe('npm:@axionvera/test-extension');
    expect(entry?.extension.metadata.capabilities).toEqual(['client:extend']);
  });

  it('discovers extensions by capability, kind, and keyword', () => {
    const registry = new ExtensionRegistry({ sdkVersion: '1.5.0' });

    registry.register(
      makeExtension({
        id: 'module.analytics',
        kind: 'module',
        name: 'Analytics Module',
        capabilities: ['telemetry:collect'],
        keywords: ['analytics', 'telemetry'],
      }),
    );
    registry.register(
      makeExtension({
        id: 'plugin.wallet',
        kind: 'plugin',
        name: 'Wallet Plugin',
        capabilities: ['wallet:connect'],
        keywords: ['wallet'],
      }),
    );
    registry.register(
      makeExtension({
        id: 'package.cache',
        kind: 'package',
        name: 'Cache Package',
        capabilities: ['storage:cache'],
        keywords: ['cache'],
      }),
    );

    expect(registry.findByCapability('wallet:connect')).toHaveLength(1);
    expect(registry.discover({ kind: 'module' })).toHaveLength(1);
    expect(registry.search('telemetry')).toHaveLength(1);
    expect(registry.getAvailableCapabilities()).toEqual([
      'storage:cache',
      'telemetry:collect',
      'wallet:connect',
    ]);
  });

  it('rejects incompatible extensions by default', () => {
    const registry = new ExtensionRegistry({ sdkVersion: '1.0.0' });

    expect(() =>
      registry.register(
        makeExtension({
          compatibility: {
            minSDKVersion: '2.0.0',
          },
        }),
      ),
    ).toThrow('incompatible');
  });

  it('stores incompatible extensions when allowIncompatible is enabled', () => {
    const registry = new ExtensionRegistry({
      sdkVersion: '1.0.0',
      allowIncompatible: true,
    });

    const entry = registry.register(
      makeExtension({
        id: 'com.test.future',
        compatibility: {
          minSDKVersion: '2.0.0',
        },
      }),
    );

    expect(entry.validation.valid).toBe(true);
    expect(entry.validation.compatible).toBe(false);
    expect(entry.validation.incompatibilities).toEqual([
      'requires SDK >= 2.0.0, current version is 1.0.0',
    ]);
  });

  it('resolves dependencies in order and skips missing optional dependencies', () => {
    const registry = new ExtensionRegistry({ sdkVersion: '1.5.0' });

    registry.register(
      makeExtension({
        id: 'core.base',
        capabilities: ['core:base'],
      }),
    );
    registry.register(
      makeExtension({
        id: 'plugin.analytics',
        capabilities: ['telemetry:collect'],
        dependencies: [
          { extensionId: 'core.base', minVersion: '1.0.0' },
          { extensionId: 'plugin.optional', optional: true },
        ],
      }),
    );

    const resolved = registry.resolveDependencies('plugin.analytics');
    expect(resolved.map((entry) => entry.extension.metadata.id)).toEqual([
      'core.base',
      'plugin.analytics',
    ]);
  });

  it('returns defensive copies of registered metadata', () => {
    const registry = new ExtensionRegistry({ sdkVersion: '1.5.0' });
    registry.register(makeExtension());

    const entry = registry.get('com.test.extension') as ExtensionRegistryEntry;
    entry.extension.metadata.capabilities.push('mutated:capability');
    entry.validation.errors.push('mutated');

    const stored = registry.get('com.test.extension');
    expect(stored?.extension.metadata.capabilities).toEqual(['client:extend']);
    expect(stored?.validation.errors).toEqual([]);
  });
});
