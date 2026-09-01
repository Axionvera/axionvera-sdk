/**
 * Wire VaultContract to a real-invoker-shaped dependency without RPC access.
 * Replace TestContractInvoker with a production ContractInvoker when the
 * maintainer-owned Soroban transaction implementation is available.
 */

import {
  TestContractInvoker,
  VaultContract,
  type VaultBalance,
  type VaultTransaction,
} from '../packages/core/src';

const contractId = 'CVAULTEXAMPLE';
const account = 'GUSEREXAMPLE';

const balance: VaultBalance = { address: account, amount: 500n };
const depositTransaction: VaultTransaction = {
  status: 'success',
  hash: 'mock-deposit-hash',
};

const invoker = new TestContractInvoker()
  .setReadResponse('get_balance', balance)
  .setInvokeResponse('deposit', depositTransaction);

const vault = new VaultContract({ contractId, invoker });

async function runExample(): Promise<void> {
  const currentBalance = await vault.getBalance(account);
  const depositResult = await vault.deposit(account, 100n);

  console.log({ currentBalance, depositResult });
  console.log(invoker.calls);
}

void runExample();
