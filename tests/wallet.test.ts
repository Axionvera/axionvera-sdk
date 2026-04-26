import { LocalKeypairWalletConnector } from '../src/wallet/localKeypairWalletConnector';
import { Keypair } from '@stellar/stellar-sdk';

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
      const transactionXdr = 'AAAAAgAAAABTjRfz3NYu7TFsmz8O+H3UmBJnhGKkIVj5hpPDSAEsQwAAAGQAH0g7AAAAAAAAAAIAAAAAAAAAAAAAAACIggAAAAAAAAABggEABgAAAC8xVjhiV3BzYVhSM2NHRnJaU0F5TUMzd01IZ2RabWxqWVdSVGRHRjBkWE10S0Vac2RtWnBRakZ2ZFdGMGFXOXVLSFJsYkdGMGIzSjU7dkgzMmJpSWdxdWVQN1hINzJFeThsZTJFdzR1Yz0AAAABAAAAAAAAAAAAAAAA';
      const networkPassphrase = 'Test SDF Network ; September 2015';

      const signedXdr = await connector.signTransaction(transactionXdr, networkPassphrase);

      expect(signedXdr).toBeDefined();
      expect(typeof signedXdr).toBe('string');
      expect(signedXdr.length).toBeGreaterThan(0);
    });
  });
});
