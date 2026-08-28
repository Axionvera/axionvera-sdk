// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import React from 'react';
import { afterEach, describe, expect, it } from 'vitest';

import {
  MockWalletConnector,
  TestContractInvoker,
  type VaultBalance,
  type VaultInfo,
  type VaultReward,
  type VaultTransaction
} from '@axionvera/core';
import { AxionveraProvider } from './provider';
import { useVault } from './useVault';
import { useWallet } from './useWallet';

const CONTRACT_ID = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
const MOCK_PUBLIC_KEY = 'GAXIONVERAMOCKPUBLICKEY';

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
          walletAddress: walletResult.current.publicKey
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
          walletAddress: walletResult.current.publicKey
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
