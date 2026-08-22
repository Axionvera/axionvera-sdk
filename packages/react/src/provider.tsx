import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import type { WalletConnection, WalletConnector } from '@axionvera/core';

export interface AxionveraProviderProps {
  wallet?: WalletConnector;
  children: ReactNode;
}

export interface AxionveraReactContextValue {
  wallet: WalletConnector | null;
  connection: WalletConnection | null;
  isConnected: boolean;
  connect(): Promise<WalletConnection>;
  disconnect(): Promise<void>;
}

const AxionveraReactContext = createContext<AxionveraReactContextValue | undefined>(undefined);

export function AxionveraProvider({ wallet, children }: AxionveraProviderProps): JSX.Element {
  const [connection, setConnection] = useState<WalletConnection | null>(null);

  const connect = useCallback(async (): Promise<WalletConnection> => {
    if (!wallet) {
      throw new Error('No wallet connector was provided');
    }

    const nextConnection = await wallet.connect();
    setConnection(nextConnection);
    return nextConnection;
  }, [wallet]);

  const disconnect = useCallback(async (): Promise<void> => {
    if (wallet?.disconnect) {
      await wallet.disconnect();
    }

    setConnection(null);
  }, [wallet]);

  const value = useMemo<AxionveraReactContextValue>(
    () => ({
      wallet: wallet ?? null,
      connection,
      isConnected: connection !== null,
      connect,
      disconnect
    }),
    [wallet, connection, connect, disconnect]
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
