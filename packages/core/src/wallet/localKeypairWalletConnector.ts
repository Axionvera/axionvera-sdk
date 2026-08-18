import { Keypair, TransactionBuilder } from "@stellar/stellar-sdk";
import { WalletConnector } from "./walletConnector";
import { AxionveraNetwork } from "../utils/networkConfig";

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
   * @param network - The network this connector operates on (default: "testnet")
   */
  constructor(keypair: Keypair, network: AxionveraNetwork = "testnet") {
    this.keypair = keypair;
    this.network = network;
  }

  /** @inheritdoc */
  getPublicKey(): Promise<string> {
    return Promise.resolve(this.keypair.publicKey());
  }

  /**
   * Returns the network this connector was configured for.
   * @inheritdoc
   */
  getNetwork(): Promise<AxionveraNetwork> {
    return Promise.resolve(this.network);
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
