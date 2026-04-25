import { WalletConnector } from './walletConnector';
import { WalletNotInstalledError } from '../errors/axionveraError';

type FreighterApi = {
  getPublicKey: () => Promise<string>;
  signTransaction: (
    transactionXdr: string,
    networkPassphrase: string
  ) => Promise<string | { signedTransaction: string }>;
};

function isFreighterApi(value: unknown): value is FreighterApi {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.getPublicKey === "function" && typeof v.signTransaction === "function";
}

async function loadFreighter(): Promise<FreighterApi> {
  if (typeof window === 'undefined') {
    throw new WalletNotInstalledError(
      'Browser wallet connector requires a browser environment with Freighter installed.'
    );
  }

  let freighterModule: unknown;
  try {
    freighterModule = await import('@stellar/freighter-api');
  } catch (error) {
    throw new WalletNotInstalledError(
      'Freighter extension is not installed or could not be loaded.'
    );
  }

  const provider = (freighterModule as any).default ?? freighterModule;
  if (!isFreighterApi(provider)) {
    throw new WalletNotInstalledError(
      'Freighter extension is not detected. Please install the Freighter browser extension.'
    );
  }

  return provider;
}

export class BrowserWalletConnector implements WalletConnector {
  /** @inheritdoc */
  async getPublicKey(): Promise<string> {
    const freighter = await loadFreighter();
    return freighter.getPublicKey();
  }

  /** @inheritdoc */
  async signTransaction(
    transactionXdr: string,
    networkPassphrase: string
  ): Promise<string> {
    const freighter = await loadFreighter();
    const result = await freighter.signTransaction(transactionXdr, networkPassphrase);

    if (typeof result === 'string') {
      return result;
    }

    if (
      result &&
      typeof result === 'object' &&
      typeof (result as any).signedTransaction === 'string'
    ) {
      return (result as any).signedTransaction;
    }

    throw new Error('Unexpected Freighter signTransaction response.');
  }
}
