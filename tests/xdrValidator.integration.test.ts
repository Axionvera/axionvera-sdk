import { xdr, Keypair } from '@stellar/stellar-sdk';
import { StellarClient } from '../src/client/stellarClient';
import { LocalKeypairWalletConnector } from '../src/wallet/walletConnector';
import { InvalidXDRError } from '../src/errors/axionveraError';
import { MAX_XDR_STRING_LENGTH } from '../src/utils/xdrValidator';

// ---------------------------------------------------------------------------
// StellarClient.parseTransactionXdr integration
// ---------------------------------------------------------------------------

describe('StellarClient.parseTransactionXdr() – XDR sanitization', () => {
  const passphrase = 'Test SDF Network ; September 2015';

  test('throws InvalidXDRError for an empty string', () => {
    expect(() => StellarClient.parseTransactionXdr('', passphrase)).toThrow(InvalidXDRError);
  });

  test('throws InvalidXDRError for a non-base64 string', () => {
    expect(() =>
      StellarClient.parseTransactionXdr('<script>alert(1)</script>', passphrase)
    ).toThrow(InvalidXDRError);
  });

  test('throws InvalidXDRError for an oversized payload', () => {
    const oversized = 'A'.repeat(MAX_XDR_STRING_LENGTH + 1);
    expect(() => StellarClient.parseTransactionXdr(oversized, passphrase)).toThrow(
      InvalidXDRError
    );
    expect(() => StellarClient.parseTransactionXdr(oversized, passphrase)).toThrow(
      /exceeds the maximum allowed length/
    );
  });

  test('throws InvalidXDRError (not a raw sdk error) for valid-base64 but bad transaction XDR', () => {
    // Valid base64, but not a valid Transaction envelope
    const validBase64NotTx = 'AAAAAAAAAA==';
    expect(() =>
      StellarClient.parseTransactionXdr(validBase64NotTx, passphrase)
    ).toThrow(InvalidXDRError);
  });
});

// ---------------------------------------------------------------------------
// LocalKeypairWalletConnector integration
// ---------------------------------------------------------------------------

describe('LocalKeypairWalletConnector.signTransaction() – XDR sanitization', () => {
  const passphrase = 'Test SDF Network ; September 2015';
  const keypair = Keypair.random();
  const connector = new LocalKeypairWalletConnector(keypair);

  test('throws InvalidXDRError for an empty string', () => {
    return expect(connector.signTransaction('', passphrase)).rejects.toThrow(InvalidXDRError);
  });

  test('throws InvalidXDRError for a non-base64 string', () => {
    return expect(connector.signTransaction('not-valid!!', passphrase)).rejects.toThrow(
      InvalidXDRError
    );
  });

  test('throws InvalidXDRError for an oversized payload', () => {
    const oversized = 'A'.repeat(MAX_XDR_STRING_LENGTH + 1);
    return expect(connector.signTransaction(oversized, passphrase)).rejects.toThrow(
      InvalidXDRError
    );
  });

  test('throws InvalidXDRError for valid-base64 but bad transaction XDR', () => {
    const validBase64NotTx = 'AAAAAAAAAA==';
    return expect(connector.signTransaction(validBase64NotTx, passphrase)).rejects.toThrow(
      InvalidXDRError
    );
  });
});
