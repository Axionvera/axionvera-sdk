# Transaction Signing Pipeline

The transaction signing pipeline separates two responsibilities:

- Preparing unsigned Stellar/Soroban transaction XDR.
- Asking a wallet connector to sign that XDR.

The core SDK does not include provider-specific wallet behavior in this layer.
It only depends on the `WalletConnector` interface, so the same flow works with
`MockWalletConnector`, a browser extension connector, a backend signer, or a
test double.

## Helpers

- `validateUnsignedTransactionXdr(unsignedXdr)` validates that the input is a
  non-empty base64 XDR string.
- `prepareUnsignedTransactionSigningRequest(input)` normalizes unsigned XDR,
  network passphrase, optional signing account, and metadata.
- `requestWalletSignature({ wallet, request })` signs an already prepared
  request with any `WalletConnector`.
- `createTransactionSigningPipeline({ wallet, prepareUnsignedTransaction })`
  wires preparation and signing into one reusable object.

## Example

```ts
import {
  MockWalletConnector,
  createTransactionSigningPipeline
} from '@axionvera/core';

const wallet = new MockWalletConnector('GAXIONVERAMOCKPUBLICKEY');
await wallet.connect();

const pipeline = createTransactionSigningPipeline({
  wallet,
  async prepareUnsignedTransaction() {
    return {
      unsignedXdr: 'AAAAAAAAAA==',
      networkPassphrase: 'Test SDF Network ; September 2015',
      accountToSign: 'GAXIONVERAMOCKPUBLICKEY',
      metadata: {
        action: 'deposit'
      }
    };
  }
});

const signed = await pipeline.prepareAndSign(undefined);
console.log(signed.signedXdr);
```

## Provider-Generic Behavior

The pipeline never imports or configures a wallet extension. It passes only the
fields required by the `WalletConnector.signTransaction()` contract:

- unsigned transaction XDR
- network passphrase
- optional account to sign

Application metadata remains on the SDK result for tracing, logging, or
submission orchestration. It is not forwarded as provider-specific options.

Wallet failures are normalized through `WalletError`, while invalid unsigned XDR
or malformed signing requests fail with `ValidationError` before the wallet is
called.

## Testing

The unit tests use `MockWalletConnector`, so no real wallet extension, browser
permission, or secret key is required. The covered cases include:

- unsigned XDR input validation
- successful wallet signing
- wallet signing failure
- independent prepare and sign phases
