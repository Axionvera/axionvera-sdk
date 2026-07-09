export type CryptoProviderCapability = 'digest' | 'sign' | 'verify';

export interface CryptoProvider {
  id: string;
  capabilities: readonly CryptoProviderCapability[];
  digest?: (algorithm: string, data: Uint8Array) => Promise<Uint8Array> | Uint8Array;
  sign?: (
    payload: Uint8Array,
    context?: Record<string, unknown>
  ) => Promise<Uint8Array> | Uint8Array;
  verify?: (
    payload: Uint8Array,
    signature: Uint8Array,
    context?: Record<string, unknown>
  ) => Promise<boolean> | boolean;
}

export interface CryptoProviderValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateCryptoProvider(provider: CryptoProvider): CryptoProviderValidationResult {
  const errors: string[] = [];

  if (!provider.id.trim()) {
    errors.push('Crypto provider id is required');
  }

  if (provider.capabilities.length === 0) {
    errors.push('Crypto provider must declare at least one capability');
  }

  if (provider.capabilities.includes('digest') && !provider.digest) {
    errors.push('Crypto provider declares digest but does not implement digest()');
  }

  if (provider.capabilities.includes('sign') && !provider.sign) {
    errors.push('Crypto provider declares sign but does not implement sign()');
  }

  if (provider.capabilities.includes('verify') && !provider.verify) {
    errors.push('Crypto provider declares verify but does not implement verify()');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export class CryptoProviderRegistry {
  private readonly providers = new Map<string, CryptoProvider>();
  private defaultProviderId?: string;

  register(provider: CryptoProvider, options: { default?: boolean } = {}): this {
    const validation = validateCryptoProvider(provider);
    if (!validation.valid) {
      throw new Error(validation.errors.join('; '));
    }

    if (this.providers.has(provider.id)) {
      throw new Error(`Crypto provider "${provider.id}" is already registered`);
    }

    this.providers.set(provider.id, provider);

    if (options.default || !this.defaultProviderId) {
      this.defaultProviderId = provider.id;
    }

    return this;
  }

  get(id: string): CryptoProvider | undefined {
    return this.providers.get(id);
  }

  require(id: string): CryptoProvider {
    const provider = this.get(id);
    if (!provider) {
      throw new Error(`Crypto provider "${id}" is not registered`);
    }

    return provider;
  }

  getDefault(): CryptoProvider {
    if (!this.defaultProviderId) {
      throw new Error('No default crypto provider is registered');
    }

    return this.require(this.defaultProviderId);
  }

  findByCapability(capability: CryptoProviderCapability): CryptoProvider[] {
    return Array.from(this.providers.values()).filter((provider) =>
      provider.capabilities.includes(capability)
    );
  }

  unregister(id: string): boolean {
    const removed = this.providers.delete(id);

    if (removed && this.defaultProviderId === id) {
      this.defaultProviderId = this.providers.keys().next().value;
    }

    return removed;
  }

  clear(): void {
    this.providers.clear();
    this.defaultProviderId = undefined;
  }
}

export class NodeDigestCryptoProvider implements CryptoProvider {
  readonly id = 'node-digest';
  readonly capabilities = ['digest'] as const;

  async digest(algorithm: string, data: Uint8Array): Promise<Uint8Array> {
    const { createHash } = await import('crypto');
    const hash = createHash(this.normalizeAlgorithm(algorithm));
    hash.update(data);
    return new Uint8Array(hash.digest());
  }

  private normalizeAlgorithm(algorithm: string): string {
    return algorithm.toLowerCase().replace('-', '');
  }
}

export const cryptoProviderRegistry = new CryptoProviderRegistry();

cryptoProviderRegistry.register(new NodeDigestCryptoProvider(), { default: true });
