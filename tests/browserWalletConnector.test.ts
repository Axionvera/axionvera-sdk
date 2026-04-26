import { BrowserWalletConnector } from '../src/wallet/browserWalletConnector';
import { WalletNotInstalledError } from '../src/errors/axionveraError';

const freighterApiMock = {
  getPublicKey: jest.fn().mockResolvedValue('GTEST_PUBLIC_KEY'),
  signTransaction: jest.fn().mockResolvedValue('signed-xdr'),
  getNetwork: jest.fn().mockResolvedValue('TESTNET')
};

jest.mock('@stellar/freighter-api', () => freighterApiMock, { virtual: true });

describe('BrowserWalletConnector', () => {
  let originalWindow: unknown;

  beforeAll(() => {
    originalWindow = (global as any).window;
    (global as any).window = {} as Window;
  });

  afterAll(() => {
    if (originalWindow !== undefined) {
      (global as any).window = originalWindow;
    } else {
      delete (global as any).window;
    }
  });

  afterEach(() => {
    jest.clearAllMocks();
    (global as any).window = {} as Window;
  });

  it('calls freighter.getPublicKey()', async () => {
    const connector = new BrowserWalletConnector();
    const publicKey = await connector.getPublicKey();

    expect(publicKey).toBe('GTEST_PUBLIC_KEY');
    expect(freighterApiMock.getPublicKey).toHaveBeenCalledTimes(1);
  });

  it('calls freighter.signTransaction()', async () => {
    const connector = new BrowserWalletConnector();
    const signedXdr = await connector.signTransaction('tx-xdr', 'Test SDF Network ; September 2015');

    expect(signedXdr).toBe('signed-xdr');
    expect(freighterApiMock.signTransaction).toHaveBeenCalledWith('tx-xdr', 'Test SDF Network ; September 2015');
  });

  it('throws WalletNotInstalledError when no browser environment is available', async () => {
    delete (global as any).window;

    const connector = new BrowserWalletConnector();
    await expect(connector.getPublicKey()).rejects.toThrow(WalletNotInstalledError);
  });

  describe('getNetwork', () => {
    it('maps Freighter TESTNET to SDK testnet', async () => {
      freighterApiMock.getNetwork.mockResolvedValue('TESTNET');
      const connector = new BrowserWalletConnector();
      const network = await connector.getNetwork();

      expect(network).toBe('testnet');
      expect(freighterApiMock.getNetwork).toHaveBeenCalledTimes(1);
    });

    it('maps Freighter PUBLIC to SDK mainnet', async () => {
      freighterApiMock.getNetwork.mockResolvedValue('PUBLIC');
      const connector = new BrowserWalletConnector();
      const network = await connector.getNetwork();

      expect(network).toBe('mainnet');
      expect(freighterApiMock.getNetwork).toHaveBeenCalledTimes(1);
    });

    it('maps Freighter FUTURENET to SDK futurenet', async () => {
      freighterApiMock.getNetwork.mockResolvedValue('FUTURENET');
      const connector = new BrowserWalletConnector();
      const network = await connector.getNetwork();

      expect(network).toBe('futurenet');
      expect(freighterApiMock.getNetwork).toHaveBeenCalledTimes(1);
    });

    it('defaults to testnet for unknown Freighter network', async () => {
      freighterApiMock.getNetwork.mockResolvedValue('UNKNOWN_NETWORK');
      const connector = new BrowserWalletConnector();
      const network = await connector.getNetwork();

      expect(network).toBe('testnet');
    });

    it('is case-insensitive', async () => {
      freighterApiMock.getNetwork.mockResolvedValue('public');
      const connector = new BrowserWalletConnector();
      const network = await connector.getNetwork();

      expect(network).toBe('mainnet');
    });

    it('throws WalletNotInstalledError when no browser environment is available', async () => {
      delete (global as any).window;

      const connector = new BrowserWalletConnector();
      await expect(connector.getNetwork()).rejects.toThrow(WalletNotInstalledError);
    });
  });
});
