// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  MockWalletConnector,
  TestContractInvoker,
  type VaultBalance,
  type VaultInfo,
  type VaultReward,
  type VaultTransaction,
  type TransactionResult
} from '@axionvera/core';
import { AxionveraProvider } from './provider';
import { useVault } from './useVault';
import { useWallet } from './useWallet';
import { useTransactionStatus } from './useTransactionStatus';

const CONTRACT_ID = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const MOCK_PUBLIC_KEY = "GSDKWORKFLOWWALLETADDRESS";

describe('Vault SDK Workflow (Mocked Integration)', () => {
  afterEach(() => {
    cleanup();
  });

  it('simulates a full vault workflow: connect -> read -> write', async () => {
    // 1. Setup mocked infrastructure
    const invoker = new TestContractInvoker();
    const wallet = new MockWalletConnector(MOCK_PUBLIC_KEY);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AxionveraProvider wallet={wallet}>{children}</AxionveraProvider>
    );

    // 2. Initialize hooks
    const { result: walletResult } = renderHook(() => useWallet(), { wrapper });
    const { result: vaultResult } = renderHook(
      () =>
        useVault({
          contractId: CONTRACT_ID,
          invoker,
          walletAddress: "GSDKWORKFLOWWALLETADDRESS"
        }),
      { wrapper }
    );

    // 3. Connect Wallet
    expect(walletResult.current.isConnected).toBe(false);
    await act(async () => {
      await walletResult.current.connect();
    });
    expect(walletResult.current.isConnected).toBe(true);
    expect(walletResult.current.publicKey).toBe(MOCK_PUBLIC_KEY);

    // 4. Read Vault State
    const mockInfo: VaultInfo = {
      contractId: CONTRACT_ID,
      assetCode: 'USDC',
      totalDeposits: 1000000n
    };
    const mockBalance: VaultBalance = { address: MOCK_PUBLIC_KEY, amount: 500n };
    const mockRewards: VaultReward = { address: MOCK_PUBLIC_KEY, amount: 50n };

    invoker
      .setReadResponse('get_info', mockInfo)
      .setReadResponse('get_balance', mockBalance)
      .setReadResponse('get_pending_rewards', mockRewards);

    await act(async () => {
      const info = await vaultResult.current.getInfo();
      const balance = await vaultResult.current.getBalance();
      const rewards = await vaultResult.current.getPendingRewards();

      expect(info).toEqual(mockInfo);
      expect(balance).toEqual(mockBalance);
      expect(rewards).toEqual(mockRewards);
    });

    // 5. Write Actions (Deposit)
    const depositTx: VaultTransaction = { hash: 'tx-deposit-123', status: 'success' };
    invoker.setInvokeResponse('deposit', depositTx);

    await act(async () => {
      const result = await vaultResult.current.deposit(100n);
      expect(result.status).toBe('success');
      expect(result.hash).toBe('tx-deposit-123');
      expect(result.raw).toBe(depositTx);
    });

    // 6. Write Actions (Withdraw)
    const withdrawTx: VaultTransaction = { hash: 'tx-withdraw-456', status: 'success' };
    invoker.setInvokeResponse('withdraw', withdrawTx);

    await act(async () => {
      const result = await vaultResult.current.withdraw(50n);
      expect(result.status).toBe('success');
      expect(result.hash).toBe('tx-withdraw-456');
      expect(result.raw).toBe(withdrawTx);
    });

    // 7. Write Actions (Claim Rewards)
    const claimTx: VaultTransaction = { hash: 'tx-claim-789', status: 'success' };
    invoker.setInvokeResponse('claim_rewards', claimTx);

    await act(async () => {
      const result = await vaultResult.current.claimRewards();
      expect(result.status).toBe('success');
      expect(result.hash).toBe('tx-claim-789');
      expect(result.raw).toBe(claimTx);
    });

    // 8. Observe Invoker Calls
    expect(invoker.calls).toHaveLength(6);
    expect(invoker.calls[0]).toMatchObject({ kind: 'read', method: 'get_info' });
    expect(invoker.calls[3]).toMatchObject({ kind: 'invoke', method: 'deposit', args: [MOCK_PUBLIC_KEY, '100'] });
  });

  it('simulates transaction polling workflow with useTransactionStatus', async () => {
    vi.useFakeTimers();

    const invoker = new TestContractInvoker();
    const wallet = new MockWalletConnector(MOCK_PUBLIC_KEY);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AxionveraProvider wallet={wallet}>{children}</AxionveraProvider>
    );

    const { result: walletResult } = renderHook(() => useWallet(), { wrapper });
    const { result: vaultResult } = renderHook(
      () =>
        useVault({
          contractId: CONTRACT_ID,
          invoker,
          walletAddress: MOCK_PUBLIC_KEY
        }),
      { wrapper }
    );
    const { result: statusResult } = renderHook(() => useTransactionStatus(), { wrapper });

    // Connect wallet
    await act(async () => {
      await walletResult.current.connect();
    });

    // Setup deposit transaction
    const depositTx: VaultTransaction = { hash: 'tx-deposit-polling', status: 'success' };
    invoker.setInvokeResponse('deposit', depositTx);

    // Execute deposit
    await act(async () => {
      const depositResult = await vaultResult.current.deposit(100n);
      expect(depositResult.hash).toBe('tx-deposit-polling');
    });

    // Poll for transaction status
    const mockLookup = vi.fn().mockImplementation(async (hash: string) => {
      if (hash === 'tx-deposit-polling') {
        return { hash, status: 'success' } as TransactionResult;
      }
      return { hash, status: 'not_found' } as TransactionResult;
    });

    act(() => {
      statusResult.current.poll('tx-deposit-polling', mockLookup);
    });

    expect(statusResult.current.status).toBe('polling');

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(statusResult.current.status).toBe('success');
    expect(statusResult.current.result?.hash).toBe('tx-deposit-polling');

    vi.useRealTimers();
  });

  it('handles workflow with wallet disconnection and reconnection', async () => {
    const invoker = new TestContractInvoker();
    const wallet = new MockWalletConnector(MOCK_PUBLIC_KEY);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AxionveraProvider wallet={wallet}>{children}</AxionveraProvider>
    );

    const { result: walletResult } = renderHook(() => useWallet(), { wrapper });
    const { result: vaultResult } = renderHook(
      () =>
        useVault({
          contractId: CONTRACT_ID,
          invoker,
          walletAddress: MOCK_PUBLIC_KEY
        }),
      { wrapper }
    );

    // Connect wallet
    await act(async () => {
      await walletResult.current.connect();
    });
    expect(walletResult.current.isConnected).toBe(true);

    // Perform read operations
    const mockInfo: VaultInfo = {
      contractId: CONTRACT_ID,
      assetCode: 'USDC',
      totalDeposits: 1000000n
    };
    invoker.setReadResponse('get_info', mockInfo);

    await act(async () => {
      const info = await vaultResult.current.getInfo();
      expect(info).toEqual(mockInfo);
    });

    // Disconnect wallet
    await act(async () => {
      await walletResult.current.disconnect();
    });
    expect(walletResult.current.isConnected).toBe(false);

    // Attempt write operation should fail due to no mock response
    await act(async () => {
      await expect(vaultResult.current.deposit(100n)).rejects.toThrow('No invoke response');
    });

    // Reconnect wallet
    await act(async () => {
      await walletResult.current.connect();
    });
    expect(walletResult.current.isConnected).toBe(true);

    // Write operation should succeed after reconnection
    const depositTx: VaultTransaction = { hash: 'tx-after-reconnect', status: 'success' };
    invoker.setInvokeResponse('deposit', depositTx);

    await act(async () => {
      const result = await vaultResult.current.deposit(100n);
      expect(result.status).toBe('success');
      expect(result.hash).toBe('tx-after-reconnect');
    });
  });

  it('handles workflow with multiple sequential transactions', async () => {
    const invoker = new TestContractInvoker();
    const wallet = new MockWalletConnector(MOCK_PUBLIC_KEY);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AxionveraProvider wallet={wallet}>{children}</AxionveraProvider>
    );

    const { result: walletResult } = renderHook(() => useWallet(), { wrapper });
    const { result: vaultResult } = renderHook(
      () =>
        useVault({
          contractId: CONTRACT_ID,
          invoker,
          walletAddress: MOCK_PUBLIC_KEY
        }),
      { wrapper }
    );

    await act(async () => {
      await walletResult.current.connect();
    });

    // First deposit
    const depositTx1: VaultTransaction = { hash: 'tx-deposit-1', status: 'success' };
    invoker.setInvokeResponse('deposit', depositTx1);

    await act(async () => {
      const result = await vaultResult.current.deposit(100n);
      expect(result.hash).toBe('tx-deposit-1');
    });

    // Second deposit
    const depositTx2: VaultTransaction = { hash: 'tx-deposit-2', status: 'success' };
    invoker.setInvokeResponse('deposit', depositTx2);

    await act(async () => {
      const result = await vaultResult.current.deposit(200n);
      expect(result.hash).toBe('tx-deposit-2');
    });

    // Withdraw
    const withdrawTx: VaultTransaction = { hash: 'tx-withdraw', status: 'success' };
    invoker.setInvokeResponse('withdraw', withdrawTx);

    await act(async () => {
      const result = await vaultResult.current.withdraw(50n);
      expect(result.hash).toBe('tx-withdraw');
    });

    // Claim rewards
    const claimTx: VaultTransaction = { hash: 'tx-claim', status: 'success' };
    invoker.setInvokeResponse('claim_rewards', claimTx);

    await act(async () => {
      const result = await vaultResult.current.claimRewards();
      expect(result.hash).toBe('tx-claim');
    });

    // Verify all transactions were called
    expect(invoker.calls).toHaveLength(4);
    expect(invoker.calls[0].method).toBe('deposit');
    expect(invoker.calls[1].method).toBe('deposit');
    expect(invoker.calls[2].method).toBe('withdraw');
    expect(invoker.calls[3].method).toBe('claim_rewards');
  });

  it('handles workflow with transaction timeout during polling', async () => {
    vi.useFakeTimers();

    const invoker = new TestContractInvoker();
    const wallet = new MockWalletConnector(MOCK_PUBLIC_KEY);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AxionveraProvider wallet={wallet}>{children}</AxionveraProvider>
    );

    const { result: walletResult } = renderHook(() => useWallet(), { wrapper });
    const { result: vaultResult } = renderHook(
      () =>
        useVault({
          contractId: CONTRACT_ID,
          invoker,
          walletAddress: MOCK_PUBLIC_KEY
        }),
      { wrapper }
    );
    const { result: statusResult } = renderHook(() => useTransactionStatus(), { wrapper });

    await act(async () => {
      await walletResult.current.connect();
    });

    const depositTx: VaultTransaction = { hash: 'tx-timeout-test', status: 'success' };
    invoker.setInvokeResponse('deposit', depositTx);

    await act(async () => {
      await vaultResult.current.deposit(100n);
    });

    // Mock lookup that always returns pending
    const mockLookup = vi.fn().mockResolvedValue({
      hash: 'tx-timeout-test',
      status: 'pending'
    } as TransactionResult);

    act(() => {
      statusResult.current.poll('tx-timeout-test', mockLookup);
    });

    // Advance through all polling attempts to trigger timeout
    for (let i = 0; i < 30; i++) {
      await act(async () => {
        await vi.advanceTimersByTimeAsync(1000);
      });
    }

    expect(statusResult.current.status).toBe('timeout');
    expect(statusResult.current.isTimeout).toBe(true);
    expect(statusResult.current.error).not.toBeNull();

    vi.useRealTimers();
  });

  it('handles failed transactions in the workflow', async () => {
    const invoker = new TestContractInvoker();
    const wallet = new MockWalletConnector(MOCK_PUBLIC_KEY);

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AxionveraProvider wallet={wallet}>{children}</AxionveraProvider>
    );

    const { result: walletResult } = renderHook(() => useWallet(), { wrapper });
    
    await act(async () => {
      await walletResult.current.connect();
    });

    const { result: vaultResult } = renderHook(
      () =>
        useVault({
          contractId: CONTRACT_ID,
          invoker,
          walletAddress: "GSDKWORKFLOWWALLETADDRESS"
        }),
      { wrapper }
    );

    const failedTx: VaultTransaction = { hash: 'tx-failed', status: 'failed' };
    invoker.setInvokeResponse('deposit', failedTx);

    await act(async () => {
      const result = await vaultResult.current.deposit(100n);
      expect(result.status).toBe('failed');
      expect(result.hash).toBe('tx-failed');
    });
  });
});
