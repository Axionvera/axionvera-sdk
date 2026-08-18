import type { AxionveraNetwork } from '../utils/networkConfig';

export type ContractEnvironment = AxionveraNetwork | (string & {});

export type ContractCapability =
  | 'read'
  | 'write'
  | 'events'
  | 'upgradeable'
  | 'pausable'
  | 'admin'
  | (string & {});

export type ContractFeature = string;

export interface ContractDeploymentMetadata {
  environment: ContractEnvironment;
  address: string;
  networkPassphrase?: string;
  rpcUrl?: string;
  deployedAt?: string;
  blockHeight?: number;
}

export interface ContractMetadata {
  name: string;
  version: string;
  capabilities: ContractCapability[];
  deployments: ContractDeploymentMetadata[];
  supportedFeatures?: ContractFeature[];
  description?: string;
  abiName?: string;
  tags?: string[];
}

export interface ContractLookupOptions {
  environment?: ContractEnvironment;
  capability?: ContractCapability;
  feature?: ContractFeature;
}

export interface ContractValidationResult {
  valid: boolean;
  errors: string[];
}

export class ContractMetadataRegistry {
  private readonly contracts = new Map<string, ContractMetadata>();

  constructor(initialMetadata: ContractMetadata[] = []) {
    initialMetadata.forEach((metadata) => this.register(metadata));
  }

  register(metadata: ContractMetadata): ContractMetadata {
    const validation = this.validate(metadata);
    if (!validation.valid) {
      throw new Error(
        `Invalid contract metadata for ${metadata.name || '<unknown>'}: ${validation.errors.join('; ')}`
      );
    }

    const normalized = this.cloneMetadata(metadata);
    this.contracts.set(normalized.name, normalized);
    return this.cloneMetadata(normalized);
  }

  get(name: string, options: ContractLookupOptions = {}): ContractMetadata | undefined {
    const metadata = this.contracts.get(name);
    if (!metadata || !this.matches(metadata, options)) {
      return undefined;
    }

    return this.cloneMetadata(metadata);
  }

  getDeployment(
    name: string,
    environment: ContractEnvironment
  ): ContractDeploymentMetadata | undefined {
    const metadata = this.contracts.get(name);
    const deployment = metadata?.deployments.find((entry) => entry.environment === environment);
    return deployment ? { ...deployment } : undefined;
  }

  list(options: ContractLookupOptions = {}): ContractMetadata[] {
    return Array.from(this.contracts.values())
      .filter((metadata) => this.matches(metadata, options))
      .map((metadata) => this.cloneMetadata(metadata));
  }

  has(name: string): boolean {
    return this.contracts.has(name);
  }

  unregister(name: string): boolean {
    return this.contracts.delete(name);
  }

  validate(metadata: ContractMetadata): ContractValidationResult {
    const errors: string[] = [];

    if (!metadata.name?.trim()) errors.push('name is required');
    if (!metadata.version?.trim()) errors.push('version is required');
    if (!Array.isArray(metadata.capabilities) || metadata.capabilities.length === 0) {
      errors.push('at least one capability is required');
    }
    if (!Array.isArray(metadata.deployments) || metadata.deployments.length === 0) {
      errors.push('at least one deployment is required');
    }

    const environments = new Set<string>();
    metadata.deployments?.forEach((deployment, index) => {
      if (!deployment.environment?.trim())
        errors.push(`deployments[${index}].environment is required`);
      if (!deployment.address?.trim()) errors.push(`deployments[${index}].address is required`);
      if (deployment.environment) {
        if (environments.has(deployment.environment)) {
          errors.push(`duplicate deployment environment: ${deployment.environment}`);
        }
        environments.add(deployment.environment);
      }
      if (deployment.blockHeight !== undefined && deployment.blockHeight < 0) {
        errors.push(`deployments[${index}].blockHeight must be non-negative`);
      }
    });

    return { valid: errors.length === 0, errors };
  }

  private matches(metadata: ContractMetadata, options: ContractLookupOptions): boolean {
    if (
      options.environment &&
      !metadata.deployments.some((entry) => entry.environment === options.environment)
    ) {
      return false;
    }
    if (options.capability && !metadata.capabilities.includes(options.capability)) {
      return false;
    }
    if (options.feature && !(metadata.supportedFeatures ?? []).includes(options.feature)) {
      return false;
    }
    return true;
  }

  private cloneMetadata(metadata: ContractMetadata): ContractMetadata {
    const cloned: ContractMetadata = {
      name: metadata.name,
      version: metadata.version,
      capabilities: [...metadata.capabilities],
      deployments: metadata.deployments.map((deployment) => ({ ...deployment })),
    };

    if (metadata.supportedFeatures !== undefined) {
      cloned.supportedFeatures = [...metadata.supportedFeatures];
    }
    if (metadata.description !== undefined) {
      cloned.description = metadata.description;
    }
    if (metadata.abiName !== undefined) {
      cloned.abiName = metadata.abiName;
    }
    if (metadata.tags !== undefined) {
      cloned.tags = [...metadata.tags];
    }

    return cloned;
  }
}

export const contractMetadataRegistry = new ContractMetadataRegistry();
