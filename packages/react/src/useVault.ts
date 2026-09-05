import { useCallback, useMemo } from 'react';
import {
  VaultContract,
  toTransactionActionResult,
  type AmountInput,
  type ContractInvoker,
  type TransactionActionResult,
  type VaultBalance,
  type VaultInfo,
  type VaultReward
} from '@axionvera/core';

import { useTransactionAction } from './useTransactionAction';

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
  deposit(amount: AmountInput): Promise<TransactionActionResult>;
  withdraw(amount: AmountInput): Promise<TransactionActionResult>;
  claimRewards(): Promise<TransactionActionResult>;
  resetError(): void;
}

export function useVault(options: UseVaultOptions): UseVaultResult {
  const { isSubmitting, error, run, reset } = useTransactionAction<TransactionActionResult>();

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
      run(async () => {
        const result = await vault.deposit(requireWalletAddress(), amount);
        return toTransactionActionResult(result);
      }),
    [vault, requireWalletAddress, run]
  );

  const withdraw = useCallback(
    (amount: AmountInput) =>
      run(async () => {
        const result = await vault.withdraw(requireWalletAddress(), amount);
        return toTransactionActionResult(result);
      }),
    [vault, requireWalletAddress, run]
  );

  const claimRewards = useCallback(
    () =>
      run(async () => {
        const result = await vault.claimRewards(requireWalletAddress());
        return toTransactionActionResult(result);
      }),
    [vault, requireWalletAddress, run]
  );

  const resetError = useCallback(() => {
    reset();
  }, [reset]);

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
