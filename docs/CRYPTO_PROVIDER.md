# Crypto Provider Abstraction

`CryptoProviderRegistry` lets SDK integrations register interchangeable
cryptographic providers without changing SDK core code. Providers declare their
capabilities and implement only the operations they support.

```ts
import { CryptoProviderRegistry, NodeDigestCryptoProvider } from 'axionvera-sdk';

const registry = new CryptoProviderRegistry();

registry.register(new NodeDigestCryptoProvider(), { default: true });
registry.register({
  id: 'remote-signer',
  capabilities: ['sign', 'verify'],
  sign: (payload) => remoteSigner.sign(payload),
  verify: (payload, signature) => remoteSigner.verify(payload, signature),
});

const signer = registry.require('remote-signer');
```

## Capabilities

Providers can declare any combination of:

- `digest`
- `sign`
- `verify`

Validation ensures every declared capability has a matching method before the
provider is registered.

## Default Provider

`NodeDigestCryptoProvider` is registered as the shared default provider and uses
Node's `crypto` module for digest operations. It does not manage private keys and
does not implement wallet or hardware-signing behavior.

## Security Notes

Provider implementations own their key-handling policy. The SDK abstraction only
defines the contract for digest/sign/verify calls and registry selection.
Hardware wallets, secure enclaves, and private-key custody remain outside this
module.
