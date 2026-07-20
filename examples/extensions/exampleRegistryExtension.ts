import { defineExtension, type SDKExtension } from '../../src';
import { examplePlugin } from '../plugins/examplePlugin';

export const exampleRegistryExtension: SDKExtension<typeof examplePlugin> =
  defineExtension(
    {
      metadata: {
        id: 'example.registry-plugin',
        kind: 'plugin',
        name: 'Example Registry Plugin',
        version: '1.0.0',
        description: 'Demonstrates self-registration through the SDK extension registry.',
        packageName: '@axionvera/example-registry-plugin',
        capabilities: ['client:middleware', 'client:configuration'],
        keywords: ['example', 'plugin', 'registry'],
        compatibility: {
          minSDKVersion: '1.0.0',
          runtimes: ['node'],
        },
      },
      exports: examplePlugin,
    },
    {
      source: 'examples/extensions/exampleRegistryExtension.ts',
    },
  );
