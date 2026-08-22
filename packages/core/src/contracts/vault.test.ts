import { describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import { ValidationError } from '../errors';
import type { VaultBalance, VaultInfo, VaultReward, VaultTransaction } from '../types';
import { VaultContract, type ContractInvoker } from './vault';

const CONTRACT_ID = 'vault-contract-id';
const ADDRESS = 'GABC1234567890';

function createMockInvoker(): {
  invoker: ContractInvoker;
  invoke: Mock;
  read: Mock;
} {
  const invoke = vi.fn();
  const read = vi.fn();
  const invoker: ContractInvoker = { invoke, read };

  return { invoker, invoke, read };
}

function createContract(invoker: ContractInvoker): VaultContract {
  return new VaultContract({ contractId: CONTRACT_ID, invoker });
}

describe('VaultContract read methods', () => {
  describe('getInfo', () => {
    it('calls read with the get_info method and no args', async () => {
      const { invoker, invoke, read } = createMockInvoker();
      const info: VaultInfo = { contractId: CONTRACT_ID };
      read.mockResolvedValue(info);

      const contract = createContract(invoker);
      await contract.getInfo();

      expect(read).toHaveBeenCalledTimes(1);
      expect(read).toHaveBeenCalledWith({
        contractId: CONTRACT_ID,
        method: 'get_info',
        args: []
      });
      expect(invoke).not.toHaveBeenCalled();
    });

    it('returns the read response unchanged', async () => {
      const { invoker, read } = createMockInvoker();
      const info: VaultInfo = { contractId: CONTRACT_ID };
      read.mockResolvedValue(info);

      const contract = createContract(invoker);
      const result = await contract.getInfo();

      expect(result).toBe(info);
    });
  });

  describe('getBalance', () => {
    it('calls read with the get_balance method and the provided address', async () => {
      const { invoker, invoke, read } = createMockInvoker();
      const balance: VaultBalance = { address: ADDRESS, amount: 100n };
      read.mockResolvedValue(balance);

      const contract = createContract(invoker);
      await contract.getBalance(ADDRESS);

      expect(read).toHaveBeenCalledTimes(1);
      expect(read).toHaveBeenCalledWith({
        contractId: CONTRACT_ID,
        method: 'get_balance',
        args: [ADDRESS]
      });
      expect(invoke).not.toHaveBeenCalled();
    });

    it('returns the read response unchanged', async () => {
      const { invoker, read } = createMockInvoker();
      const balance: VaultBalance = { address: ADDRESS, amount: 100n };
      read.mockResolvedValue(balance);

      const contract = createContract(invoker);
      const result = await contract.getBalance(ADDRESS);

      expect(result).toBe(balance);
    });
  });

  describe('getPendingRewards', () => {
    it('calls read with the get_pending_rewards method and the provided address', async () => {
      const { invoker, invoke, read } = createMockInvoker();
      const reward: VaultReward = { address: ADDRESS, amount: 50n };
      read.mockResolvedValue(reward);

      const contract = createContract(invoker);
      await contract.getPendingRewards(ADDRESS);

      expect(read).toHaveBeenCalledTimes(1);
      expect(read).toHaveBeenCalledWith({
        contractId: CONTRACT_ID,
        method: 'get_pending_rewards',
        args: [ADDRESS]
      });
      expect(invoke).not.toHaveBeenCalled();
    });

    it('returns the read response unchanged', async () => {
      const { invoker, read } = createMockInvoker();
      const reward: VaultReward = { address: ADDRESS, amount: 50n };
      read.mockResolvedValue(reward);

      const contract = createContract(invoker);
      const result = await contract.getPendingRewards(ADDRESS);

      expect(result).toBe(reward);
    });
  });

  describe('read fallback', () => {
    it('falls back to invoke when read is not provided', async () => {
      const invoke = vi.fn();
      const invoker: ContractInvoker = { invoke };
      const info: VaultInfo = { contractId: CONTRACT_ID };
      invoke.mockResolvedValue(info);

      const contract = createContract(invoker);
      const result = await contract.getInfo();

      expect(invoke).toHaveBeenCalledTimes(1);
      expect(invoke).toHaveBeenCalledWith({
        contractId: CONTRACT_ID,
        method: 'get_info',
        args: []
      });
      expect(result).toBe(info);
    });
  });
});

describe('VaultContract write methods', () => {
  const TO = 'GXYZ9876543210';

  describe('deposit', () => {
    it('calls invoke with the deposit method, address, and normalized amount string', async () => {
      const { invoker, invoke } = createMockInvoker();
      const tx: VaultTransaction = { status: 'success', hash: 'hash-1' };
      invoke.mockResolvedValue(tx);

      const contract = createContract(invoker);
      const result = await contract.deposit(ADDRESS, 100n);

      expect(invoke).toHaveBeenCalledTimes(1);
      expect(invoke).toHaveBeenCalledWith({
        contractId: CONTRACT_ID,
        method: 'deposit',
        args: [ADDRESS, '100']
      });
      expect(result).toBe(tx);
    });

    it('normalizes string and number amounts to the same stable arg shape', async () => {
      const { invoker, invoke } = createMockInvoker();
      const tx: VaultTransaction = { status: 'pending' };
      invoke.mockResolvedValue(tx);

      const contract = createContract(invoker);

      await contract.deposit(ADDRESS, '250');
      expect(invoke).toHaveBeenLastCalledWith({
        contractId: CONTRACT_ID,
        method: 'deposit',
        args: [ADDRESS, '250']
      });

      await contract.deposit(ADDRESS, 250);
      expect(invoke).toHaveBeenLastCalledWith({
        contractId: CONTRACT_ID,
        method: 'deposit',
        args: [ADDRESS, '250']
      });
    });

    it('rejects invalid amounts before invoke is called', async () => {
      const { invoker, invoke } = createMockInvoker();
      const contract = createContract(invoker);

      await expect(contract.deposit(ADDRESS, 0n)).rejects.toThrow(ValidationError);
      await expect(contract.deposit(ADDRESS, -5n)).rejects.toThrow(ValidationError);

      expect(invoke).not.toHaveBeenCalled();
    });
  });

  describe('withdraw', () => {
    it('calls invoke with the withdraw method, address, and normalized amount string', async () => {
      const { invoker, invoke } = createMockInvoker();
      const tx: VaultTransaction = { status: 'success', hash: 'hash-2' };
      invoke.mockResolvedValue(tx);

      const contract = createContract(invoker);
      const result = await contract.withdraw(TO, 250n);

      expect(invoke).toHaveBeenCalledTimes(1);
      expect(invoke).toHaveBeenCalledWith({
        contractId: CONTRACT_ID,
        method: 'withdraw',
        args: [TO, '250']
      });
      expect(result).toBe(tx);
    });

    it('rejects invalid amounts before invoke is called', async () => {
      const { invoker, invoke } = createMockInvoker();
      const contract = createContract(invoker);

      await expect(contract.withdraw(TO, '0')).rejects.toThrow(ValidationError);
      await expect(contract.withdraw(TO, '-10')).rejects.toThrow(ValidationError);

      expect(invoke).not.toHaveBeenCalled();
    });
  });

  describe('claimRewards', () => {
    it('calls invoke with the claim_rewards method and the provided address', async () => {
      const { invoker, invoke } = createMockInvoker();
      const tx: VaultTransaction = { status: 'success', hash: 'hash-3' };
      invoke.mockResolvedValue(tx);

      const contract = createContract(invoker);
      const result = await contract.claimRewards(ADDRESS);

      expect(invoke).toHaveBeenCalledTimes(1);
      expect(invoke).toHaveBeenCalledWith({
        contractId: CONTRACT_ID,
        method: 'claim_rewards',
        args: [ADDRESS]
      });
      expect(result).toBe(tx);
    });
  });
});
