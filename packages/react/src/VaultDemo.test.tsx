import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { VaultDemo } from './VaultDemo';
import { AxionveraProvider } from './provider';
import { TestContractInvoker, MockWalletConnector } from '@axionvera/core';
import { MOCK_VAULT_INFO, MOCK_USER_BALANCE, MOCK_USER_REWARD } from './testing/fixtures/vaultDemo';

describe('VaultDemo Component', () => {
  const contractId = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';
  
  const setup = (walletConnected = false) => {
    const invoker = new TestContractInvoker();
    const wallet = new MockWalletConnector();
    
    // Mock invoker responses
    invoker.setReadResponse('getInfo', MOCK_VAULT_INFO);
    invoker.setReadResponse('getBalance', MOCK_USER_BALANCE);
    invoker.setReadResponse('getPendingRewards', MOCK_USER_REWARD);
    invoker.setInvokeResponse('deposit', { hash: 'tx-deposit', status: 'success' });

    if (walletConnected) {
      wallet.connect();
    }

    const utils = render(
      <AxionveraProvider invoker={invoker} wallet={wallet}>
        <VaultDemo contractId={contractId} invoker={invoker} />
      </AxionveraProvider>
    );

    return { ...utils, invoker, wallet };
  };

  it('renders wallet status correctly when disconnected', () => {
    setup(false);
    expect(screen.getByText('Wallet Status')).toBeDefined();
    expect(screen.getByRole('button', { name: /connect wallet/i })).toBeDefined();
  });

  it('renders vault statistics correctly', async () => {
    setup(false);
    await waitFor(() => {
      expect(screen.getByText(`Asset: ${MOCK_VAULT_INFO.assetCode}`)).toBeDefined();
      expect(screen.getByText(`Total Deposits: ${MOCK_VAULT_INFO.totalDeposits}`)).toBeDefined();
    });
  });

  it('renders user position when wallet is connected', async () => {
    setup(true);
    await waitFor(() => {
      expect(screen.getByText(`Balance: ${MOCK_USER_BALANCE.amount}`)).toBeDefined();
      expect(screen.getByText(`Pending Rewards: ${MOCK_USER_REWARD.amount}`)).toBeDefined();
    });
  });

  it('enables actions when wallet is ready', async () => {
    setup(true);
    await waitFor(() => {
      const depositBtn = screen.getByRole('button', { name: /deposit 100/i });
      expect(depositBtn).not.toBeDisabled();
    });
  });

  it('shows submitting and success status on action', async () => {
    const { invoker } = setup(true);
    
    const depositBtn = await screen.findByRole('button', { name: /deposit 100/i });
    fireEvent.click(depositBtn);

    expect(screen.getByText(/submitting transaction/i)).toBeDefined();

    await waitFor(() => {
      expect(screen.getByText(/success! hash: tx-depos/i)).toBeDefined();
    });
  });

  it('handles and displays errors correctly', async () => {
    const { invoker } = setup(true);
    
    // Force an error for the next invoke
    invoker.setInvokeResponse('deposit', new Error('Network failure'));

    const depositBtn = await screen.findByRole('button', { name: /deposit 100/i });
    fireEvent.click(depositBtn);

    await waitFor(() => {
      expect(screen.getByText(/error: network failure/i)).toBeDefined();
    });

    const dismissBtn = screen.getByRole('button', { name: /dismiss/i });
    fireEvent.click(dismissBtn);

    expect(screen.queryByText(/error: network failure/i)).toBeNull();
  });
});
