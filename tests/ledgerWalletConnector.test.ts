import { LedgerWalletConnector } from '../packages/core/src/wallet/ledgerWalletConnector';

describe('LedgerWalletConnector', () => {
  describe('constructor and getNetwork', () => {
    it('defaults to mainnet network and default BIP32 path', async () => {
      const connector = new LedgerWalletConnector();
      await expect(connector.getNetwork()).resolves.toBe('mainnet');
    });

    it('returns custom configured network', async () => {
      const testnetConnector = new LedgerWalletConnector("44'/148'/0'", 'testnet');
      await expect(testnetConnector.getNetwork()).resolves.toBe('testnet');

      const futurenetConnector = new LedgerWalletConnector("44'/148'/1'", 'futurenet');
      await expect(futurenetConnector.getNetwork()).resolves.toBe('futurenet');
    });
  });
});
