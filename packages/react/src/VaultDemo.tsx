import { useEffect, useState } from 'react';
import { useVault, type UseVaultOptions } from './useVault';
import { useWallet } from './useWallet';
import type { VaultInfo, VaultBalance, VaultReward } from '@axionvera/core';

export interface VaultDemoProps {
  /** The contract ID of the vault to interact with */
  contractId: string;
  /** The SDK invoker to use (typically from context or options) */
  invoker: UseVaultOptions['invoker'];
}

/**
 * A React MVP demo workflow component for Axionvera SDK.
 * Shows wallet status, vault stats, user balance, and write actions.
 */
export function VaultDemo({ contractId, invoker }: VaultDemoProps) {
  const {
    isConnected,
    publicKey,
    connect,
    disconnect,
    isReady,
    readiness
  } = useWallet();

  const {
    getInfo,
    getBalance,
    getPendingRewards,
    deposit,
    withdraw,
    claimRewards,
    isSubmitting,
    error,
    resetError
  } = useVault({
    contractId,
    invoker,
    walletAddress: publicKey ?? null
  });

  const [vaultInfo, setVaultInfo] = useState<VaultInfo | null>(null);
  const [userBalance, setUserBalance] = useState<VaultBalance | null>(null);
  const [userRewards, setUserRewards] = useState<VaultReward | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);

  const refreshData = async () => {
    try {
      const info = await getInfo();
      setVaultInfo(info);

      if (publicKey) {
        const balance = await getBalance(publicKey);
        const rewards = await getPendingRewards(publicKey);
        setUserBalance(balance);
        setUserRewards(rewards);
      }
    } catch (_err) {
      console.error('Failed to fetch vault data', _err);
    }
  };

  useEffect(() => {
    refreshData();
  }, [publicKey, getInfo, getBalance, getPendingRewards]);

  const handleAction = async (action: () => Promise<any>) => {
    setTxHash(null);
    try {
      const result = await action();
      setTxHash(result.hash);
      await refreshData();
    } catch (_err) {
      // Error is handled by useVault's error state
    }
  };

  return (
    <div style={{ padding: '20px', border: '1px solid #ccc', borderRadius: '8px', maxWidth: '500px', fontFamily: 'sans-serif' }}>
      <h2>Axionvera Vault Demo</h2>

      {/* Wallet Section */}
      <section style={{ marginBottom: '20px' }}>
        <h3>Wallet Status</h3>
        {isConnected ? (
          <div>
            <p>Connected: <code title={publicKey ?? ''}>{publicKey?.slice(0, 6)}...{publicKey?.slice(-6)}</code></p>
            <p>Readiness: <strong>{isReady ? 'Ready' : readiness.reason ?? 'Not Ready'}</strong> {isReady ? '✅' : '❌'}</p>
            <button onClick={() => disconnect()}>Disconnect</button>
          </div>
        ) : (
          <button onClick={() => connect()}>Connect Wallet</button>
        )}
      </section>

      {/* Vault Stats Section */}
      <section style={{ marginBottom: '20px' }}>
        <h3>Vault Statistics</h3>
        {vaultInfo ? (
          <ul>
            <li>Asset: {vaultInfo.assetCode || 'Unknown'}</li>
            <li>Total Deposits: {vaultInfo.totalDeposits?.toString() || '0'}</li>
            <li>Reward Pool: {vaultInfo.rewardPool?.toString() || '0'}</li>
          </ul>
        ) : (
          <p>Loading vault info...</p>
        )}
      </section>

      {/* User Balance Section */}
      {isConnected && (
        <section style={{ marginBottom: '20px' }}>
          <h3>My Position</h3>
          <ul>
            <li>Balance: {userBalance?.amount.toString() || '0'}</li>
            <li>Pending Rewards: {userRewards?.amount.toString() || '0'}</li>
          </ul>
        </section>
      )}

      {/* Actions Section */}
      <section style={{ marginBottom: '20px' }}>
        <h3>Actions</h3>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button 
            disabled={!isReady || isSubmitting} 
            onClick={() => handleAction(() => deposit(100))}
          >
            Deposit 100
          </button>
          <button 
            disabled={!isReady || isSubmitting} 
            onClick={() => handleAction(() => withdraw(50))}
          >
            Withdraw 50
          </button>
          <button 
            disabled={!isReady || isSubmitting} 
            onClick={() => handleAction(() => claimRewards())}
          >
            Claim Rewards
          </button>
        </div>
      </section>

      {/* Transaction Status */}
      {(isSubmitting || txHash || error) && (
        <section style={{ padding: '10px', backgroundColor: '#f9f9f9', borderRadius: '4px' }}>
          <h4>Status</h4>
          {isSubmitting && <p>⏳ Submitting transaction...</p>}
          {txHash && (
            <p style={{ color: 'green' }}>
              ✅ Success! Hash: <a href={`#${txHash}`}>{txHash.slice(0, 8)}...</a>
            </p>
          )}
          {error && (
            <div style={{ color: 'red' }}>
              <p>❌ Error: {error.message}</p>
              <button onClick={resetError}>Dismiss</button>
            </div>
          )}
        </section>
      )}
      
      <div style={{ marginTop: '20px', fontSize: '0.8em', color: '#666' }}>
        <p>Note: This is a demo component. Real dashboards can adapt this flow.</p>
      </div>
    </div>
  );
}
