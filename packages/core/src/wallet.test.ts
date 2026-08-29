import { describe, it, expect, vi } from 'vitest';
import { ValidationError, WalletError } from './errors';
import {
  createTransactionSigningPipeline,
  MockWalletConnector,
  requestWalletSignature,
  signWithWallet,
  checkWalletReadiness,
  type WalletConnection,
  type WalletConnector,
  type WalletReadinessParams,
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
    it('returns false before connect is called', async () => {
      const connector = new MockWalletConnector();
      const result = await connector.isConnected();
      expect(result).toBe(false);
    });

    it('returns true after connect is called', async () => {
      const connector = new MockWalletConnector();
      await connector.connect();
      const result = await connector.isConnected();
      expect(result).toBe(true);
    });

    it('returns false after disconnect is called', async () => {
      const connector = new MockWalletConnector();
      await connector.connect();
      await connector.disconnect();
      const result = await connector.isConnected();
      expect(result).toBe(false);
    });

    it('returns true consistently across multiple calls when connected', async () => {
      const connector = new MockWalletConnector();
      await connector.connect();
      expect(await connector.isConnected()).toBe(true);
      expect(await connector.isConnected()).toBe(true);
    });

    it('returns false consistently across multiple calls when disconnected', async () => {
      const connector = new MockWalletConnector();
      expect(await connector.isConnected()).toBe(false);
      expect(await connector.isConnected()).toBe(false);
    });
  });

  describe('disconnect()', () => {
    it('disconnects a connected wallet', async () => {
      const connector = new MockWalletConnector();
      await connector.connect();
      expect(await connector.isConnected()).toBe(true);
      await connector.disconnect();
      expect(await connector.isConnected()).toBe(false);
    });

    it('can be called multiple times without error', async () => {
      const connector = new MockWalletConnector();
      await connector.connect();
      await connector.disconnect();
      await connector.disconnect();
      expect(await connector.isConnected()).toBe(false);
    });

    it('can be called on a disconnected wallet without error', async () => {
      const connector = new MockWalletConnector();
      await connector.disconnect();
      expect(await connector.isConnected()).toBe(false);
    });

    it('allows reconnection after disconnect', async () => {
      const connector = new MockWalletConnector();
      await connector.connect();
      await connector.disconnect();
      await connector.connect();
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

    it('returns the same public key after disconnect and reconnect', async () => {
      const connector = new MockWalletConnector();
      const first = await connector.connect();
      await connector.disconnect();
      const second = await connector.connect();
      expect(first.publicKey).toBe(second.publicKey);
      expect(second.publicKey).toBe('GAXIONVERAMOCKPUBLICKEY');
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

    it('preserves custom public key after disconnect and reconnect', async () => {
      const customKey = 'GCUSTOM7PUBLICKEYEXAMPLE123456789ABCDEFGHIJKLMNOPQRSTUV';
      const connector = new MockWalletConnector(customKey);
      const first = await connector.connect();
      await connector.disconnect();
      const second = await connector.connect();
      expect(first.publicKey).toBe(customKey);
      expect(second.publicKey).toBe(customKey);
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

    it('works when wallet is connected', async () => {
      const connector = new MockWalletConnector();
      await connector.connect();
      const xdr = 'AAAAAAAAAA==';
      const signed = await connector.signTransaction(xdr, {
        networkPassphrase: 'Test SDF Network ; September 2015',
      });
      expect(signed).toBe(`signed:${xdr}`);
    });

    it('works when wallet is disconnected (mock does not enforce connection state)', async () => {
      const connector = new MockWalletConnector();
      const xdr = 'AAAAAAAAAA==';
      const signed = await connector.signTransaction(xdr, {
        networkPassphrase: 'Test SDF Network ; September 2015',
      });
      expect(signed).toBe(`signed:${xdr}`);
    });

    it('uses custom signed prefix when provided', async () => {
      const connector = new MockWalletConnector('GTEST', 'custom:');
      const xdr = 'AAAAAAAAAA==';
      const signed = await connector.signTransaction(xdr, {
        networkPassphrase: 'Test SDF Network ; September 2015',
      });
      expect(signed).toBe(`custom:${xdr}`);
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
    ])('throws ValidationError when $field is missing', async ({ params }: { params: any }) => {
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

    it('wraps null rejection as WalletError', async () => {
      const wallet: WalletConnector = {
        id: 'test',
        name: 'Test Wallet',
        connect: async () => ({ publicKey: 'GTEST' }),
        signTransaction: vi.fn().mockRejectedValue(null)
      };

      await expect(
        signWithWallet({
          wallet,
          transactionXdr: TRANSACTION_XDR,
          networkPassphrase: TESTNET_PASSPHRASE
        })
      ).rejects.toThrow(WalletError);
    });

    it('wraps undefined rejection as WalletError', async () => {
      const wallet: WalletConnector = {
        id: 'test',
        name: 'Test Wallet',
        connect: async () => ({ publicKey: 'GTEST' }),
        signTransaction: vi.fn().mockRejectedValue(undefined)
      };

      await expect(
        signWithWallet({
          wallet,
          transactionXdr: TRANSACTION_XDR,
          networkPassphrase: TESTNET_PASSPHRASE
        })
      ).rejects.toThrow(WalletError);
    });

    it('preserves original error in WalletError cause', async () => {
      const originalError = new Error('user rejected transaction');
      const wallet: WalletConnector = {
        id: 'test',
        name: 'Test Wallet',
        connect: async () => ({ publicKey: 'GTEST' }),
        signTransaction: vi.fn().mockRejectedValue(originalError)
      };

      try {
        await signWithWallet({
          wallet,
          transactionXdr: TRANSACTION_XDR,
          networkPassphrase: TESTNET_PASSPHRASE
        });
        throw new Error('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(WalletError);
        expect((error as WalletError).cause).toBe(originalError);
      }
    });
  });
});

describe('requestWalletSignature', () => {
  it('signs a provider-generic unsigned request with MockWalletConnector', async () => {
    const wallet = new MockWalletConnector();
    const result = await requestWalletSignature({
      wallet,
      request: {
        unsignedXdr: TRANSACTION_XDR,
        networkPassphrase: TESTNET_PASSPHRASE,
      },
    });

    expect(result).toEqual({
      unsignedXdr: TRANSACTION_XDR,
      signedXdr: `signed:${TRANSACTION_XDR}`,
      networkPassphrase: TESTNET_PASSPHRASE,
      walletId: 'mock',
      walletName: 'Mock Wallet',
    });
  });

  it('passes accountToSign to the wallet connector', async () => {
    const wallet: WalletConnector = {
      id: 'test',
      name: 'Test Wallet',
      connect: async () => ({ publicKey: 'GTEST' }),
      signTransaction: vi.fn().mockResolvedValue('signed-xdr'),
    };

    await requestWalletSignature({
      wallet,
      request: {
        unsignedXdr: TRANSACTION_XDR,
        networkPassphrase: TESTNET_PASSPHRASE,
        accountToSign: 'GTEST',
      },
    });

    expect(wallet.signTransaction).toHaveBeenCalledWith(TRANSACTION_XDR, {
      networkPassphrase: TESTNET_PASSPHRASE,
      accountToSign: 'GTEST',
    });
  });

  it('preserves request metadata outside wallet provider options', async () => {
    const metadata = { source: 'unit-test' };
    const wallet: WalletConnector = {
      id: 'test',
      name: 'Test Wallet',
      connect: async () => ({ publicKey: 'GTEST' }),
      signTransaction: vi.fn().mockResolvedValue('signed-xdr'),
    };

    const result = await requestWalletSignature({
      wallet,
      request: {
        unsignedXdr: TRANSACTION_XDR,
        networkPassphrase: TESTNET_PASSPHRASE,
        metadata,
      },
    });

    expect(wallet.signTransaction).toHaveBeenCalledWith(TRANSACTION_XDR, {
      networkPassphrase: TESTNET_PASSPHRASE,
    });
    expect(result.metadata).toBe(metadata);
  });

  it('validates unsigned XDR before calling the wallet', async () => {
    const wallet: WalletConnector = {
      id: 'test',
      name: 'Test Wallet',
      connect: async () => ({ publicKey: 'GTEST' }),
      signTransaction: vi.fn().mockResolvedValue('signed-xdr'),
    };

    await expect(
      requestWalletSignature({
        wallet,
        request: {
          unsignedXdr: 'not-xdr',
          networkPassphrase: TESTNET_PASSPHRASE,
        },
      }),
    ).rejects.toThrow(ValidationError);

    expect(wallet.signTransaction).not.toHaveBeenCalled();
  });

  it('wraps wallet signing failures as WalletError', async () => {
    const wallet: WalletConnector = {
      id: 'test',
      name: 'Test Wallet',
      connect: async () => ({ publicKey: 'GTEST' }),
      signTransaction: vi.fn().mockRejectedValue(new Error('user rejected')),
    };

    await expect(
      requestWalletSignature({
        wallet,
        request: {
          unsignedXdr: TRANSACTION_XDR,
          networkPassphrase: TESTNET_PASSPHRASE,
        },
      }),
    ).rejects.toThrow(WalletError);
  });
});

describe('createTransactionSigningPipeline', () => {
  it('prepares and signs an unsigned transaction without provider-specific behavior', async () => {
    const wallet = new MockWalletConnector('GTEST');
    const pipeline = createTransactionSigningPipeline({
      wallet,
      prepareUnsignedTransaction: async ({ xdr }: { xdr: string }) => ({
        unsignedXdr: xdr,
        networkPassphrase: TESTNET_PASSPHRASE,
        accountToSign: 'GTEST',
      }),
    });

    const result = await pipeline.prepareAndSign({ xdr: TRANSACTION_XDR });

    expect(result).toMatchObject({
      unsignedXdr: TRANSACTION_XDR,
      signedXdr: `signed:${TRANSACTION_XDR}`,
      networkPassphrase: TESTNET_PASSPHRASE,
      accountToSign: 'GTEST',
      walletId: 'mock',
    });
  });

  it('exposes prepare and sign steps independently', async () => {
    const wallet = new MockWalletConnector();
    const pipeline = createTransactionSigningPipeline({
      wallet,
      prepareUnsignedTransaction: () => ({
        unsignedXdr: TRANSACTION_XDR,
        networkPassphrase: TESTNET_PASSPHRASE,
      }),
    });

    const prepared = await pipeline.prepare(undefined);
    const signed = await pipeline.sign(prepared);

    expect(prepared).toEqual({
      unsignedXdr: TRANSACTION_XDR,
      networkPassphrase: TESTNET_PASSPHRASE,
    });
    expect(signed.signedXdr).toBe(`signed:${TRANSACTION_XDR}`);
  });

  it('rejects invalid prepared unsigned XDR before signing', async () => {
    const wallet = new MockWalletConnector();
    const pipeline = createTransactionSigningPipeline({
      wallet,
      prepareUnsignedTransaction: () => ({
        unsignedXdr: 'not-xdr',
        networkPassphrase: TESTNET_PASSPHRASE,
      }),
    });

    await expect(pipeline.prepareAndSign(undefined)).rejects.toThrow(ValidationError);
  });

  it('surfaces wallet signing failure from the pipeline', async () => {
    const wallet: WalletConnector = {
      id: 'test',
      name: 'Test Wallet',
      connect: async () => ({ publicKey: 'GTEST' }),
      signTransaction: vi.fn().mockRejectedValue(new Error('signature declined')),
    };
    const pipeline = createTransactionSigningPipeline({
      wallet,
      prepareUnsignedTransaction: () => ({
        unsignedXdr: TRANSACTION_XDR,
        networkPassphrase: TESTNET_PASSPHRASE,
      }),
    });

    await expect(pipeline.prepareAndSign(undefined)).rejects.toThrow(WalletError);
  });
});

describe('checkWalletReadiness', () => {
  describe('happy path', () => {
    it('returns ready state for connected wallet with public key', () => {
      const connector = new MockWalletConnector('GTEST1234567890');
      const connection: WalletConnection = {
        publicKey: 'GTEST1234567890',
        network: 'testnet'
      };

      const result = checkWalletReadiness({ connector, connection });

      expect(result.isReady).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it('returns ready state when connection has only publicKey', () => {
      const connector = new MockWalletConnector('GTEST1234567890');
      const connection: WalletConnection = {
        publicKey: 'GTEST1234567890'
      };

      const result = checkWalletReadiness({ connector, connection });

      expect(result.isReady).toBe(true);
    });
  });

  describe('missing connector', () => {
    it('returns not-ready state when connector is null', () => {
      const result = checkWalletReadiness({ connector: null, connection: null });

      expect(result.isReady).toBe(false);
      expect(result.reason).toBe('Wallet connector is not available');
    });

    it('returns not-ready state when connector is undefined', () => {
      const result = checkWalletReadiness({ connector: undefined, connection: null });

      expect(result.isReady).toBe(false);
      expect(result.reason).toBe('Wallet connector is not available');
    });

    it('returns not-ready state when connector is not provided', () => {
      const params: WalletReadinessParams = {};
      const result = checkWalletReadiness(params);

      expect(result.isReady).toBe(false);
      expect(result.reason).toBe('Wallet connector is not available');
    });
  });

  describe('disconnected wallet', () => {
    it('returns not-ready state when connection is null', () => {
      const connector = new MockWalletConnector();
      const result = checkWalletReadiness({ connector, connection: null });

      expect(result.isReady).toBe(false);
      expect(result.reason).toBe('Wallet is not connected');
    });

    it('returns not-ready state when connection is undefined', () => {
      const connector = new MockWalletConnector();
      const result = checkWalletReadiness({ connector, connection: undefined });

      expect(result.isReady).toBe(false);
      expect(result.reason).toBe('Wallet is not connected');
    });

    it('returns not-ready state when connection is not provided', () => {
      const connector = new MockWalletConnector();
      const result = checkWalletReadiness({ connector });

      expect(result.isReady).toBe(false);
      expect(result.reason).toBe('Wallet is not connected');
    });
  });

  describe('missing public key', () => {
    it('returns not-ready state when publicKey is missing', () => {
      const connector = new MockWalletConnector();
      const connection: WalletConnection = {
        publicKey: '',
        network: 'testnet'
      };

      const result = checkWalletReadiness({ connector, connection });

      expect(result.isReady).toBe(false);
      expect(result.reason).toBe('Wallet public key is not available');
    });

    it('returns not-ready state when publicKey is whitespace only', () => {
      const connector = new MockWalletConnector();
      const connection: WalletConnection = {
        publicKey: '   ',
        network: 'testnet'
      };

      const result = checkWalletReadiness({ connector, connection });

      expect(result.isReady).toBe(false);
      expect(result.reason).toBe('Wallet public key is not available');
    });

    it('returns not-ready state when publicKey is null', () => {
      const connector = new MockWalletConnector();
      const connection = { publicKey: null as any, network: 'testnet' };

      const result = checkWalletReadiness({ connector, connection });

      expect(result.isReady).toBe(false);
      expect(result.reason).toBe('Wallet public key is not available');
    });

    it('returns not-ready state when publicKey is undefined', () => {
      const connector = new MockWalletConnector();
      const connection = { publicKey: undefined as any, network: 'testnet' };

      const result = checkWalletReadiness({ connector, connection });

      expect(result.isReady).toBe(false);
      expect(result.reason).toBe('Wallet public key is not available');
    });
  });

  describe('error representation', () => {
    it('provides consistent error messages for each failure mode', () => {
      const connector = new MockWalletConnector();

      const missingConnector = checkWalletReadiness({ connector: null, connection: null });
      const missingConnection = checkWalletReadiness({ connector, connection: null });
      const missingPublicKey = checkWalletReadiness({ connector, connection: { publicKey: '' } });

      expect(missingConnector.reason).toBe('Wallet connector is not available');
      expect(missingConnection.reason).toBe('Wallet is not connected');
      expect(missingPublicKey.reason).toBe('Wallet public key is not available');
    });

    it('does not include reason when wallet is ready', () => {
      const connector = new MockWalletConnector('GTEST');
      const connection: WalletConnection = { publicKey: 'GTEST' };

      const result = checkWalletReadiness({ connector, connection });

      expect(result.isReady).toBe(true);
      expect('reason' in result).toBe(false);
    });
  });
});

describe('wallet connector failure scenarios', () => {
  it('handles connect() rejection', async () => {
    const wallet: WalletConnector = {
      id: 'test',
      name: 'Test Wallet',
      connect: vi.fn().mockRejectedValue(new Error('user rejected connection')),
      signTransaction: vi.fn().mockResolvedValue('signed-xdr')
    };

    await expect(wallet.connect()).rejects.toThrow('user rejected connection');
  });

  it('handles disconnect() rejection', async () => {
    const wallet: WalletConnector = {
      id: 'test',
      name: 'Test Wallet',
      connect: async () => ({ publicKey: 'GTEST' }),
      disconnect: vi.fn().mockRejectedValue(new Error('disconnect failed')),
      signTransaction: vi.fn().mockResolvedValue('signed-xdr')
    };

    await expect(wallet.disconnect?.()).rejects.toThrow('disconnect failed');
  });

  it('handles isConnected() rejection', async () => {
    const wallet: WalletConnector = {
      id: 'test',
      name: 'Test Wallet',
      connect: async () => ({ publicKey: 'GTEST' }),
      isConnected: vi.fn().mockRejectedValue(new Error('connection check failed')),
      signTransaction: vi.fn().mockResolvedValue('signed-xdr')
    };

    await expect(wallet.isConnected?.()).rejects.toThrow('connection check failed');
  });

  it('handles wallet with missing optional disconnect method', async () => {
    const wallet: WalletConnector = {
      id: 'test',
      name: 'Test Wallet',
      connect: async () => ({ publicKey: 'GTEST' }),
      signTransaction: vi.fn().mockResolvedValue('signed-xdr')
    };

    // Should not throw when disconnect is not implemented
    expect(wallet.disconnect).toBeUndefined();
  });

  it('handles wallet with missing optional isConnected method', async () => {
    const wallet: WalletConnector = {
      id: 'test',
      name: 'Test Wallet',
      connect: async () => ({ publicKey: 'GTEST' }),
      signTransaction: vi.fn().mockResolvedValue('signed-xdr')
    };

    // Should not throw when isConnected is not implemented
    expect(wallet.isConnected).toBeUndefined();
  });

  it('handles signTransaction timeout scenario', async () => {
    const wallet: WalletConnector = {
      id: 'test',
      name: 'Test Wallet',
      connect: async () => ({ publicKey: 'GTEST' }),
      signTransaction: vi.fn().mockImplementation(() => 
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('signing timeout')), 10)
        )
      )
    };

    await expect(
      signWithWallet({
        wallet,
        transactionXdr: TRANSACTION_XDR,
        networkPassphrase: TESTNET_PASSPHRASE
      })
    ).rejects.toThrow(WalletError);
  });

  it('handles wallet that throws on signTransaction with specific error message', async () => {
    const wallet: WalletConnector = {
      id: 'test',
      name: 'Test Wallet',
      connect: async () => ({ publicKey: 'GTEST' }),
      signTransaction: vi.fn().mockRejectedValue(new Error('Transaction rejected by user'))
    };

    await expect(
      signWithWallet({
        wallet,
        transactionXdr: TRANSACTION_XDR,
        networkPassphrase: TESTNET_PASSPHRASE
      })
    ).rejects.toThrow('Transaction rejected by user');
  });

  it('handles wallet that returns invalid signed XDR (empty string)', async () => {
    const wallet: WalletConnector = {
      id: 'test',
      name: 'Test Wallet',
      connect: async () => ({ publicKey: 'GTEST' }),
      signTransaction: vi.fn().mockResolvedValue('')
    };

    // signWithWallet does not validate the returned signed XDR, it just passes through
    const result = await signWithWallet({
      wallet,
      transactionXdr: TRANSACTION_XDR,
      networkPassphrase: TESTNET_PASSPHRASE
    });
    expect(result).toBe('');
  });

  it('handles wallet that returns null as signed XDR', async () => {
    const wallet: WalletConnector = {
      id: 'test',
      name: 'Test Wallet',
      connect: async () => ({ publicKey: 'GTEST' }),
      signTransaction: vi.fn().mockResolvedValue(null as any)
    };

    // signWithWallet does not validate the returned signed XDR type
    const result = await signWithWallet({
      wallet,
      transactionXdr: TRANSACTION_XDR,
      networkPassphrase: TESTNET_PASSPHRASE
    });
    expect(result).toBeNull();
  });
});
