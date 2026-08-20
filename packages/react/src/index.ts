import {
  createContext,
  createElement,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import type { WalletConnector } from '@axionvera/core';
import {
  StellarClient,
  VaultContract,
  WalletNotInstalledError,
  type StellarClientOptions
} from '@axionvera/core';

import {
  FreighterWalletConnector,
  getFreighterAddress,
  getFreighterAvailability,
  loadFreighterModule
} from './freighterWalletConnector';

type WalletContextState = {
  connector: WalletConnector;
  publicKey: string | null;
  isAvailable: boolean;
  isConnected: boolean;
  isLoading: boolean;
  error: Error | null;
};

type AxionveraContextValue = {
  client: StellarClient;
  vaultContractId: string | undefined;
  walletState: WalletContextState;
  connectWallet: () => Promise<string | null>;
  refreshWallet: () => Promise<string | null>;
};

export type AxionveraProviderProps = {
  children: ReactNode;
  clientOptions?: StellarClientOptions;
  vaultContractId?: string;
  walletConnector?: WalletConnector;
  walletWatchInterval?: number;
};

export type UseWalletResult = WalletContextState & {
  connect: () => Promise<string | null>;
  refresh: () => Promise<string | null>;
};

const AxionveraContext = createContext<AxionveraContextValue | null>(null);

function toWalletError(error: unknown, fallbackMessage: string): Error {
  return error instanceof Error ? error : new Error(fallbackMessage);
}

async function readWalletState(
  connector: WalletConnector,
  requireAccess = false
): Promise<{
  publicKey: string | null;
  isAvailable: boolean;
  isConnected: boolean;
}> {
  if (!(connector instanceof FreighterWalletConnector)) {
    const publicKey = await connector.getPublicKey();
    return {
      publicKey,
      isAvailable: true,
      isConnected: publicKey.length > 0
    };
  }

  const availability = await getFreighterAvailability();
  if (!availability.isAvailable) {
    return {
      publicKey: null,
      isAvailable: false,
      isConnected: false
    };
  }

  if (!requireAccess && !availability.isAllowed) {
    return {
      publicKey: null,
      isAvailable: true,
      isConnected: false
    };
  }

  const publicKey = await getFreighterAddress({ requireAccess });
  return {
    publicKey,
    isAvailable: true,
    isConnected: publicKey !== null
  };
}

function useAxionveraContext(): AxionveraContextValue {
  const context = useContext(AxionveraContext);
  if (!context) {
    throw new Error('AxionveraProvider is required to use Axionvera React hooks.');
  }

  return context;
}

export function AxionveraProvider({
  children,
  clientOptions,
  vaultContractId,
  walletConnector,
  walletWatchInterval = 3000
}: AxionveraProviderProps) {
  const [client] = useState(() => new StellarClient(clientOptions));
  const [connector] = useState<WalletConnector>(
    () => walletConnector ?? new FreighterWalletConnector()
  );
  const [walletState, setWalletState] = useState<WalletContextState>({
    connector,
    publicKey: null,
    isAvailable: typeof window !== 'undefined',
    isConnected: false,
    isLoading: true,
    error: null
  });
  const updateWalletState = useCallback(
    (nextState: Partial<WalletContextState>) => {
      setWalletState((currentState) => ({
        ...currentState,
        ...nextState,
        connector
      }));
    },
    [connector]
  );
  const connectWallet = useCallback(async (): Promise<string | null> => {
    updateWalletState({ isLoading: true });

    try {
      const nextState = await readWalletState(connector, true);
      updateWalletState({
        ...nextState,
        isLoading: false,
        error: null
      });
      return nextState.publicKey;
    } catch (error) {
      const nextError = toWalletError(error, 'Failed to connect wallet.');

      updateWalletState({
        publicKey: null,
        isAvailable: !(nextError instanceof WalletNotInstalledError),
        isConnected: false,
        isLoading: false,
        error: nextError
      });

      return null;
    }
  }, [connector, updateWalletState]);
  const refreshWallet = useCallback(async (): Promise<string | null> => {
    updateWalletState({ isLoading: true });

    try {
      const nextState = await readWalletState(connector);
      updateWalletState({
        ...nextState,
        isLoading: false,
        error: null
      });
      return nextState.publicKey;
    } catch (error) {
      const nextError = toWalletError(error, 'Failed to refresh wallet state.');

      updateWalletState({
        publicKey: null,
        isAvailable: !(nextError instanceof WalletNotInstalledError),
        isConnected: false,
        isLoading: false,
        error: nextError
      });

      return null;
    }
  }, [connector, updateWalletState]);

  useEffect(() => {
    let isMounted = true;
    let watcher: {
      watch: (
        callback: (result: {
          address: string;
          network: string;
          networkPassphrase: string;
        }) => void
      ) => void;
      stop: () => void;
    } | null = null;
    const usesFreighter = connector instanceof FreighterWalletConnector;
    const safeUpdateWalletState = (nextState: Partial<WalletContextState>) => {
      if (isMounted) {
        updateWalletState(nextState);
      }
    };

    void refreshWallet();

    if (usesFreighter && typeof window !== 'undefined' && typeof document !== 'undefined') {
      void loadFreighterModule()
        .then((freighter) => {
          if (!isMounted || typeof freighter.WatchWalletChanges !== 'function') {
            return;
          }

          watcher = new freighter.WatchWalletChanges(walletWatchInterval);
          watcher.watch((result) => {
            safeUpdateWalletState({
              publicKey: result.address || null,
              isAvailable: true,
              isConnected: result.address.trim().length > 0,
              isLoading: false,
              error: null
            });
          });
        })
        .catch((error) => {
          const nextError = error instanceof WalletNotInstalledError
            ? null
            : error instanceof Error
              ? error
              : new Error('Failed to watch Freighter account changes.');

          safeUpdateWalletState({
            isAvailable: nextError === null ? false : true,
            isLoading: false,
            error: nextError
          });
        });

      const handleWindowRefresh = () => {
        void refreshWallet();
      };

      window.addEventListener('focus', handleWindowRefresh);
      document.addEventListener('visibilitychange', handleWindowRefresh);

      return () => {
        isMounted = false;
        watcher?.stop();
        window.removeEventListener('focus', handleWindowRefresh);
        document.removeEventListener('visibilitychange', handleWindowRefresh);
      };
    }

    return () => {
      isMounted = false;
    };
  }, [connector, refreshWallet, updateWalletState, walletWatchInterval]);

  const contextValue = useMemo<AxionveraContextValue>(
    () => ({
      client,
      vaultContractId,
      walletState,
      connectWallet,
      refreshWallet
    }),
    [client, connectWallet, refreshWallet, vaultContractId, walletState]
  );

  return createElement(
    AxionveraContext.Provider,
    { value: contextValue },
    children
  );
}

export function useStellarClient(): StellarClient {
  return useAxionveraContext().client;
}

export function useVaultContract(contractId?: string): VaultContract {
  const { client, vaultContractId, walletState } = useAxionveraContext();
  const resolvedContractId = contractId ?? vaultContractId;

  if (!resolvedContractId) {
    throw new Error(
      'Vault contract ID is required. Pass vaultContractId to AxionveraProvider or useVaultContract(contractId).'
    );
  }

  return useMemo(
    () =>
      new VaultContract({
        client,
        contractId: resolvedContractId,
        wallet: walletState.connector
      }),
    [client, resolvedContractId, walletState.connector]
  );
}

export function useWallet(): UseWalletResult {
  const { walletState, connectWallet, refreshWallet } = useAxionveraContext();

  return {
    ...walletState,
    connect: connectWallet,
    refresh: refreshWallet
  };
}

export { StellarClient } from '@axionvera/core';
export { useVault } from './useVault';
export type { TxStep, UseVaultState, UseVaultActions } from './useVault';
export { TransactionStepper } from './TransactionStepper';
export { FreighterWalletConnector };
export type { StellarClientOptions, WalletConnector };
