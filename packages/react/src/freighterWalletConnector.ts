import type { WalletConnector, AxionveraNetwork } from '@axionvera/core';
import { WalletNotInstalledError } from '@axionvera/core';

type FreighterErrorLike =
  | string
  | {
      message?: string;
    };

type FreighterAccessResponse = {
  address?: string;
  error?: FreighterErrorLike;
};

type FreighterSignResponse =
  | string
  | {
      signedTxXdr?: string;
      signedTransaction?: string;
      error?: FreighterErrorLike;
    };

type FreighterModule = {
  isConnected?: () => Promise<{ isConnected: boolean; error?: FreighterErrorLike }>;
  isAllowed?: () => Promise<{ isAllowed: boolean; error?: FreighterErrorLike }>;
  requestAccess?: () => Promise<FreighterAccessResponse>;
  getAddress?: () => Promise<FreighterAccessResponse>;
  getPublicKey?: () => Promise<string>;
  getNetwork?: () => Promise<string>;
  signTransaction?: (
    transactionXdr: string,
    opts?: {
      network?: string;
      networkPassphrase?: string;
      address?: string;
    }
  ) => Promise<FreighterSignResponse>;
  WatchWalletChanges?: new (timeout?: number) => {
    watch: (
      callback: (result: {
        address: string;
        network: string;
        networkPassphrase: string;
      }) => void
    ) => void;
    stop: () => void;
  };
};

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : null;
}

function getErrorMessage(error: FreighterErrorLike | undefined, fallback: string): string {
  if (typeof error === 'string' && error.trim().length > 0) {
    return error;
  }

  if (
    typeof error === 'object' &&
    error !== null &&
    typeof error.message === 'string' &&
    error.message.trim().length > 0
  ) {
    return error.message;
  }

  return fallback;
}

function readAddress(result: FreighterAccessResponse | undefined): string | null {
  if (!result || typeof result.address !== 'string') {
    return null;
  }

  const address = result.address.trim();
  return address.length > 0 ? address : null;
}

export async function loadFreighterModule(): Promise<FreighterModule> {
  if (typeof window === 'undefined') {
    throw new WalletNotInstalledError(
      'Freighter requires a browser environment.'
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

  const moduleRecord = asRecord(freighterModule);
  const defaultRecord = moduleRecord ? asRecord(moduleRecord.default) : null;
  const normalizedModule = {
    ...(defaultRecord ?? {}),
    ...(moduleRecord ?? {})
  } as FreighterModule;

  if (
    typeof normalizedModule.requestAccess !== 'function' &&
    typeof normalizedModule.getAddress !== 'function' &&
    typeof normalizedModule.getPublicKey !== 'function'
  ) {
    throw new WalletNotInstalledError(
      'Freighter extension is not detected. Please install the Freighter browser extension.'
    );
  }

  return normalizedModule;
}

export async function getFreighterAddress(options?: {
  requireAccess?: boolean;
}): Promise<string | null> {
  const freighter = await loadFreighterModule();

  if (options?.requireAccess && typeof freighter.requestAccess === 'function') {
    const result = await freighter.requestAccess();
    if (result?.error) {
      throw new Error(getErrorMessage(result.error, 'Freighter access request failed.'));
    }

    return readAddress(result);
  }

  if (typeof freighter.getAddress === 'function') {
    const result = await freighter.getAddress();
    if (result?.error) {
      throw new Error(getErrorMessage(result.error, 'Failed to read Freighter address.'));
    }

    return readAddress(result);
  }

  if (typeof freighter.getPublicKey === 'function') {
    try {
      const publicKey = await freighter.getPublicKey();
      return publicKey.trim().length > 0 ? publicKey : null;
    } catch (error) {
      if (options?.requireAccess) {
        throw error;
      }

      return null;
    }
  }

  return null;
}

export async function getFreighterAvailability(): Promise<{
  isAvailable: boolean;
  isAllowed: boolean;
}> {
  try {
    const freighter = await loadFreighterModule();

    if (typeof freighter.isConnected === 'function') {
      const connectionResult = await freighter.isConnected();
      if (connectionResult.error) {
        throw new Error(
          getErrorMessage(connectionResult.error, 'Failed to read Freighter connection state.')
        );
      }

      if (!connectionResult.isConnected) {
        return { isAvailable: false, isAllowed: false };
      }
    }

    if (typeof freighter.isAllowed === 'function') {
      const allowedResult = await freighter.isAllowed();
      if (allowedResult.error) {
        throw new Error(
          getErrorMessage(allowedResult.error, 'Failed to read Freighter authorization state.')
        );
      }

      return { isAvailable: true, isAllowed: allowedResult.isAllowed };
    }

    return { isAvailable: true, isAllowed: false };
  } catch (error) {
    if (error instanceof WalletNotInstalledError) {
      return { isAvailable: false, isAllowed: false };
    }

    throw error;
  }
}

function mapFreighterNetworkToAxionveraNetwork(freighterNetwork: string): AxionveraNetwork {
  const normalized = (freighterNetwork || '').toUpperCase();
  switch (normalized) {
    case 'TESTNET':
      return 'testnet';
    case 'PUBLIC':
      return 'mainnet';
    case 'FUTURENET':
      return 'futurenet';
    default:
      return 'testnet';
  }
}

export class FreighterWalletConnector implements WalletConnector {
  async getPublicKey(): Promise<string> {
    const address = await getFreighterAddress({ requireAccess: true });
    if (!address) {
      throw new Error('Freighter did not return an account address.');
    }

    return address;
  }

  async getNetwork(): Promise<AxionveraNetwork> {
    const freighter = await loadFreighterModule();
    if (typeof freighter.getNetwork === 'function') {
      const freighterNetwork = await freighter.getNetwork();
      return mapFreighterNetworkToAxionveraNetwork(freighterNetwork);
    }
    return 'testnet';
  }

  async signTransaction(
    transactionXdr: string,
    networkPassphrase: string
  ): Promise<string> {
    const freighter = await loadFreighterModule();
    if (typeof freighter.signTransaction !== 'function') {
      throw new WalletNotInstalledError(
        'Freighter signTransaction is not available.'
      );
    }

    const result = await freighter.signTransaction(transactionXdr, {
      networkPassphrase
    });

    if (typeof result === 'string') {
      return result;
    }

    if (result.error) {
      throw new Error(getErrorMessage(result.error, 'Freighter transaction signing failed.'));
    }

    if (typeof result.signedTxXdr === 'string') {
      return result.signedTxXdr;
    }

    if (typeof result.signedTransaction === 'string') {
      return result.signedTransaction;
    }

    throw new Error('Unexpected Freighter signTransaction response.');
  }
}
