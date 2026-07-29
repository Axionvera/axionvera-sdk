import { CapabilityRegistry } from '../registry';
import { DefaultContractDescriptors } from './defaultContracts';
import type {
  ContractCapability,
  ContractDescriptor,
  ContractDiscoveryService,
  DiscoveryValidationResult,
} from './types';

export class DefaultContractDiscoveryService implements ContractDiscoveryService {
  private readonly registry: CapabilityRegistry;

  constructor(descriptors: ContractDescriptor[] = DefaultContractDescriptors) {
    this.registry = new CapabilityRegistry(descriptors);
  }

  discoverContracts(): ContractDescriptor[] {
    return this.registry.list();
  }

  lookupContract(typeOrId: string): ContractDescriptor | undefined {
    return this.registry.lookup(typeOrId);
  }

  getCapabilities(typeOrId: string): ContractCapability[] {
    return this.registry.getCapabilities(typeOrId);
  }

  supportsCapability(typeOrId: string, capability: ContractCapability): boolean {
    return this.registry.supportsCapability(typeOrId, capability);
  }

  validateContract(descriptor: ContractDescriptor): DiscoveryValidationResult {
    return this.registry.validate(descriptor);
  }
}

export const contractDiscovery = new DefaultContractDiscoveryService();
