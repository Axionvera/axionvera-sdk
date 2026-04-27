import { WalletConnector } from './walletConnector';
import { WalletNotInstalledError } from '../errors/axionveraError';

interface FreighterApi {
  getPublicKey: () => Promise<string>;
  signTransaction: (
    transactionXdr: string,
    networkPassphrase: string
  ) => Promise<string | { signedTransaction: string }>;
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
  } catch (_error) {
    throw new WalletNotInstalledError(
      'Freighter extension is not installed or could not be loaded.'
    );
  }

  const provider = (freighterModule as { default?: unknown }).default ?? freighterModule;
  if (
    !provider ||
    typeof (provider as Record<string, unknown>).getPublicKey !== 'function' ||
    typeof (provider as Record<string, unknown>).signTransaction !== 'function'
  ) {
    throw new WalletNotInstalledError(
      'Freighter extension is not detected. Please install the Freighter browser extension.'
    );
  }

  return provider as unknown as FreighterApi;
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
      typeof (result as Record<string, unknown>).signedTransaction === 'string'
    ) {
      return (result as { signedTransaction: string }).signedTransaction;
    }

    throw new Error('Unexpected Freighter signTransaction response.');
  }
}
