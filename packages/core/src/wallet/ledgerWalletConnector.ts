import TransportWebUSB from "@ledgerhq/hw-transport-webusb";
import Str from "@ledgerhq/hw-app-str";
import { TransactionBuilder } from "@stellar/stellar-sdk";
import { WalletConnector } from "./walletConnector";
import { DeviceLockedError, UserRejectedError } from "../errors/axionveraError";

/**
 * Wallet connector implementation for Ledger hardware wallets.
 */
export class LedgerWalletConnector implements WalletConnector {
  private readonly bip32Path: string;

  /**
   * Creates a new LedgerWalletConnector.
   * @param bip32Path - The BIP32 path to use (default: 44'/148'/0')
   */
  constructor(bip32Path = "44'/148'/0'") {
    this.bip32Path = bip32Path;
  }

  /** @inheritdoc */
  async getPublicKey(): Promise<string> {
    try {
      const transport = await TransportWebUSB.create();
      const str = new Str(transport);
      const result = (await str.getPublicKey(this.bip32Path)) as { publicKey: string };
      await transport.close();
      return result.publicKey;
    } catch (error) {
      throw this.handleLedgerError(error);
    }
  }

  /** @inheritdoc */
  async signTransaction(
    transactionXdr: string,
    networkPassphrase: string
  ): Promise<string> {
    try {
      const transport = await TransportWebUSB.create();
      const str = new Str(transport);
      const tx = TransactionBuilder.fromXDR(transactionXdr, networkPassphrase);
      
      // Ledger requires the transaction signature base
      const signatureBase = tx.signatureBase();
      const result = (await str.signTransaction(this.bip32Path, signatureBase)) as { signature: Buffer };
      
      // Add the signature to the transaction
      // Note: We need to convert the signature to a Buffer if it's not already
      // We need the public key to add the signature. In Ledger, we get it from getPublicKey or the result.
      // hw-app-str signTransaction returns { signature: Buffer }
      
      // We need the public key here. I'll call getPublicKey or assume we have it.
      // Actually, tx.addSignature needs the public key.
      const { publicKey } = (await str.getPublicKey(this.bip32Path)) as { publicKey: string };
      tx.addSignature(publicKey, result.signature.toString("base64"));
      
      await transport.close();
      return tx.toXDR();
    } catch (error) {
      throw this.handleLedgerError(error);
    }
  }

  /**
   * Maps Ledger-specific errors to Axionvera errors.
   */
  private handleLedgerError(error: unknown): Error {
    if (error instanceof Error) {
      const message = error.message.toLowerCase();
      
      // 0x6b0c is the status code for "Locked device"
      if (message.includes("0x6b0c") || message.includes("locked")) {
        return new DeviceLockedError("Ledger device is locked. Please unlock it and try again.", { originalError: error });
      }
      
      // 0x6985 is the status code for "User rejected"
      if (message.includes("0x6985") || message.includes("denied") || message.includes("rejected")) {
        return new UserRejectedError("Transaction rejected by the user on the Ledger device.", { originalError: error });
      }
    }
    
    return error instanceof Error ? error : new Error(String(error));
  }
}
