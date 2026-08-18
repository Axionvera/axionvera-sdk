import { LocalKeypairWalletConnector } from '../src/wallet/localKeypairWalletConnector';
import { Keypair, TransactionBuilder } from '@stellar/stellar-sdk';

describe('LocalKeypairWalletConnector', () => {
  let keypair: Keypair;

  beforeEach(() => {
    keypair = Keypair.random();
  });

  describe('constructor', () => {
    it('should initialize with a keypair and default to testnet', () => {
      const connector = new LocalKeypairWalletConnector(keypair);
      expect(connector).toBeDefined();
    });

    it('should initialize with a keypair and testnet network', () => {
      const connector = new LocalKeypairWalletConnector(keypair, 'testnet');
      expect(connector).toBeDefined();
    });

    it('should initialize with a keypair and mainnet network', () => {
      const connector = new LocalKeypairWalletConnector(keypair, 'mainnet');
      expect(connector).toBeDefined();
    });

    it('should initialize with a keypair and futurenet network', () => {
      const connector = new LocalKeypairWalletConnector(keypair, 'futurenet');
      expect(connector).toBeDefined();
    });
  });

  describe('getPublicKey', () => {
    it('should return the public key of the keypair', async () => {
      const connector = new LocalKeypairWalletConnector(keypair);
      const publicKey = await connector.getPublicKey();

      expect(publicKey).toBe(keypair.publicKey());
    });
  });

  describe('getNetwork', () => {
    it('should return testnet when initialized with testnet', async () => {
      const connector = new LocalKeypairWalletConnector(keypair, 'testnet');
      const network = await connector.getNetwork();

      expect(network).toBe('testnet');
    });

    it('should return mainnet when initialized with mainnet', async () => {
      const connector = new LocalKeypairWalletConnector(keypair, 'mainnet');
      const network = await connector.getNetwork();

      expect(network).toBe('mainnet');
    });

    it('should return futurenet when initialized with futurenet', async () => {
      const connector = new LocalKeypairWalletConnector(keypair, 'futurenet');
      const network = await connector.getNetwork();

      expect(network).toBe('futurenet');
    });

    it('should return testnet by default when no network is specified', async () => {
      const connector = new LocalKeypairWalletConnector(keypair);
      const network = await connector.getNetwork();

      expect(network).toBe('testnet');
    });
  });

  describe('signTransaction', () => {
    it('should sign a transaction and return the signed XDR', async () => {
      const connector = new LocalKeypairWalletConnector(keypair, 'testnet');
      const networkPassphrase = 'Test SDF Network ; September 2015';
      const account = {
        accountId: () => keypair.publicKey(),
        sequenceNumber: () => '1',
        incrementSequenceNumber: () => {},
      } as any;

      const tx = new TransactionBuilder(account, {
        fee: '100',
        networkPassphrase,
      })
        .setTimeout(30)
        .build();

      const transactionXdr = tx.toXDR();
      const signedXdr = await connector.signTransaction(transactionXdr, networkPassphrase);

      expect(signedXdr).toBeDefined();
      expect(typeof signedXdr).toBe('string');
      expect(signedXdr.length).toBeGreaterThan(0);
    });
  });
});
