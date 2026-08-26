import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import { checkWalletReadiness, type WalletConnection, type WalletConnector, type WalletReadiness } from '@axionvera/core';

export interface AxionveraProviderProps {
  wallet?: WalletConnector;
  children: ReactNode;
}

export interface AxionveraReactContextValue {
  wallet: WalletConnector | null;
  connection: WalletConnection | null;
  isConnected: boolean;
  isReady: boolean;
  readiness: WalletReadiness;
  error: Error | null;
  connect(): Promise<WalletConnection>;
  disconnect(): Promise<void>;
  clearError(): void;
}

const AxionveraReactContext = createContext<AxionveraReactContextValue | undefined>(undefined);

export function AxionveraProvider({ wallet, children }: AxionveraProviderProps): JSX.Element {
  const [connection, setConnection] = useState<WalletConnection | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const connect = useCallback(async (): Promise<WalletConnection> => {
    if (!wallet) {
      const err = new Error('No wallet connector was provided');
      setError(err);
      throw err;
    }

    try {
      const nextConnection = await wallet.connect();
      setConnection(nextConnection);
      setError(null);
      return nextConnection;
    } catch (caught) {
      const err = caught instanceof Error ? caught : new Error(String(caught));
      setError(err);
      throw err;
    }
  }, [wallet]);

  const disconnect = useCallback(async (): Promise<void> => {
    try {
      if (wallet?.disconnect) {
        await wallet.disconnect();
      }
    } catch (caught) {
      const err = caught instanceof Error ? caught : new Error(String(caught));
      setError(err);
      throw err;
    } finally {
      setConnection(null);
    }
  }, [wallet]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const readiness = useMemo(
    () => checkWalletReadiness({ connector: wallet ?? null, connection }),
    [wallet, connection]
  );

  const value = useMemo<AxionveraReactContextValue>(
    () => ({
      wallet: wallet ?? null,
      connection,
      isConnected: connection !== null,
      isReady: readiness.isReady,
      readiness,
      error,
      connect,
      disconnect,
      clearError
    }),
    [wallet, connection, readiness, error, connect, disconnect, clearError]
  );

  return (
    <AxionveraReactContext.Provider value={value}>
      {children}
    </AxionveraReactContext.Provider>
  );
}

export function useAxionvera(): AxionveraReactContextValue {
  const context = useContext(AxionveraReactContext);

  if (!context) {
    throw new Error('useAxionvera must be used inside AxionveraProvider');
  }

  return context;
}
