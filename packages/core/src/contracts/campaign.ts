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

export interface CreateCampaignInput {
  admin: string;
  rewardToken: string;
  name: string;
  startTime: CampaignIdInput;
  endTime: CampaignIdInput;
  perAgentCap: CampaignIdInput;
}

export interface AddActivationRuleInput {
  campaignId: CampaignIdInput;
  milestone: string;
  rewardAmount: CampaignIdInput;
}

export interface VerifyAndAllocateRewardInput {
  campaignId: CampaignIdInput;
  verifier: string;
  agent: string;
  merchantRef: string;
  milestone: string;
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

function normalizePositiveInteger(
  value: CampaignIdInput,
  name: string,
): bigint {
  let normalized: bigint;

  if (typeof value === 'bigint') {
    normalized = value;
  } else if (typeof value === 'number') {
    if (!Number.isSafeInteger(value)) {
      throw new ValidationError(
        `${name} number must be a safe integer; use bigint or string for larger values`,
      );
    }

    normalized = BigInt(value);
  } else {
    const trimmed = value.trim();

    if (!/^\d+$/.test(trimmed)) {
      throw new ValidationError(`${name} must be a positive integer`);
    }

    normalized = BigInt(trimmed);
  }

  if (normalized <= 0n) {
    throw new ValidationError(`${name} must be greater than zero`);
  }

  return normalized;
}

function normalizeU64(
  value: CampaignIdInput,
  name: string,
): bigint {
  const normalized = normalizePositiveInteger(value, name);

  if (normalized > MAX_U64) {
    throw new ValidationError(`${name} exceeds the Soroban u64 range`);
  }

  return normalized;
}

function requireNonEmptyString(
  value: string,
  name: string,
): string {
  if (value.trim().length === 0) {
    throw new ValidationError(`${name} must not be empty`);
  }

  return value;
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

  async createCampaign(
    input: CreateCampaignInput,
  ): Promise<bigint> {
    const startTime = normalizeU64(
      input.startTime,
      'startTime',
    );
    const endTime = normalizeU64(
      input.endTime,
      'endTime',
    );
    const perAgentCap = normalizePositiveInteger(
      input.perAgentCap,
      'perAgentCap',
    );

    if (endTime <= startTime) {
      throw new ValidationError(
        'endTime must be greater than startTime',
      );
    }

    return this.invoke<bigint>('create_campaign', [
      input.admin,
      input.rewardToken,
      input.name,
      startTime,
      endTime,
      perAgentCap,
    ]);
  }

  async fundCampaign(
    campaignId: CampaignIdInput,
    amount: CampaignIdInput,
  ): Promise<bigint> {
    return this.invoke<bigint>('fund_campaign', [
      normalizeCampaignId(campaignId),
      normalizePositiveInteger(amount, 'amount'),
    ]);
  }

  async addActivationRule(
    input: AddActivationRuleInput,
  ): Promise<void> {
    return this.invoke<void>('add_activation_rule', [
      normalizeCampaignId(input.campaignId),
      requireNonEmptyString(input.milestone, 'milestone'),
      normalizePositiveInteger(
        input.rewardAmount,
        'rewardAmount',
      ),
    ]);
  }

  async addVerifier(
    campaignId: CampaignIdInput,
    verifier: string,
  ): Promise<void> {
    return this.invoke<void>('add_verifier', [
      normalizeCampaignId(campaignId),
      requireNonEmptyString(verifier, 'verifier'),
    ]);
  }

  async removeVerifier(
    campaignId: CampaignIdInput,
    verifier: string,
  ): Promise<void> {
    return this.invoke<void>('remove_verifier', [
      normalizeCampaignId(campaignId),
      requireNonEmptyString(verifier, 'verifier'),
    ]);
  }

  async pauseCampaign(
    campaignId: CampaignIdInput,
  ): Promise<void> {
    return this.invoke<void>('pause_campaign', [
      normalizeCampaignId(campaignId),
    ]);
  }

  async resumeCampaign(
    campaignId: CampaignIdInput,
  ): Promise<void> {
    return this.invoke<void>('resume_campaign', [
      normalizeCampaignId(campaignId),
    ]);
  }

  async closeCampaign(
    campaignId: CampaignIdInput,
  ): Promise<void> {
    return this.invoke<void>('close_campaign', [
      normalizeCampaignId(campaignId),
    ]);
  }

  async withdrawUnusedFunds(
    campaignId: CampaignIdInput,
    amount: CampaignIdInput,
  ): Promise<bigint> {
    return this.invoke<bigint>('withdraw_unused_funds', [
      normalizeCampaignId(campaignId),
      normalizePositiveInteger(amount, 'amount'),
    ]);
  }

  async verifyAndAllocateReward(
    input: VerifyAndAllocateRewardInput,
  ): Promise<bigint> {
    return this.invoke<bigint>(
      'verify_and_allocate_reward',
      [
        normalizeCampaignId(input.campaignId),
        requireNonEmptyString(
          input.verifier,
          'verifier',
        ),
        requireNonEmptyString(
          input.agent,
          'agent',
        ),
        requireNonEmptyString(
          input.merchantRef,
          'merchantRef',
        ),
        requireNonEmptyString(
          input.milestone,
          'milestone',
        ),
      ],
    );
  }

  async claimReward(
    campaignId: CampaignIdInput,
    agent: string,
  ): Promise<bigint> {
    return this.invoke<bigint>('claim_reward', [
      normalizeCampaignId(campaignId),
      requireNonEmptyString(agent, 'agent'),
    ]);
  }

  async initialize(
    protocolAdmin: string,
  ): Promise<void> {
    return this.invoke<void>('initialize', [
      requireNonEmptyString(
        protocolAdmin,
        'protocolAdmin',
      ),
    ]);
  }

  private async invoke<TResponse>(
    method: string,
    args: readonly unknown[] = [],
  ): Promise<TResponse> {
    return this.invoker.invoke<TResponse>(
      createContractCallRequest(
        this.contractId,
        method,
        args,
      ),
    );
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
