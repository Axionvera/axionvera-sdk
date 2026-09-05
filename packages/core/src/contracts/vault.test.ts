import { describe, expect, it, vi } from 'vitest';

import { ContractError, ValidationError } from '../errors';
import { TestContractInvoker } from '../testing/testInvoker';
import type { VaultBalance, VaultInfo, VaultReward, VaultTransaction } from '../types';
import { VaultContract, type ContractInvoker } from './vault';

const CONTRACT_ID = 'vault-contract-id';
const ADDRESS = 'GABC1234567890';
const RECIPIENT = 'GXYZ9876543210';

function createContract(invoker: ContractInvoker): VaultContract {
  return new VaultContract({ contractId: CONTRACT_ID, invoker });
}

describe('VaultContract real-invoker readiness', () => {
  describe('read methods', () => {
    it('sends the exact getInfo request and returns the decoded response', async () => {
      const info: VaultInfo = { contractId: CONTRACT_ID, totalDeposits: 500n };
      const invoker = new TestContractInvoker().setReadResponse('get_info', info);

      const result = await createContract(invoker).getInfo();

      expect(invoker.calls).toEqual([
        {
          kind: 'read',
          contractId: CONTRACT_ID,
          method: 'get_info',
          args: [],
        },
      ]);
      expect(result).toBe(info);
    });

    it('sends the exact getBalance request with its argument in order', async () => {
      const balance: VaultBalance = { address: ADDRESS, amount: 100n };
      const invoker = new TestContractInvoker().setReadResponse('get_balance', balance);

      const result = await createContract(invoker).getBalance(ADDRESS);

      expect(invoker.calls).toEqual([
        {
          kind: 'read',
          contractId: CONTRACT_ID,
          method: 'get_balance',
          args: [ADDRESS],
        },
      ]);
      expect(result).toBe(balance);
    });

    it('sends the exact getPendingRewards request with its argument in order', async () => {
      const reward: VaultReward = { address: ADDRESS, amount: 50n };
      const invoker = new TestContractInvoker().setReadResponse('get_pending_rewards', reward);

      const result = await createContract(invoker).getPendingRewards(ADDRESS);

      expect(invoker.calls).toEqual([
        {
          kind: 'read',
          contractId: CONTRACT_ID,
          method: 'get_pending_rewards',
          args: [ADDRESS],
        },
      ]);
      expect(result).toBe(reward);
    });

    it('falls back to invoke with the same request when read is unavailable', async () => {
      const info: VaultInfo = { contractId: CONTRACT_ID };
      const adapter = new TestContractInvoker().setInvokeResponse('get_info', info);
      const invokeOnly: ContractInvoker = {
        invoke: adapter.invoke.bind(adapter),
      };

      const result = await createContract(invokeOnly).getInfo();

      expect(adapter.calls).toEqual([
        {
          kind: 'invoke',
          contractId: CONTRACT_ID,
          method: 'get_info',
          args: [],
        },
      ]);
      expect(result).toBe(info);
    });
  });

  describe('write methods', () => {
    it('sends the exact deposit request and converts bigint amounts to strings', async () => {
      const transaction: VaultTransaction = { status: 'success', hash: 'deposit-hash' };
      const invoker = new TestContractInvoker().setInvokeResponse('deposit', transaction);

      const result = await createContract(invoker).deposit(ADDRESS, 100n);

      expect(invoker.calls).toEqual([
        {
          kind: 'invoke',
          contractId: CONTRACT_ID,
          method: 'deposit',
          args: [ADDRESS, '100'],
        },
      ]);
      expect(result).toBe(transaction);
    });

    it('normalizes string and number deposit amounts to the same ordered args', async () => {
      const transaction: VaultTransaction = { status: 'pending' };
      const invoker = new TestContractInvoker().setInvokeResponse('deposit', transaction);
      const contract = createContract(invoker);

      await contract.deposit(ADDRESS, '250');
      await contract.deposit(ADDRESS, 250);

      expect(invoker.calls).toEqual([
        {
          kind: 'invoke',
          contractId: CONTRACT_ID,
          method: 'deposit',
          args: [ADDRESS, '250'],
        },
        {
          kind: 'invoke',
          contractId: CONTRACT_ID,
          method: 'deposit',
          args: [ADDRESS, '250'],
        },
      ]);
    });

    it('rejects invalid deposit amounts before the adapter is called', async () => {
      const invoker = new TestContractInvoker();
      const contract = createContract(invoker);

      await expect(contract.deposit(ADDRESS, 0n)).rejects.toThrow(ValidationError);
      await expect(contract.deposit(ADDRESS, -5n)).rejects.toThrow(ValidationError);

      expect(invoker.calls).toEqual([]);
    });

    it('sends the exact withdraw request and converts the amount to a string', async () => {
      const transaction: VaultTransaction = { status: 'success', hash: 'withdraw-hash' };
      const invoker = new TestContractInvoker().setInvokeResponse('withdraw', transaction);

      const result = await createContract(invoker).withdraw(RECIPIENT, 250n);

      expect(invoker.calls).toEqual([
        {
          kind: 'invoke',
          contractId: CONTRACT_ID,
          method: 'withdraw',
          args: [RECIPIENT, '250'],
        },
      ]);
      expect(result).toBe(transaction);
    });

    it('rejects invalid withdraw amounts before the adapter is called', async () => {
      const invoker = new TestContractInvoker();
      const contract = createContract(invoker);

      await expect(contract.withdraw(RECIPIENT, '0')).rejects.toThrow(ValidationError);
      await expect(contract.withdraw(RECIPIENT, '-10')).rejects.toThrow(ValidationError);

      expect(invoker.calls).toEqual([]);
    });

    it('sends the exact claimRewards request with its argument in order', async () => {
      const transaction: VaultTransaction = { status: 'success', hash: 'claim-hash' };
      const invoker = new TestContractInvoker().setInvokeResponse('claim_rewards', transaction);

      const result = await createContract(invoker).claimRewards(ADDRESS);

      expect(invoker.calls).toEqual([
        {
          kind: 'invoke',
          contractId: CONTRACT_ID,
          method: 'claim_rewards',
          args: [ADDRESS],
        },
      ]);
      expect(result).toBe(transaction);
    });
  });

  describe('result mapping', () => {
    it('passes a scripted successful transaction result through unchanged', async () => {
      const success: VaultTransaction = {
        status: 'success',
        hash: 'success-hash',
        raw: { ledger: 123 },
      };
      const invoker = new TestContractInvoker().setInvokeResponse('deposit', success);

      const result = await createContract(invoker).deposit(ADDRESS, 10n);

      expect(result).toBe(success);
    });

    it('passes a scripted failed transaction result through unchanged', async () => {
      const failure: VaultTransaction = {
        status: 'failed',
        hash: 'failed-hash',
        raw: { error: 'insufficient balance' },
      };
      const invoker = new TestContractInvoker().setInvokeResponse('withdraw', failure);

      const result = await createContract(invoker).withdraw(RECIPIENT, 10n);

      expect(result).toBe(failure);
    });

    it('propagates an adapter error without replacing it', async () => {
      const error = new ContractError('contract invocation failed');
      const invoker = new TestContractInvoker().failOnInvoke(error);

      await expect(createContract(invoker).claimRewards(ADDRESS)).rejects.toBe(error);
      expect(invoker.calls).toEqual([
        {
          kind: 'invoke',
          contractId: CONTRACT_ID,
          method: 'claim_rewards',
          args: [ADDRESS],
        },
      ]);
    });
  });

  it('completes a read and write flow without any network or RPC call', async () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(() => {
      throw new Error('unexpected network call');
    });
    const balance: VaultBalance = { address: ADDRESS, amount: 100n };
    const transaction: VaultTransaction = { status: 'success', hash: 'deposit-hash' };
    const invoker = new TestContractInvoker()
      .setReadResponse('get_balance', balance)
      .setInvokeResponse('deposit', transaction);
    const contract = createContract(invoker);

    await contract.getBalance(ADDRESS);
    await contract.deposit(ADDRESS, 25n);

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(invoker.calls).toEqual([
      {
        kind: 'read',
        contractId: CONTRACT_ID,
        method: 'get_balance',
        args: [ADDRESS],
      },
      {
        kind: 'invoke',
        contractId: CONTRACT_ID,
        method: 'deposit',
        args: [ADDRESS, '25'],
      },
    ]);

    fetchSpy.mockRestore();
  });
});
