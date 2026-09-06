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
- `signedResultToTransactionSubmissionRequest(result)` converts a signed
  pipeline result into the existing `TransactionSubmissionRequest` shape.

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

After signing, convert the result to the existing submission request shape:

```ts
import { signedResultToTransactionSubmissionRequest } from '@axionvera/core';

const submission = signedResultToTransactionSubmissionRequest(signed);
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

## Wallet Provider Contract

Any wallet provider that implements the `WalletConnector` interface must satisfy
the provider-generic contract tests. These tests ensure compatibility with the
SDK's signing pipeline without requiring provider-specific code.

### Required Interface

```ts
interface WalletConnector {
  id: string;
  name: string;
  connect(): Promise<WalletConnection>;
  signTransaction(transactionXdr: string, options: SignTransactionOptions): Promise<string>;
  disconnect?(): Promise<void>;
  isConnected?(): Promise<boolean>;
}
```

### Contract Tests

The contract tests verify:

1. **Interface compliance**: `id`, `name`, `connect()`, and `signTransaction()` are required
2. **connect() behavior**: Returns `WalletConnection` with non-empty `publicKey`
3. **disconnect() behavior**: Can be called multiple times without error
4. **isConnected() behavior**: Returns boolean when implemented
5. **signTransaction() behavior**: Returns signed XDR string, receives correct parameters
6. **Error handling**: Throws on user rejection, preserves error types
7. **SDK integration**: Works with `signWithWallet`, `requestWalletSignature`, and `createTransactionSigningPipeline`

### Implementing a New Wallet Provider

To add a new wallet provider:

1. Implement the `WalletConnector` interface
2. Run the contract tests against your implementation
3. Ensure all tests pass without mocking the provider

```ts
import { type WalletConnector, type WalletConnection } from '@axionvera/core';

class MyWalletConnector implements WalletConnector {
  readonly id = 'my-wallet';
  readonly name = 'My Wallet';

  async connect(): Promise<WalletConnection> {
    // Connect to wallet and return public key
    return { publicKey: 'G...', network: 'testnet' };
  }

  async signTransaction(xdr: string, options: SignTransactionOptions): Promise<string> {
    // Sign transaction and return signed XDR
    return signedXdr;
  }

  async disconnect(): Promise<void> {
    // Disconnect from wallet
  }

  async isConnected(): Promise<boolean> {
    // Check connection status
    return connected;
  }
}
```
