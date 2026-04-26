
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
