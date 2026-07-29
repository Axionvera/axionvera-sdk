import { ValidationError } from '../errors';
import type {
  ContractCapability,
  ContractDescriptor,
  DiscoveryValidationResult,
} from '../discovery';

const CONTRACT_ID_PATTERN = /^(0x[a-fA-F0-9]{40}|[A-Z0-9]{56}|[a-fA-F0-9]{64})$/;

const unique = <T>(values: T[]): T[] => Array.from(new Set(values));

export class CapabilityRegistry {
  private readonly contracts = new Map<string, ContractDescriptor>();

  constructor(descriptors: ContractDescriptor[] = []) {
    descriptors.forEach((descriptor) => this.register(descriptor));
  }

  register(descriptor: ContractDescriptor): ContractDescriptor {
    const validation = this.validate(descriptor);
    if (!validation.valid) {
      throw new ValidationError(`Invalid contract descriptor: ${validation.errors.join('; ')}`);
    }

    const normalized = this.normalize(descriptor);
    this.contracts.set(normalized.type, normalized);
    if (normalized.contractId) {
      this.contracts.set(normalized.contractId, normalized);
    }
    return normalized;
  }

  list(): ContractDescriptor[] {
    return unique(Array.from(this.contracts.values())).map((descriptor) => ({
      ...descriptor,
      capabilities: [...descriptor.capabilities],
      methods: descriptor.methods.map((method) => ({ ...method })),
      metadata: descriptor.metadata ? { ...descriptor.metadata } : undefined,
    }));
  }

  lookup(typeOrId: string): ContractDescriptor | undefined {
    const descriptor = this.contracts.get(typeOrId);
    return descriptor
      ? {
          ...descriptor,
          capabilities: [...descriptor.capabilities],
          methods: descriptor.methods.map((method) => ({ ...method })),
          metadata: descriptor.metadata ? { ...descriptor.metadata } : undefined,
        }
      : undefined;
  }

  getCapabilities(typeOrId: string): ContractCapability[] {
    return this.lookup(typeOrId)?.capabilities ?? [];
  }

  supportsCapability(typeOrId: string, capability: ContractCapability): boolean {
    return this.getCapabilities(typeOrId).includes(capability);
  }

  validate(descriptor: ContractDescriptor): DiscoveryValidationResult {
    const errors: string[] = [];
    if (!descriptor.type?.trim()) errors.push('type is required');
    if (!descriptor.displayName?.trim()) errors.push('displayName is required');
    if (!descriptor.version?.trim()) errors.push('version is required');
    if (descriptor.contractId && !CONTRACT_ID_PATTERN.test(descriptor.contractId)) {
      errors.push('contractId must be a valid EVM, Soroban, or 32-byte hex identifier');
    }
    if (!descriptor.capabilities?.length) errors.push('at least one capability is required');
    if (!descriptor.methods?.length) errors.push('at least one method is required');

    const capabilities = new Set(descriptor.capabilities ?? []);
    for (const method of descriptor.methods ?? []) {
      if (!method.name?.trim()) errors.push('method name is required');
      if (!capabilities.has(method.capability)) {
        errors.push(`method ${method.name} references unsupported capability ${method.capability}`);
      }
    }

    return { valid: errors.length === 0, errors };
  }

  private normalize(descriptor: ContractDescriptor): ContractDescriptor {
    return {
      ...descriptor,
      type: descriptor.type.trim(),
      displayName: descriptor.displayName.trim(),
      version: descriptor.version.trim(),
      contractId: descriptor.contractId?.trim(),
      capabilities: unique(descriptor.capabilities),
      methods: descriptor.methods.map((method) => ({ ...method })),
      metadata: descriptor.metadata ? { ...descriptor.metadata } : undefined,
    };
  }
}
