import {
  CryptoProvider,
  CryptoProviderRegistry,
  NodeDigestCryptoProvider,
  cryptoProviderRegistry,
  validateCryptoProvider,
} from '../../src/crypto';

describe('CryptoProviderRegistry', () => {
  afterEach(() => {
    cryptoProviderRegistry.clear();
    cryptoProviderRegistry.register(new NodeDigestCryptoProvider(), { default: true });
  });

  it('validates provider capabilities before registration', () => {
    expect(
      validateCryptoProvider({
        id: '',
        capabilities: [],
      })
    ).toEqual({
      valid: false,
      errors: [
        'Crypto provider id is required',
        'Crypto provider must declare at least one capability',
      ],
    });

    expect(() =>
      new CryptoProviderRegistry().register({
        id: 'bad-signer',
        capabilities: ['sign'],
      })
    ).toThrow('does not implement sign');
  });

  it('registers default providers and finds providers by capability', () => {
    const registry = new CryptoProviderRegistry();
    const signer: CryptoProvider = {
      id: 'mock-signer',
      capabilities: ['sign', 'verify'],
      sign: (payload) => payload,
      verify: () => true,
    };
    const digest = new NodeDigestCryptoProvider();

    registry.register(signer);
    registry.register(digest, { default: true });

    expect(registry.getDefault()).toBe(digest);
    expect(registry.require('mock-signer')).toBe(signer);
    expect(registry.findByCapability('sign')).toEqual([signer]);
    expect(registry.findByCapability('digest')).toEqual([digest]);
  });

  it('prevents duplicate providers and moves default after unregister', () => {
    const registry = new CryptoProviderRegistry();
    registry.register(new NodeDigestCryptoProvider(), { default: true });
    registry.register({
      id: 'mock-digest',
      capabilities: ['digest'],
      digest: (data) => data,
    });

    expect(() => registry.register(new NodeDigestCryptoProvider())).toThrow('already registered');
    expect(registry.unregister('node-digest')).toBe(true);
    expect(registry.getDefault().id).toBe('mock-digest');
    expect(registry.unregister('missing')).toBe(false);
  });

  it('computes deterministic digests with the default node provider', async () => {
    const digest = await cryptoProviderRegistry
      .getDefault()
      .digest?.('SHA-256', new TextEncoder().encode('axionvera'));

    expect(Buffer.from(digest ?? []).toString('hex')).toBe(
      '03569add22a7aabcbf04be8f712c57f9ddf0407699a6c765f53bd76e0ef93170'
    );
  });
});
