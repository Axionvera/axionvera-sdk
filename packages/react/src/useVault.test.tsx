// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import {
  VaultContract,
  type ContractInvoker,
  type TransactionActionResult,
  type VaultBalance,
  type VaultInfo,
  type VaultReward,
  type VaultTransaction
} from '@axionvera/core';
import { useVault } from './useVault';

const CONTRACT_ID = 'vault-contract-id';
const WALLET = 'GABC1234567890';
const OTHER_ADDRESS = 'GXYZ9876543210';

function createMockInvoker(): {
  invoker: ContractInvoker;
  invoke: Mock;
  read: Mock;
} {
  const invoke = vi.fn();
  const read = vi.fn();
  const invoker: ContractInvoker = { invoke, read };

  return { invoker, invoke, read };
}

const tx: VaultTransaction = { status: 'success', hash: 'hash-1' };
const normalizedTx: TransactionActionResult = {
  status: 'success',
  hash: 'hash-1',
  raw: tx
};

afterEach(() => {
  cleanup();
});

describe('useVault', () => {
  it('exposes a VaultContract instance using the provided contract id and invoker', () => {
    const { invoker } = createMockInvoker();

    const { result } = renderHook(() =>
      useVault({ contractId: CONTRACT_ID, invoker, walletAddress: WALLET })
    );

    expect(result.current.vault).toBeInstanceOf(VaultContract);
    expect(result.current.vault.contractId).toBe(CONTRACT_ID);
  });

  describe('read helpers', () => {
    it('getInfo calls the invoker read method get_info', async () => {
      const { invoker, read } = createMockInvoker();
      const info: VaultInfo = { contractId: CONTRACT_ID };
      read.mockResolvedValue(info);

      const { result } = renderHook(() =>
        useVault({ contractId: CONTRACT_ID, invoker, walletAddress: WALLET })
      );

      await act(async () => {
        await expect(result.current.getInfo()).resolves.toBe(info);
      });

      expect(read).toHaveBeenCalledWith({
        contractId: CONTRACT_ID,
        method: 'get_info',
        args: []
      });
    });

    it('getBalance uses the wallet address when no address is provided', async () => {
      const { invoker, read } = createMockInvoker();
      const balance: VaultBalance = { address: WALLET, amount: 100n };
      read.mockResolvedValue(balance);

      const { result } = renderHook(() =>
        useVault({ contractId: CONTRACT_ID, invoker, walletAddress: WALLET })
      );

      await act(async () => {
        await expect(result.current.getBalance()).resolves.toBe(balance);
      });

      expect(read).toHaveBeenCalledWith({
        contractId: CONTRACT_ID,
        method: 'get_balance',
        args: [WALLET]
      });
    });

    it('getBalance uses the provided address when given', async () => {
      const { invoker, read } = createMockInvoker();
      const balance: VaultBalance = { address: OTHER_ADDRESS, amount: 100n };
      read.mockResolvedValue(balance);

      const { result } = renderHook(() =>
        useVault({ contractId: CONTRACT_ID, invoker, walletAddress: WALLET })
      );

      await act(async () => {
        await expect(result.current.getBalance(OTHER_ADDRESS)).resolves.toBe(balance);
      });

      expect(read).toHaveBeenCalledWith({
        contractId: CONTRACT_ID,
        method: 'get_balance',
        args: [OTHER_ADDRESS]
      });
    });

    it('getPendingRewards uses the wallet address when no address is provided', async () => {
      const { invoker, read } = createMockInvoker();
      const reward: VaultReward = { address: WALLET, amount: 50n };
      read.mockResolvedValue(reward);

      const { result } = renderHook(() =>
        useVault({ contractId: CONTRACT_ID, invoker, walletAddress: WALLET })
      );

      await act(async () => {
        await expect(result.current.getPendingRewards()).resolves.toBe(reward);
      });

      expect(read).toHaveBeenCalledWith({
        contractId: CONTRACT_ID,
        method: 'get_pending_rewards',
        args: [WALLET]
      });
    });

    it('getPendingRewards uses the provided address when given', async () => {
      const { invoker, read } = createMockInvoker();
      const reward: VaultReward = { address: OTHER_ADDRESS, amount: 50n };
      read.mockResolvedValue(reward);

      const { result } = renderHook(() =>
        useVault({ contractId: CONTRACT_ID, invoker, walletAddress: WALLET })
      );

      await act(async () => {
        await expect(result.current.getPendingRewards(OTHER_ADDRESS)).resolves.toBe(reward);
      });

      expect(read).toHaveBeenCalledWith({
        contractId: CONTRACT_ID,
        method: 'get_pending_rewards',
        args: [OTHER_ADDRESS]
      });
    });
  });

  describe('write helpers', () => {
    it.each([
      {
        name: 'deposit',
        method: 'deposit',
        action: (result: ReturnType<typeof useVault>) => result.deposit(100n),
        expectedArgs: [WALLET, '100']
      },
      {
        name: 'withdraw',
        method: 'withdraw',
        action: (result: ReturnType<typeof useVault>) => result.withdraw(50n),
        expectedArgs: [WALLET, '50']
      },
      {
        name: 'claimRewards',
        method: 'claim_rewards',
        action: (result: ReturnType<typeof useVault>) => result.claimRewards(),
        expectedArgs: [WALLET]
      }
    ])(
      '$name returns the normalized transaction response',
      async ({ method, action, expectedArgs }) => {
        const { invoker, invoke } = createMockInvoker();
        invoke.mockResolvedValue(tx);

        const { result } = renderHook(() =>
          useVault({ contractId: CONTRACT_ID, invoker, walletAddress: WALLET })
        );

        await act(async () => {
          await expect(action(result.current)).resolves.toEqual(normalizedTx);
        });

        expect(invoke).toHaveBeenCalledWith({
          contractId: CONTRACT_ID,
          method,
          args: expectedArgs
        });
      }
    );

    it('returns normalized failed transaction result when status is FAILED', async () => {
      const { invoker, invoke } = createMockInvoker();
      const failedTx: VaultTransaction = { status: 'failed', hash: 'failed-hash' };
      invoke.mockResolvedValue(failedTx);

      const { result } = renderHook(() =>
        useVault({ contractId: CONTRACT_ID, invoker, walletAddress: WALLET })
      );

      await act(async () => {
        const actionResult = await result.current.deposit(100n);
        expect(actionResult).toEqual({
          status: 'failed',
          hash: 'failed-hash',
          raw: failedTx
        });
      });
    });

    it('sets error state when transaction results in non-terminal status', async () => {
      const { invoker, invoke } = createMockInvoker();
      const pendingTx: VaultTransaction = { status: 'pending', hash: 'pending-hash' };
      invoke.mockResolvedValue(pendingTx);

      const { result } = renderHook(() =>
        useVault({ contractId: CONTRACT_ID, invoker, walletAddress: WALLET })
      );

      await act(async () => {
        await expect(result.current.deposit(100n)).rejects.toThrow(
          'Transaction action resulted in non-terminal status: pending'
        );
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toContain('non-terminal status: pending');
    });

    it.each([
      { name: 'deposit', action: (result: ReturnType<typeof useVault>) => result.deposit(100n) },
      { name: 'withdraw', action: (result: ReturnType<typeof useVault>) => result.withdraw(50n) },
      {
        name: 'claimRewards',
        action: (result: ReturnType<typeof useVault>) => result.claimRewards()
      }
    ])('$name requires a wallet address', async ({ action }) => {
      const { invoker, invoke } = createMockInvoker();

      const { result } = renderHook(() => useVault({ contractId: CONTRACT_ID, invoker }));

      await act(async () => {
        await expect(action(result.current)).rejects.toThrow(
          'Connect a wallet before using vault write actions'
        );
      });

      expect(invoke).not.toHaveBeenCalled();
    });

    it('getBalance requires a wallet address when no address is provided', () => {
      const { invoker, invoke, read } = createMockInvoker();

      const { result } = renderHook(() => useVault({ contractId: CONTRACT_ID, invoker }));

      act(() => {
        expect(() => result.current.getBalance()).toThrow(
          'Connect a wallet before using vault write actions'
        );
      });

      expect(read).not.toHaveBeenCalled();
      expect(invoke).not.toHaveBeenCalled();
    });
  });

  describe('action state', () => {
    it('toggles isSubmitting while an action is in flight', async () => {
      const { invoker, invoke } = createMockInvoker();
      let resolveAction!: (value: VaultTransaction) => void;
      invoke.mockReturnValue(
        new Promise<VaultTransaction>((resolve) => {
          resolveAction = resolve;
        })
      );

      const { result } = renderHook(() =>
        useVault({ contractId: CONTRACT_ID, invoker, walletAddress: WALLET })
      );

      let promise!: Promise<TransactionActionResult>;
      act(() => {
        promise = result.current.deposit(100n);
      });

      expect(result.current.isSubmitting).toBe(true);

      await act(async () => {
        resolveAction(tx);
        await promise;
      });

      expect(result.current.isSubmitting).toBe(false);
    });

    it('stores action errors in state and clears them with resetError', async () => {
      const { invoker, invoke } = createMockInvoker();
      const boom = new Error('deposit failed');
      invoke.mockRejectedValue(boom);

      const { result } = renderHook(() =>
        useVault({ contractId: CONTRACT_ID, invoker, walletAddress: WALLET })
      );

      await act(async () => {
        await expect(result.current.deposit(100n)).rejects.toBe(boom);
      });

      expect(result.current.error).toBe(boom);

      act(() => {
        result.current.resetError();
      });

      expect(result.current.error).toBeNull();
    });

    it('wraps non-Error action failures as Error instances in state', async () => {
      const { invoker, invoke } = createMockInvoker();
      invoke.mockRejectedValue('string failure');

      const { result } = renderHook(() =>
        useVault({ contractId: CONTRACT_ID, invoker, walletAddress: WALLET })
      );

      await act(async () => {
        await expect(result.current.withdraw(50n)).rejects.toThrow('string failure');
      });

      expect(result.current.error).toBeInstanceOf(Error);
      expect(result.current.error?.message).toBe('string failure');
    });
  });
});
