import { Keypair, Networks, TransactionBuilder, Operation, BASE_FEE } from '@stellar/stellar-sdk';
import { MockWalletConnector } from '../src/wallet/mockWalletConnector';

describe('MockWalletConnector', () => {
  it('returns the public key for a Keypair input', async () => {
    const keypair = Keypair.random();
    const connector = new MockWalletConnector(keypair);
    await expect(connector.getPublicKey()).resolves.toBe(keypair.publicKey());
  });

  it('accepts a secret key input', async () => {
    const keypair = Keypair.random();
    const connector = new MockWalletConnector(keypair.secret());
    await expect(connector.getPublicKey()).resolves.toBe(keypair.publicKey());
  });

  it('signs a transaction XDR silently', async () => {
    const keypair = Keypair.random();
    const connector = new MockWalletConnector(keypair);

    const source = keypair.publicKey();
    const account = { accountId: () => source, sequenceNumber: () => '1', incrementSequenceNumber: () => {} } as any;

    const tx = new TransactionBuilder(account, {
      fee: BASE_FEE,
      networkPassphrase: Networks.TESTNET
    })
      .addOperation(Operation.bumpSequence({ bumpTo: '2' }))
      .setTimeout(30)
      .build();

    const signedXdr = await connector.signTransaction(tx.toXDR(), Networks.TESTNET);
    expect(signedXdr).toBeTruthy();
  });

  describe('getNetwork', () => {
    it('defaults to testnet', async () => {
      const keypair = Keypair.random();
      const connector = new MockWalletConnector(keypair);
      await expect(connector.getNetwork()).resolves.toBe('testnet');
    });

    it('returns custom configured network', async () => {
      const keypair = Keypair.random();
      const connector = new MockWalletConnector(keypair, 'mainnet');
      await expect(connector.getNetwork()).resolves.toBe('mainnet');

      const futurenetConnector = new MockWalletConnector(keypair.secret(), 'futurenet');
      await expect(futurenetConnector.getNetwork()).resolves.toBe('futurenet');
    });
  });
});

