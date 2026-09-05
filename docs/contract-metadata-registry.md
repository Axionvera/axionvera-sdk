# Contract Metadata Registry

The contract metadata registry centralizes contract configuration details for SDK consumers. It stores each contract's name, version, capabilities, supported features, and per-environment deployment metadata.

## Metadata schema

```ts
const vaultMetadata = {
  name: 'Vault',
  version: '1.2.0',
  capabilities: ['read', 'write', 'events'],
  supportedFeatures: ['deposits', 'withdrawals', 'rewards'],
  abiName: 'VaultABI',
  deployments: [
    {
      environment: 'testnet',
      address: 'CBIELZJOO4Z5WQG6FPUV2A5BB3V4T6EULJMYNN2WJNQ57WJQG5KTEST',
      rpcUrl: 'https://soroban-testnet.stellar.org',
    },
  ],
};
```

## Usage

```ts
import { ContractMetadataRegistry } from '@axionvera/core';

const registry = new ContractMetadataRegistry([vaultMetadata]);
const vault = registry.get('Vault', { environment: 'testnet' });
const deployment = registry.getDeployment('Vault', 'testnet');
const writableContracts = registry.list({ capability: 'write' });
```

## Validation strategy

`register` validates metadata before storing it. Validation requires a name, version, at least one capability, at least one deployment, deployment addresses, unique environments per contract, and non-negative block heights.
