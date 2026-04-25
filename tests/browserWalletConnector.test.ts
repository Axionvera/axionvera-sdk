import { BrowserWalletConnector } from '../src/wallet/browserWalletConnector';
import { WalletNotInstalledError } from '../src/errors/axionveraError';

const freighterApiMock = {
  getPublicKey: jest.fn().mockResolvedValue('GTEST_PUBLIC_KEY'),
  signTransaction: jest.fn().mockResolvedValue('signed-xdr')
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
});
