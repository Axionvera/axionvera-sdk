import React from 'react';
import { AxionveraProvider, VaultDemo } from '@axionvera/react';
import { TestContractInvoker, MockWalletConnector } from '@axionvera/core';
import { MOCK_VAULT_INFO, MOCK_USER_BALANCE, MOCK_USER_REWARD } from '../packages/react/src/testing/fixtures/vaultDemo';

/**
 * A standalone example demonstrating the VaultDemo component.
 * This can be run in a local React development environment.
 */
export function MvpDemoExample() {
  // 1. Setup mock infrastructure
  const invoker = new TestContractInvoker();
  const wallet = new MockWalletConnector('GBABC123...');

  // 2. Pre-fill mock data for the demo
  invoker.setReadResponse('getInfo', MOCK_VAULT_INFO);
  invoker.setReadResponse('getBalance', MOCK_USER_BALANCE);
  invoker.setReadResponse('getPendingRewards', MOCK_USER_REWARD);
  
  // Simulate successful transactions
  invoker.setInvokeResponse('deposit', { hash: 'demo-tx-hash-123', status: 'success' });
  invoker.setInvokeResponse('withdraw', { hash: 'demo-tx-hash-456', status: 'success' });
  invoker.setInvokeResponse('claimRewards', { hash: 'demo-tx-hash-789', status: 'success' });

  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: '50px' }}>
      <AxionveraProvider invoker={invoker} wallet={wallet}>
        <VaultDemo 
          contractId={MOCK_VAULT_INFO.contractId} 
          invoker={invoker} 
        />
      </AxionveraProvider>
    </div>
  );
}
