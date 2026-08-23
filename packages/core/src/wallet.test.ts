import { describe, it, expect, vi } from 'vitest';
import { ValidationError, WalletError } from './errors';
import {
  MockWalletConnector,
  signWithWallet,
  type WalletConnection,
  type WalletConnector,
} from './wallet';

const TESTNET_PASSPHRASE = 'Test SDF Network ; September 2015';
const TRANSACTION_XDR = 'AAAAAAAAAA==';

describe('MockWalletConnector', () => {
  describe('static identity', () => {
    it('has id "mock"', () => {
      const connector = new MockWalletConnector();
      expect(connector.id).toBe('mock');
    });

    it('has name "Mock Wallet"', () => {
      const connector = new MockWalletConnector();
      expect(connector.name).toBe('Mock Wallet');
    });

    it('satisfies the WalletConnector interface', () => {
      // Compile-time check: assignment would fail if the contract is not met.
      const connector: WalletConnector = new MockWalletConnector();
      expect(connector).toBeDefined();
    });
  });

  describe('connect()', () => {
    it('returns a WalletConnection object', async () => {
      const connector = new MockWalletConnector();
      const connection = await connector.connect();
      expect(connection).toBeTypeOf('object');
      expect(connection).not.toBeNull();
    });

    it('returns a connection whose publicKey matches the default public key', async () => {
      const connector = new MockWalletConnector();
      const connection = await connector.connect();
      expect(connection.publicKey).toBe('GAXIONVERAMOCKPUBLICKEY');
    });

    it('returns a connection with network set to "testnet"', async () => {
      const connector = new MockWalletConnector();
      const connection = await connector.connect();
      expect(connection.network).toBe('testnet');
    });

    it('returns a new connection object on each call', async () => {
      const connector = new MockWalletConnector();
      const first = await connector.connect();
      const second = await connector.connect();
      // Each call produces a fresh object with consistent values.
      expect(first).not.toBe(second);
      expect(first.publicKey).toBe(second.publicKey);
    });
  });

  describe('isConnected()', () => {
    it('returns true', async () => {
      const connector = new MockWalletConnector();
      const result = await connector.isConnected();
      expect(result).toBe(true);
    });

    it('returns true consistently across multiple calls', async () => {
      const connector = new MockWalletConnector();
      expect(await connector.isConnected()).toBe(true);
      expect(await connector.isConnected()).toBe(true);
    });
  });

  describe('default public key', () => {
    it('uses "GAXIONVERAMOCKPUBLICKEY" when no public key is supplied', async () => {
      const connector = new MockWalletConnector();
      const connection = await connector.connect();
      expect(connection.publicKey).toBe('GAXIONVERAMOCKPUBLICKEY');
    });

    it('exposes the default public key through the connection, not a separate property', async () => {
      const connector = new MockWalletConnector();
      const connection: WalletConnection = await connector.connect();
      expect(connection.publicKey).toBe('GAXIONVERAMOCKPUBLICKEY');
    });
  });

  describe('custom public key', () => {
    it('uses the supplied public key in the connection', async () => {
      const customKey = 'GCUSTOM7PUBLICKEYEXAMPLE123456789ABCDEFGHIJKLMNOPQRSTUV';
      const connector = new MockWalletConnector(customKey);
      const connection = await connector.connect();
      expect(connection.publicKey).toBe(customKey);
    });

    it('preserves the custom public key across multiple connect() calls', async () => {
      const customKey = 'GCUSTOM7PUBLICKEYEXAMPLE123456789ABCDEFGHIJKLMNOPQRSTUV';
      const connector = new MockWalletConnector(customKey);
      const first = await connector.connect();
      const second = await connector.connect();
      expect(first.publicKey).toBe(customKey);
      expect(second.publicKey).toBe(customKey);
    });

    it('does not share state between two instances with different keys', async () => {
      const keyA = 'GKEYA7PUBLICKEYEXAMPLE123456789ABCDEFGHIJKLMNOPQRSTUVWXY';
      const keyB = 'GKEYB7PUBLICKEYEXAMPLE123456789ABCDEFGHIJKLMNOPQRSTUVWXY';
      const connectorA = new MockWalletConnector(keyA);
      const connectorB = new MockWalletConnector(keyB);
      const [connA, connB] = await Promise.all([connectorA.connect(), connectorB.connect()]);
      expect(connA.publicKey).toBe(keyA);
      expect(connB.publicKey).toBe(keyB);
    });
  });

  describe('signTransaction()', () => {
    it('returns the transaction XDR prefixed with "signed:"', async () => {
      const connector = new MockWalletConnector();
      const xdr = 'AAAAAAAAAA==';
      const signed = await connector.signTransaction(xdr, {
        networkPassphrase: 'Test SDF Network ; September 2015',
      });
      expect(signed).toBe(`signed:${xdr}`);
    });

    it('preserves the full transaction XDR in the returned value', async () => {
      const connector = new MockWalletConnector();
      const xdr =
        'AAAAAgAAAABBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBAAAAZAAAAAAAAAABAAAAAAAAAAAAAAABAAAAAAAAAAAAAAAA';
      const signed = await connector.signTransaction(xdr, {
        networkPassphrase: 'Public Global Stellar Network ; September 2015',
      });
      expect(signed).toContain(xdr);
      expect(signed).toBe(`signed:${xdr}`);
    });

    it('produces different output for different input XDRs', async () => {
      const connector = new MockWalletConnector();
      const opts = { networkPassphrase: 'Test SDF Network ; September 2015' };
      const signedA = await connector.signTransaction('TX_A', opts);
      const signedB = await connector.signTransaction('TX_B', opts);
      expect(signedA).not.toBe(signedB);
      expect(signedA).toBe('signed:TX_A');
      expect(signedB).toBe('signed:TX_B');
    });

    it('signing is deterministic: same input always yields same output', async () => {
      const connector = new MockWalletConnector();
      const xdr = 'AAAAAAAAAA==';
      const opts = { networkPassphrase: 'Test SDF Network ; September 2015' };
      const first = await connector.signTransaction(xdr, opts);
      const second = await connector.signTransaction(xdr, opts);
      expect(first).toBe(second);
    });

    it('accepts an optional accountToSign without affecting the signed output', async () => {
      const connector = new MockWalletConnector();
      const xdr = 'AAAAAAAAAA==';
      const withAccount = await connector.signTransaction(xdr, {
        networkPassphrase: 'Test SDF Network ; September 2015',
        accountToSign: 'GAXIONVERAMOCKPUBLICKEY',
      });
      const withoutAccount = await connector.signTransaction(xdr, {
        networkPassphrase: 'Test SDF Network ; September 2015',
      });
      // The mock does not use options — output depends only on the XDR.
      expect(withAccount).toBe(`signed:${xdr}`);
      expect(withoutAccount).toBe(`signed:${xdr}`);
    });
  });
});

describe('signWithWallet', () => {
  it('calls wallet.signTransaction with the transaction XDR and network passphrase', async () => {
    const wallet: WalletConnector = {
      id: 'test',
      name: 'Test Wallet',
      connect: async () => ({ publicKey: 'GTEST' }),
      signTransaction: vi.fn().mockResolvedValue('signed-xdr')
    };

    const signed = await signWithWallet({
      wallet,
      transactionXdr: TRANSACTION_XDR,
      networkPassphrase: TESTNET_PASSPHRASE
    });

    expect(wallet.signTransaction).toHaveBeenCalledOnce();
    expect(wallet.signTransaction).toHaveBeenCalledWith(TRANSACTION_XDR, {
      networkPassphrase: TESTNET_PASSPHRASE
    });
    expect(signed).toBe('signed-xdr');
  });

  it('passes accountToSign through when provided', async () => {
    const account = 'GAXIONVERAMOCKPUBLICKEY';
    const wallet: WalletConnector = {
      id: 'test',
      name: 'Test Wallet',
      connect: async () => ({ publicKey: account }),
      signTransaction: vi.fn().mockResolvedValue('signed-xdr')
    };

    await signWithWallet({
      wallet,
      transactionXdr: TRANSACTION_XDR,
      networkPassphrase: TESTNET_PASSPHRASE,
      accountToSign: account
    });

    expect(wallet.signTransaction).toHaveBeenCalledWith(TRANSACTION_XDR, {
      networkPassphrase: TESTNET_PASSPHRASE,
      accountToSign: account
    });
  });

  it('trims transaction XDR and network passphrase before signing', async () => {
    const wallet: WalletConnector = {
      id: 'test',
      name: 'Test Wallet',
      connect: async () => ({ publicKey: 'GTEST' }),
      signTransaction: vi.fn().mockResolvedValue('signed-xdr')
    };

    await signWithWallet({
      wallet,
      transactionXdr: `  ${TRANSACTION_XDR}  `,
      networkPassphrase: `  ${TESTNET_PASSPHRASE}  `
    });

    expect(wallet.signTransaction).toHaveBeenCalledWith(TRANSACTION_XDR, {
      networkPassphrase: TESTNET_PASSPHRASE
    });
  });

  it('works with MockWalletConnector', async () => {
    const wallet = new MockWalletConnector();

    const signed = await signWithWallet({
      wallet,
      transactionXdr: TRANSACTION_XDR,
      networkPassphrase: TESTNET_PASSPHRASE
    });

    expect(signed).toBe(`signed:${TRANSACTION_XDR}`);
  });

  describe('validation', () => {
    const wallet: WalletConnector = {
      id: 'test',
      name: 'Test Wallet',
      connect: async () => ({ publicKey: 'GTEST' }),
      signTransaction: vi.fn()
    };

    it.each([
      { field: 'transaction XDR', params: { transactionXdr: '', networkPassphrase: TESTNET_PASSPHRASE } },
      { field: 'transaction XDR', params: { transactionXdr: '   ', networkPassphrase: TESTNET_PASSPHRASE } },
      { field: 'networkPassphrase', params: { transactionXdr: TRANSACTION_XDR, networkPassphrase: '' } },
      { field: 'networkPassphrase', params: { transactionXdr: TRANSACTION_XDR, networkPassphrase: '   ' } }
    ])('throws ValidationError when $field is missing', async ({ params }) => {
      await expect(signWithWallet({ wallet, ...params })).rejects.toThrow(ValidationError);
      expect(wallet.signTransaction).not.toHaveBeenCalled();
    });

    it('throws ValidationError when wallet is missing', async () => {
      await expect(
        signWithWallet({
          wallet: null as unknown as WalletConnector,
          transactionXdr: TRANSACTION_XDR,
          networkPassphrase: TESTNET_PASSPHRASE
        })
      ).rejects.toThrow(ValidationError);
    });

    it('throws ValidationError when accountToSign is empty', async () => {
      await expect(
        signWithWallet({
          wallet,
          transactionXdr: TRANSACTION_XDR,
          networkPassphrase: TESTNET_PASSPHRASE,
          accountToSign: '   '
        })
      ).rejects.toThrow(ValidationError);

      expect(wallet.signTransaction).not.toHaveBeenCalled();
    });
  });

  describe('error handling', () => {
    it('wraps generic wallet failures as WalletError', async () => {
      const wallet: WalletConnector = {
        id: 'test',
        name: 'Test Wallet',
        connect: async () => ({ publicKey: 'GTEST' }),
        signTransaction: vi.fn().mockRejectedValue(new Error('user rejected'))
      };

      await expect(
        signWithWallet({
          wallet,
          transactionXdr: TRANSACTION_XDR,
          networkPassphrase: TESTNET_PASSPHRASE
        })
      ).rejects.toThrow(WalletError);

      await expect(
        signWithWallet({
          wallet,
          transactionXdr: TRANSACTION_XDR,
          networkPassphrase: TESTNET_PASSPHRASE
        })
      ).rejects.toThrow('user rejected');
    });

    it('rethrows WalletError from the connector unchanged', async () => {
      const walletError = new WalletError('connector wallet error');
      const wallet: WalletConnector = {
        id: 'test',
        name: 'Test Wallet',
        connect: async () => ({ publicKey: 'GTEST' }),
        signTransaction: vi.fn().mockRejectedValue(walletError)
      };

      await expect(
        signWithWallet({
          wallet,
          transactionXdr: TRANSACTION_XDR,
          networkPassphrase: TESTNET_PASSPHRASE
        })
      ).rejects.toBe(walletError);
    });

    it('rethrows ValidationError from the connector unchanged', async () => {
      const validationError = new ValidationError('invalid signing request');
      const wallet: WalletConnector = {
        id: 'test',
        name: 'Test Wallet',
        connect: async () => ({ publicKey: 'GTEST' }),
        signTransaction: vi.fn().mockRejectedValue(validationError)
      };

      await expect(
        signWithWallet({
          wallet,
          transactionXdr: TRANSACTION_XDR,
          networkPassphrase: TESTNET_PASSPHRASE
        })
      ).rejects.toBe(validationError);
    });

    it('wraps non-Error rejections as WalletError', async () => {
      const wallet: WalletConnector = {
        id: 'test',
        name: 'Test Wallet',
        connect: async () => ({ publicKey: 'GTEST' }),
        signTransaction: vi.fn().mockRejectedValue('string failure')
      };

      await expect(
        signWithWallet({
          wallet,
          transactionXdr: TRANSACTION_XDR,
          networkPassphrase: TESTNET_PASSPHRASE
        })
      ).rejects.toThrow(WalletError);
    });
  });
});
