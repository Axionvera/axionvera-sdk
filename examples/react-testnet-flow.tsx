import React, { useState, useEffect, useCallback } from 'react';
import { AxionveraProvider, useWallet, useVault, useTransactionStatus } from '@axionvera/react';
import { MockWalletConnector } from '@axionvera/core';
import type { ContractInvoker, TransactionResult, VaultInfo, VaultBalance } from '@axionvera/core';

// ------------------------------------------------------------------
// MOCKED CONFIGURATION & TESTNET-READY LIMITATIONS
// ------------------------------------------------------------------
// Note: This example uses mock data and mock wallet connections.
// Before moving to a real testnet or mainnet environment:
// 1. Replace MockWalletConnector with a real Soroban wallet connector (e.g. FreighterWalletConnector).
// 2. Replace mockContractInvoker with a real Soroban RPC ContractInvoker that signs and submits XDR.
// 3. Replace TESTNET_VAULT_CONTRACT_ID with the actual deployed contract ID.
// 4. Implement actual transaction lookup in `useTransactionStatus` poll callback.
// No real RPC or wallet secrets are used or required in this example.
// ------------------------------------------------------------------

const TESTNET_VAULT_CONTRACT_ID = 'CA3D5KRYMCMF2HBH7ACJWNXDRTJINPR72I265NVKTTHK42G6REK4NGSU';

const mockWalletConnector = new MockWalletConnector('GA2C5RFILTTTCGQIGNT7XQRHSMBXZBN7746CHMVBSYQ6OKPPN26L4BBS');

const mockContractInvoker: ContractInvoker = {
  async invokeRead({ method }) {
    if (method === 'get_info') {
      return {
        contractId: TESTNET_VAULT_CONTRACT_ID,
        totalDeposits: '1000000000',
        apy: '8.5%'
      };
    }
    if (method === 'get_balance') {
      return {
        stakedAmount: '250000000',
        unclaimedRewards: '1250000'
      };
    }
    return {};
  },
  async invokeWrite() {
    return {
      txHash: 'a1b2c3d4e5f67890abcdef1234567890abcdef1234567890abcdef1234567890',
      status: 'SUCCESS'
    };
  }
};

function TestnetFlowDashboard(): JSX.Element {
  const { publicKey, isConnected, isReady, connect, disconnect, error: walletError } = useWallet();
  const [depositAmount, setDepositAmount] = useState<string>('100');
  const [vaultInfo, setVaultInfo] = useState<VaultInfo | null>(null);
  const [balance, setBalance] = useState<VaultBalance | null>(null);

  // Vault write methods and read methods
  const {
    isSubmitting,
    error: vaultError,
    getInfo,
    getBalance,
    deposit,
    resetError
  } = useVault({
    contractId: TESTNET_VAULT_CONTRACT_ID,
    invoker: mockContractInvoker,
    walletAddress: publicKey
  });

  // Transaction status polling hook
  const { status: txStatus, isPolling, isSuccess, isError, poll, reset: resetTx } = useTransactionStatus();

  const loadData = useCallback(async () => {
    try {
      const info = await getInfo();
      setVaultInfo(info);

      if (isConnected && publicKey) {
        const userBal = await getBalance(publicKey);
        setBalance(userBal);
      }
    } catch (err) {
      console.error('Failed to load vault data:', err);
    }
  }, [isConnected, publicKey, getInfo, getBalance]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleDeposit = async () => {
    resetError();
    resetTx();

    try {
      // 1. Trigger Vault Write Flow
      const result = await deposit(depositAmount);
      
      // 2. Poll for transaction status (Mocked)
      if (result.txHash) {
        poll(result.txHash, async (hash) => {
          // Replace with real RPC lookup, e.g., fetch(`/api/tx/${hash}`)
          return { hash, status: 'success', ledger: 12345 } as TransactionResult;
        });
      }
      
      // 3. Refresh user data after submission mock
      if (publicKey) {
        const updated = await getBalance(publicKey);
        setBalance(updated);
      }
    } catch (err) {
      console.error('Deposit error:', err);
    }
  };

  return (
    <div style={{ maxWidth: 640, margin: '2rem auto', fontFamily: 'sans-serif', padding: '1.5rem', border: '1px solid #e2e8f0', borderRadius: 8 }}>
      <h2>Testnet Vault Flow</h2>
      <p style={{ fontSize: '0.875rem', color: '#64748b' }}>
        <em>Note: This is a mocked testnet-ready flow. Mocks should be replaced with real wallet and RPC implementations once testnet contract IDs are available. No real secrets are required.</em>
      </p>

      {/* Wallet Readiness */}
      <section style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f8fafc', borderRadius: 6 }}>
        <h3>Wallet Readiness</h3>
        <p><strong>Connected:</strong> {isConnected ? 'Yes' : 'No'}</p>
        <p><strong>Ready for actions:</strong> {isReady ? 'Yes' : 'No'}</p>
        {publicKey && <p><strong>Address:</strong> <code>{publicKey}</code></p>}
        {walletError && <p style={{ color: '#ef4444' }}><strong>Error:</strong> {walletError.message}</p>}

        {!isConnected ? (
          <button onClick={() => connect()} style={{ padding: '8px 16px', cursor: 'pointer' }}>
            Connect Wallet
          </button>
        ) : (
          <button onClick={() => disconnect()} style={{ padding: '8px 16px', cursor: 'pointer' }}>
            Disconnect
          </button>
        )}
      </section>

      {/* Vault Read Flow */}
      <section style={{ marginBottom: '1.5rem' }}>
        <h3>Vault Read Flow</h3>
        {vaultInfo ? (
          <div>
            <p><strong>Contract:</strong> <code>{vaultInfo.contractId}</code></p>
            <p><strong>Total Deposits:</strong> {vaultInfo.totalDeposits?.toString() ?? 'N/A'}</p>
            <p><strong>APY:</strong> {vaultInfo.apy ?? 'N/A'}</p>
          </div>
        ) : (
          <p>Loading vault metadata...</p>
        )}

        {isConnected && balance && (
          <div style={{ marginTop: '1rem' }}>
            <h4>Your Position</h4>
            <p><strong>Staked:</strong> {balance.stakedAmount?.toString() ?? '0'}</p>
            <p><strong>Pending Rewards:</strong> {balance.unclaimedRewards?.toString() ?? '0'}</p>
          </div>
        )}
      </section>

      {/* Vault Write Flow & Tx Status */}
      <section style={{ padding: '1rem', background: '#f8fafc', borderRadius: 6 }}>
        <h3>Vault Write Flow</h3>
        <div style={{ display: 'flex', gap: '8px', marginBottom: '1rem' }}>
          <input
            type="number"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            disabled={!isConnected || isSubmitting || isPolling}
            placeholder="Amount"
            style={{ padding: '8px', flex: 1 }}
          />
          <button
            onClick={handleDeposit}
            disabled={!isConnected || isSubmitting || isPolling || Number(depositAmount) <= 0}
            style={{ padding: '8px 16px', cursor: (isConnected && !isSubmitting && !isPolling) ? 'pointer' : 'not-allowed' }}
          >
            {isSubmitting ? 'Submitting...' : 'Deposit'}
          </button>
        </div>

        {/* Error Handling */}
        {vaultError && <p style={{ color: '#ef4444' }}>Vault Error: {vaultError.message}</p>}
        {isError && <p style={{ color: '#ef4444' }}>Transaction Error!</p>}
        
        {/* Transaction Status Handling */}
        {isPolling && <p style={{ color: '#eab308' }}>Polling transaction status...</p>}
        {isSuccess && <p style={{ color: '#16a34a' }}>Transaction confirmed! (Status: {txStatus})</p>}
      </section>
    </div>
  );
}

export function App(): JSX.Element {
  return (
    <AxionveraProvider wallet={mockWalletConnector}>
      <TestnetFlowDashboard />
    </AxionveraProvider>
  );
}

export default App;
