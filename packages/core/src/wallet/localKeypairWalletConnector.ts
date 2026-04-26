import { Keypair, TransactionBuilder } from "@stellar/stellar-sdk";
import { WalletConnector } from "./walletConnector";

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
  getPublicKey(): Promise<string> {
    return Promise.resolve(this.keypair.publicKey());
  }

  /** @inheritdoc */
  signTransaction(
    transactionXdr: string,
    networkPassphrase: string
  ): Promise<string> {
    const tx = TransactionBuilder.fromXDR(transactionXdr, networkPassphrase);
    tx.sign(this.keypair);
    return Promise.resolve(tx.toXDR());
  }
}
