import { ValidationError } from '../errors';
import { createContractCallRequest } from '../transactions';
import type { ContractInvoker } from './vault';

export type CampaignStatus = 'Active' | 'Paused' | 'Closed';

export type CampaignIdInput = bigint | number | string;

export interface Campaign {
  id: bigint;
  admin: string;
  rewardToken: string;
  name: string;
  startTime: bigint;
  endTime: bigint;
  status: CampaignStatus;
  fundedAmount: bigint;
  allocatedAmount: bigint;
  claimedAmount: bigint;
  withdrawnAmount: bigint;
  perAgentCap: bigint;
}

export interface ActivationRule {
  campaignId: bigint;
  milestone: string;
  rewardAmount: bigint;
  enabled: boolean;
}

export interface CampaignContractOptions {
  contractId: string;
  invoker: ContractInvoker;
}

const MAX_U64 = 18_446_744_073_709_551_615n;

export function normalizeCampaignId(value: CampaignIdInput): bigint {
  let normalized: bigint;

  if (typeof value === 'bigint') {
    normalized = value;
  } else if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) {
      throw new ValidationError(
        'campaignId number must be a safe integer; use bigint or string for larger values',
      );
    }

    normalized = BigInt(value);
  } else {
    const trimmed = value.trim();

    if (!/^\d+$/.test(trimmed)) {
      throw new ValidationError('campaignId must be a positive integer');
    }

    normalized = BigInt(trimmed);
  }

  if (normalized <= 0n) {
    throw new ValidationError('campaignId must be greater than zero');
  }

  if (normalized > MAX_U64) {
    throw new ValidationError('campaignId exceeds the Soroban u64 range');
  }

  return normalized;
}

export class CampaignContract {
  readonly contractId: string;
  private readonly invoker: ContractInvoker;

  constructor(options: CampaignContractOptions) {
    this.contractId = options.contractId;
    this.invoker = options.invoker;
  }

  async getCampaign(campaignId: CampaignIdInput): Promise<Campaign> {
    return this.read<Campaign>('get_campaign', [
      normalizeCampaignId(campaignId),
    ]);
  }

  async getActivationRule(
    campaignId: CampaignIdInput,
    milestone: string,
  ): Promise<ActivationRule> {
    return this.read<ActivationRule>('get_activation_rule', [
      normalizeCampaignId(campaignId),
      milestone,
    ]);
  }

  async isVerifier(
    campaignId: CampaignIdInput,
    verifier: string,
  ): Promise<boolean> {
    return this.read<boolean>('is_verifier', [
      normalizeCampaignId(campaignId),
      verifier,
    ]);
  }

  async claimableReward(
    campaignId: CampaignIdInput,
    agent: string,
  ): Promise<bigint> {
    return this.read<bigint>('claimable_reward', [
      normalizeCampaignId(campaignId),
      agent,
    ]);
  }

  async agentTotalEarned(
    campaignId: CampaignIdInput,
    agent: string,
  ): Promise<bigint> {
    return this.read<bigint>('agent_total_earned', [
      normalizeCampaignId(campaignId),
      agent,
    ]);
  }

  async availableUnusedFunds(
    campaignId: CampaignIdInput,
  ): Promise<bigint> {
    return this.read<bigint>('available_unused_funds', [
      normalizeCampaignId(campaignId),
    ]);
  }

  async isInitialized(): Promise<boolean> {
    return this.read<boolean>('is_initialized');
  }

  async protocolAdmin(): Promise<string> {
    return this.read<string>('protocol_admin');
  }

  async nextCampaignId(): Promise<bigint> {
    return this.read<bigint>('next_campaign_id');
  }

  private async read<TResponse>(
    method: string,
    args: readonly unknown[] = [],
  ): Promise<TResponse> {
    const request = createContractCallRequest(
      this.contractId,
      method,
      args,
    );

    if (this.invoker.read) {
      return this.invoker.read<TResponse>(request);
    }

    return this.invoker.invoke<TResponse>(request);
  }
}
