import { Keypair, TransactionBuilder } from "@stellar/stellar-sdk";
import { AxionveraNetwork } from "../utils/networkConfig";

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
   * Gets the network that the wallet is currently connected to.
   * @returns The network identifier
   */
  getNetwork(): Promise<AxionveraNetwork>;

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
  private readonly network: AxionveraNetwork;

  /**
   * Creates a new LocalKeypairWalletConnector.
   * @param keypair - The Keypair to use for signing
   * @param network - The network the keypair is configured for (default: "testnet")
   */
  constructor(keypair: Keypair, network: AxionveraNetwork = "testnet") {
    this.keypair = keypair;
    this.network = network;
  }

  /** @inheritdoc */
  async getPublicKey(): Promise<string> {
    return this.keypair.publicKey();
  }

  /** @inheritdoc */
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
