import { describe, expect, it, vi } from 'vitest';
import type { Mock } from 'vitest';

import type { VaultBalance, VaultInfo, VaultReward } from '../types';
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
