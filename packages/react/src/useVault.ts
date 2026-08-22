import { useCallback, useMemo, useState } from 'react';
import {
  VaultContract,
  type AmountInput,
  type ContractInvoker,
  type VaultBalance,
  type VaultInfo,
  type VaultReward,
  type VaultTransaction
} from '@axionvera/core';

export interface UseVaultOptions {
  contractId: string;
  invoker: ContractInvoker;
  walletAddress?: string | null;
}

export interface UseVaultResult {
  vault: VaultContract;
  isSubmitting: boolean;
  error: Error | null;
  getInfo(): Promise<VaultInfo>;
  getBalance(address?: string): Promise<VaultBalance>;
  getPendingRewards(address?: string): Promise<VaultReward>;
  deposit(amount: AmountInput): Promise<VaultTransaction>;
  withdraw(amount: AmountInput): Promise<VaultTransaction>;
  claimRewards(): Promise<VaultTransaction>;
  resetError(): void;
}

export function useVault(options: UseVaultOptions): UseVaultResult {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const vault = useMemo(
    () =>
      new VaultContract({
        contractId: options.contractId,
        invoker: options.invoker
      }),
    [options.contractId, options.invoker]
  );

  const requireWalletAddress = useCallback((): string => {
    if (!options.walletAddress) {
      throw new Error('Connect a wallet before using vault write actions');
    }

    return options.walletAddress;
  }, [options.walletAddress]);

  const runAction = useCallback(
    async <TResult,>(action: () => Promise<TResult>): Promise<TResult> => {
      setIsSubmitting(true);
      setError(null);

      try {
        return await action();
      } catch (caught) {
        const nextError = caught instanceof Error ? caught : new Error(String(caught));
        setError(nextError);
        throw nextError;
      } finally {
        setIsSubmitting(false);
      }
    },
    []
  );

  const getInfo = useCallback(() => vault.getInfo(), [vault]);

  const getBalance = useCallback(
    (address?: string) => vault.getBalance(address ?? requireWalletAddress()),
    [vault, requireWalletAddress]
  );

  const getPendingRewards = useCallback(
    (address?: string) => vault.getPendingRewards(address ?? requireWalletAddress()),
    [vault, requireWalletAddress]
  );

  const deposit = useCallback(
    (amount: AmountInput) =>
      runAction(() => vault.deposit(requireWalletAddress(), amount)),
    [vault, requireWalletAddress, runAction]
  );

  const withdraw = useCallback(
    (amount: AmountInput) =>
      runAction(() => vault.withdraw(requireWalletAddress(), amount)),
    [vault, requireWalletAddress, runAction]
  );

  const claimRewards = useCallback(
    () => runAction(() => vault.claimRewards(requireWalletAddress())),
    [vault, requireWalletAddress, runAction]
  );

  const resetError = useCallback(() => setError(null), []);

  return {
    vault,
    isSubmitting,
    error,
    getInfo,
    getBalance,
    getPendingRewards,
    deposit,
    withdraw,
    claimRewards,
    resetError
  };
}
