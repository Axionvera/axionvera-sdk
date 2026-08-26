import { useAxionvera } from './provider';

export function useWallet() {
  const context = useAxionvera();

  return {
    wallet: context.wallet,
    connection: context.connection,
    publicKey: context.connection?.publicKey,
    isConnected: context.isConnected,
    isReady: context.isReady,
    readiness: context.readiness,
    error: context.error,
    connect: context.connect,
    disconnect: context.disconnect,
    clearError: context.clearError
  };
}
