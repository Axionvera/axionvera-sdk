import { Keypair, TransactionBuilder } from '@stellar/stellar-sdk';
import type { WalletConnector } from './walletConnector';
import { AxionveraNetwork } from '../utils/networkConfig';

/**
 * Mock wallet connector for automated tests (Playwright/Cypress/Jest).
 *
 * This connector signs transactions locally using a provided Keypair/secret,
 * without any UI prompts.
 */
export class MockWalletConnector implements WalletConnector {
  private readonly keypair: Keypair;
  private readonly network: AxionveraNetwork;

  /**
   * Creates a new MockWalletConnector.
   * @param keypairOrSecret - A Keypair instance or secret key (starts with 'S')
   * @param network - The network this connector operates on (default: "testnet")
   */
  constructor(keypairOrSecret: Keypair | string, network: AxionveraNetwork = 'testnet') {
    this.keypair =
      typeof keypairOrSecret === 'string'
        ? Keypair.fromSecret(keypairOrSecret)
        : keypairOrSecret;
    this.network = network;
  }

  /** @inheritdoc */
  async getPublicKey(): Promise<string> {
    return this.keypair.publicKey();
  }

  /**
   * Returns the network this mock connector was configured for.
   * @inheritdoc
   */
  async getNetwork(): Promise<AxionveraNetwork> {
    return this.network;
  }

  /** @inheritdoc */
  async signTransaction(
    transactionXdr: string,
    networkPassphrase: string
  ): Promise<string> {
    const tx = TransactionBuilder.fromXDR(transactionXdr, networkPassphrase);
    tx.sign(this.keypair);
    return tx.toXDR();
  }
}

