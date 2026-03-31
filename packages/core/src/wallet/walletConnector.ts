import { Keypair, TransactionBuilder } from "@stellar/stellar-sdk";

/**
 * Interface for wallet implementations that can sign transactions.
 */
export interface WalletConnector {
  /**
   * Gets the public key of the connected account.
   * @returns The public key
   */
  getPublicKey(): Promise<string>;

  /**
   * Signs a transaction XDR string.
   * @param transactionXdr - The base64-encoded transaction XDR
   * @param networkPassphrase - The network passphrase
   * @returns The base64-encoded signed transaction XDR
   */
  signTransaction(transactionXdr: string, networkPassphrase: string): Promise<string>;
}

/**
 * Wallet connector implementation using a local Keypair.
 * Useful for testing and development without a browser wallet.
 */
export class LocalKeypairWalletConnector implements WalletConnector {
  private readonly keypair: Keypair;

  /**
   * Creates a new LocalKeypairWalletConnector.
   * @param keypair - The Keypair to use for signing
   */
  constructor(keypair: Keypair) {
    this.keypair = keypair;
  }

  /** @inheritdoc */
  async getPublicKey(): Promise<string> {
    return this.keypair.publicKey();
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
