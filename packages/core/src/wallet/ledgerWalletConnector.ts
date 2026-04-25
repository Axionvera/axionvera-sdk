import { StrKey, TransactionBuilder } from "@stellar/stellar-sdk";

import { DeviceLockedError, UserRejectedError } from "../errors/axionveraError";
import { WalletConnector } from "./walletConnector";

type LedgerConfig = {
  derivationPath?: string;
  /** If true, ask Ledger to display/confirm the address */
  displayAddressOnDevice?: boolean;
};

type TransportLike = {
  close?: () => Promise<void>;
};

type LedgerStellarApp = {
  getPublicKey: (path: string, display?: boolean) => Promise<{ rawPublicKey: Buffer }>;
  signTransaction: (path: string, signatureBase: Buffer) => Promise<{ signature: Buffer }>;
};

function toLedgerError(error: unknown): Error {
  const name = typeof (error as any)?.name === "string" ? (error as any).name : "";
  const message = typeof (error as any)?.message === "string" ? (error as any).message : "";

  // User cancelled / denied USB permission prompt (varies by browser)
  if (name === "NotAllowedError" || /user.*(reject|denied)|permission/i.test(message)) {
    return new UserRejectedError("User rejected the device connection request.", { originalError: error });
  }

  // Ledger locked / app not open (heuristic based on common transport/app messages)
  if (/locked|unlock|security|denied by the user/i.test(message)) {
    return new DeviceLockedError("Ledger device appears to be locked or not ready.", { originalError: error });
  }

  return error instanceof Error ? error : new Error("Ledger operation failed.");
}

export class LedgerWalletConnector implements WalletConnector {
  private readonly derivationPath: string;
  private readonly displayAddressOnDevice: boolean;

  constructor(config: LedgerConfig = {}) {
    this.derivationPath = config.derivationPath ?? "44'/148'/0'";
    this.displayAddressOnDevice = config.displayAddressOnDevice ?? false;
  }

  async getPublicKey(): Promise<string> {
    const { transport, app } = await this.open();
    try {
      const res = await app.getPublicKey(this.derivationPath, this.displayAddressOnDevice);
      return StrKey.encodeEd25519PublicKey(res.rawPublicKey);
    } catch (error) {
      throw toLedgerError(error);
    } finally {
      await transport.close?.().catch(() => undefined);
    }
  }

  async signTransaction(transactionXdr: string, networkPassphrase: string): Promise<string> {
    const tx = TransactionBuilder.fromXDR(transactionXdr, networkPassphrase);

    const { transport, app } = await this.open();
    try {
      const signatureBase = (tx as any).signatureBase() as Buffer;
      const { signature } = await app.signTransaction(this.derivationPath, signatureBase);

      const publicKey = await this.getPublicKey();
      (tx as any).addSignature(publicKey, signature.toString("base64"));

      return (tx as any).toXDR() as string;
    } catch (error) {
      throw toLedgerError(error);
    } finally {
      await transport.close?.().catch(() => undefined);
    }
  }

  private async open(): Promise<{ transport: TransportLike; app: LedgerStellarApp }> {
    try {
      const [{ default: TransportWebUSB }, { default: StrApp }] = await Promise.all([
        import("@ledgerhq/hw-transport-webusb"),
        import("@ledgerhq/hw-app-str"),
      ]);

      const transport = (await TransportWebUSB.create()) as unknown as TransportLike;
      const app = new StrApp(transport as any) as LedgerStellarApp;

      return { transport, app };
    } catch (error) {
      throw toLedgerError(error);
    }
  }
}

