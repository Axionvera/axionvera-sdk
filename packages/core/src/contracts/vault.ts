import { createContractCallRequest, normalizeAmount } from '../transactions';
import type { AmountInput, VaultBalance, VaultInfo, VaultReward, VaultTransaction } from '../types';

export interface ContractInvoker {
  invoke<TResponse = unknown>(request: {
    contractId: string;
    method: string;
    args: readonly unknown[];
  }): Promise<TResponse>;

  read?<TResponse = unknown>(request: {
    contractId: string;
    method: string;
    args: readonly unknown[];
  }): Promise<TResponse>;
}

export interface VaultContractOptions {
  contractId: string;
  invoker: ContractInvoker;
}

export class VaultContract {
  readonly contractId: string;
  private readonly invoker: ContractInvoker;

  constructor(options: VaultContractOptions) {
    this.contractId = options.contractId;
    this.invoker = options.invoker;
  }

  async getInfo(): Promise<VaultInfo> {
    return this.read<VaultInfo>('get_info');
  }

  async getBalance(address: string): Promise<VaultBalance> {
    return this.read<VaultBalance>('get_balance', [address]);
  }

  async getPendingRewards(address: string): Promise<VaultReward> {
    return this.read<VaultReward>('get_pending_rewards', [address]);
  }

  async deposit(from: string, amount: AmountInput): Promise<VaultTransaction> {
    return this.invoke<VaultTransaction>('deposit', [from, normalizeAmount(amount).toString()]);
  }

  async withdraw(to: string, amount: AmountInput): Promise<VaultTransaction> {
    return this.invoke<VaultTransaction>('withdraw', [to, normalizeAmount(amount).toString()]);
  }

  async claimRewards(address: string): Promise<VaultTransaction> {
    return this.invoke<VaultTransaction>('claim_rewards', [address]);
  }

  private async invoke<TResponse>(method: string, args: readonly unknown[] = []): Promise<TResponse> {
    return this.invoker.invoke<TResponse>(
      createContractCallRequest(this.contractId, method, args)
    );
  }

  private async read<TResponse>(method: string, args: readonly unknown[] = []): Promise<TResponse> {
    const request = createContractCallRequest(this.contractId, method, args);

    if (this.invoker.read) {
      return this.invoker.read<TResponse>(request);
    }

    return this.invoker.invoke<TResponse>(request);
  }
}
