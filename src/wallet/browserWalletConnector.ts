import { WalletConnector } from './walletConnector';
import { AxionveraNetwork } from '../utils/networkConfig';
import { WalletNotInstalledError } from '../errors/axionveraError';

type FreighterApi = {
  getPublicKey: () => Promise<string>;
  getNetwork: () => Promise<string>;
  signTransaction: (
    transactionXdr: string,
    networkPassphrase: string
  ) => Promise<string | { signedTransaction: string }>;
};

/**
 * Maps Freighter network names to SDK network names.
 * Freighter returns network names like "TESTNET", "PUBLIC", etc.
 * @param freighterNetwork - The network name from Freighter
 * @returns The corresponding AxionveraNetwork
 */
function mapFreighterNetworkToAxionveraNetwork(freighterNetwork: string): AxionveraNetwork {
  const normalized = freighterNetwork.toUpperCase();
  
  switch (normalized) {
    case 'TESTNET':
      return 'testnet';
    case 'PUBLIC':
      return 'mainnet';
    case 'FUTURENET':
      return 'futurenet';
    default:
      // If unknown network, default to testnet for safety
      console.warn(`Unknown Freighter network: ${freighterNetwork}, defaulting to testnet`);
      return 'testnet';
  }
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
  if (
    !provider ||
    typeof (provider as any).getPublicKey !== 'function' ||
    typeof (provider as any).signTransaction !== 'function' ||
    typeof (provider as any).getNetwork !== 'function'
  ) {
    throw new WalletNotInstalledError(
      'Freighter extension is not detected. Please install the Freighter browser extension.'
    );
  }

  return provider as FreighterApi;
}

export class BrowserWalletConnector implements WalletConnector {
  /** @inheritdoc */
  async getPublicKey(): Promise<string> {
    const freighter = await loadFreighter();
    return freighter.getPublicKey();
  }

  /** @inheritdoc */
  async getNetwork(): Promise<AxionveraNetwork> {
    const freighter = await loadFreighter();
    const freighterNetwork = await freighter.getNetwork();
    return mapFreighterNetworkToAxionveraNetwork(freighterNetwork);
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
