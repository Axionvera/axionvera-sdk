import React, { useState, useEffect, useCallback } from 'react';
import { AxionveraProvider, useWallet, useVault } from '@axionvera/react';
import type { WalletConnector, ContractInvoker, VaultInfo, VaultBalance } from '@axionvera/core';

// Mock connector for demonstration and local testing
// In production, provide an actual Soroban wallet connector (e.g. Freighter)
const mockWalletConnector: WalletConnector = {
  name: 'Demo Wallet',
  async connect() {
    return {
      publicKey: 'GA2C5RFILTTTCGQIGNT7XQRHSMBXZBN7746CHMVBSYQ6OKPPN26L4BBS',
      network: 'testnet'
    };
  },
  async disconnect() {
    // Teardown session state if necessary
  }
};

// Mock invoker for demonstration
// In production, supply a configured Soroban RPC ContractInvoker
const mockContractInvoker: ContractInvoker = {
  async invokeRead({ method }) {
    if (method === 'get_info') {
      return {
        contractId: 'CA3D5KRYMCMF2HBH7ACJWNXDRTJINPR72I265NVKTTHK42G6REK4NGSU',
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

const VAULT_CONTRACT_ID = 'CA3D5KRYMCMF2HBH7ACJWNXDRTJINPR72I265NVKTTHK42G6REK4NGSU';

function VaultDashboard(): JSX.Element {
  const { publicKey, isConnected, isReady, connect, disconnect, error: walletError } = useWallet();
  const [depositAmount, setDepositAmount] = useState<string>('100');
  const [vaultInfo, setVaultInfo] = useState<VaultInfo | null>(null);
  const [balance, setBalance] = useState<VaultBalance | null>(null);
  const [txMessage, setTxMessage] = useState<string | null>(null);

  const {
    isSubmitting,
    error: vaultError,
    getInfo,
    getBalance,
    deposit,
    resetError
  } = useVault({
    contractId: VAULT_CONTRACT_ID,
    invoker: mockContractInvoker,
    walletAddress: publicKey
  });

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
    setTxMessage(null);
    resetError();

    try {
      const result = await deposit(depositAmount);
      setTxMessage(`Deposit submitted successfully! Tx: ${result.txHash ?? 'N/A'}`);
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
      <h2>Axionvera Vault Demo</h2>
      <p style={{ fontSize: '0.875rem', color: '#64748b' }}>
        <em>Note: Operating in simulated/mock mode. Replace mocks with live Soroban RPC connectors for on-chain submission.</em>
      </p>

      {/* Wallet Connection */}
      <section style={{ marginBottom: '1.5rem', padding: '1rem', background: '#f8fafc', borderRadius: 6 }}>
        <h3>Wallet Status</h3>
        <p><strong>Connected:</strong> {isConnected ? 'Yes' : 'No'}</p>
        <p><strong>Ready:</strong> {isReady ? 'Yes' : 'No'}</p>
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

      {/* Vault Read Data */}
      <section style={{ marginBottom: '1.5rem' }}>
        <h3>Vault Details</h3>
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

      {/* Vault Write Action */}
      <section style={{ padding: '1rem', background: '#f8fafc', borderRadius: 6 }}>
        <h3>Deposit to Vault</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          <input
            type="number"
            value={depositAmount}
            onChange={(e) => setDepositAmount(e.target.value)}
            disabled={!isConnected || isSubmitting}
            placeholder="Amount"
            style={{ padding: '8px', flex: 1 }}
          />
          <button
            onClick={handleDeposit}
            disabled={!isConnected || isSubmitting || Number(depositAmount) <= 0}
            style={{ padding: '8px 16px', cursor: isConnected ? 'pointer' : 'not-allowed' }}
          >
            {isSubmitting ? 'Submitting...' : 'Deposit'}
          </button>
        </div>

        {vaultError && <p style={{ color: '#ef4444', marginTop: '0.5rem' }}>{vaultError.message}</p>}
        {txMessage && <p style={{ color: '#16a34a', marginTop: '0.5rem' }}>{txMessage}</p>}
      </section>
    </div>
  );
}

export function App(): JSX.Element {
  return (
    <AxionveraProvider wallet={mockWalletConnector}>
      <VaultDashboard />
    </AxionveraProvider>
  );
}

export default App;