// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { MockWalletConnector, TestContractInvoker } from '@axionvera/core';
import { AxionveraProvider } from './provider';
import { VaultDemo } from './VaultDemo';
import { MOCK_USER_BALANCE, MOCK_USER_REWARD, MOCK_VAULT_INFO } from './testing/fixtures/vaultDemo';

describe('VaultDemo Component', () => {
  const contractId = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

  afterEach(() => {
    cleanup();
  });

  const setup = async (walletConnected = false) => {
    const invoker = new TestContractInvoker();
    const wallet = new MockWalletConnector();

    // Vault info method variants
    invoker.setReadResponse('getInfo', MOCK_VAULT_INFO);
    invoker.setReadResponse('get_info', MOCK_VAULT_INFO);

    // User balance method variants
    invoker.setReadResponse('getBalance', MOCK_USER_BALANCE);
    invoker.setReadResponse('get_balance', MOCK_USER_BALANCE);
    invoker.setReadResponse('getUserBalance', MOCK_USER_BALANCE);
    invoker.setReadResponse('get_user_balance', MOCK_USER_BALANCE);
    invoker.setReadResponse('balance', MOCK_USER_BALANCE);
    invoker.setReadResponse('user_balance', MOCK_USER_BALANCE);

    // Pending reward method variants
    invoker.setReadResponse('getPendingRewards', MOCK_USER_REWARD);
    invoker.setReadResponse('get_pending_rewards', MOCK_USER_REWARD);
    invoker.setReadResponse('pendingRewards', MOCK_USER_REWARD);
    invoker.setReadResponse('pending_rewards', MOCK_USER_REWARD);

    invoker.setInvokeResponse('deposit', { hash: 'tx-deposit', status: 'success' });
    invoker.setInvokeResponse('withdraw', { hash: 'tx-withdraw', status: 'success' });
    invoker.setInvokeResponse('claim_rewards', { hash: 'tx-claim', status: 'success' });
    invoker.setInvokeResponse('claimRewards', { hash: 'tx-claim', status: 'success' });

    const utils = render(
      <AxionveraProvider invoker={invoker} wallet={wallet}>
        <VaultDemo contractId={contractId} invoker={invoker} />
      </AxionveraProvider>
    );

    if (walletConnected) {
      fireEvent.click(screen.getByRole('button', { name: /connect wallet/i }));

      await waitFor(() => {
        const depositBtn = screen.getByRole('button', { name: /deposit 100/i });
        expect((depositBtn as HTMLButtonElement).disabled).toBe(false);
      });
    }

    return { ...utils, invoker, wallet };
  };

  it('renders wallet status correctly when disconnected', async () => {
    await setup(false);

    expect(screen.getByText('Wallet Status')).toBeDefined();
    expect(screen.getByRole('button', { name: /connect wallet/i })).toBeDefined();
  });

  it('renders vault statistics correctly', async () => {
    await setup(false);

    await waitFor(() => {
      expect(screen.getByText(`Asset: ${MOCK_VAULT_INFO.assetCode}`)).toBeDefined();
      expect(screen.getByText(`Total Deposits: ${MOCK_VAULT_INFO.totalDeposits}`)).toBeDefined();
    });
  });

  it('renders user position when wallet is connected', async () => {
    await setup(true);

    await waitFor(() => {
      expect(screen.getByText(`Balance: ${MOCK_USER_BALANCE.amount}`)).toBeDefined();
      expect(screen.getByText(`Pending Rewards: ${MOCK_USER_REWARD.amount}`)).toBeDefined();
    });
  });

  it('enables actions when wallet is ready', async () => {
    await setup(true);

    const depositBtn = screen.getByRole('button', { name: /deposit 100/i });
    expect((depositBtn as HTMLButtonElement).disabled).toBe(false);
  });

  it('shows submitting and success status on action', async () => {
    await setup(true);

    const depositBtn = await screen.findByRole('button', { name: /deposit 100/i });
    expect((depositBtn as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(depositBtn);

    await waitFor(() => {
      expect(screen.getByText(/success! hash:/i)).toBeDefined();

      const txLink = screen.getByRole('link', { name: /tx-depos/i });
      expect((txLink as HTMLAnchorElement).getAttribute('href')).toBe('#tx-deposit');
    });
  });

  it('handles and displays errors correctly', async () => {
    const setupResult = await setup(true);

    setupResult.invoker.failOnInvoke(new Error('Network failure'));

    const depositBtn = await screen.findByRole('button', { name: /deposit 100/i });
    expect((depositBtn as HTMLButtonElement).disabled).toBe(false);

    fireEvent.click(depositBtn);

    await waitFor(() => {
      expect(screen.getByText(/error: network failure/i)).toBeDefined();
    });

    const dismissBtn = screen.getByRole('button', { name: /dismiss/i });
    fireEvent.click(dismissBtn);

    expect(screen.queryByText(/error: network failure/i)).toBeNull();
  });
});
