import { useCallback, useMemo } from 'react';
import {
  CampaignContract,
  getAgentRewardSummary as readAgentRewardSummary,
  getCampaignSnapshot as readCampaignSnapshot,
  type ActivationRule,
  type AgentRewardSummary,
  type Campaign,
  type CampaignIdInput,
  type CampaignSnapshot,
  type ContractInvoker
} from '@axionvera/core';

export interface UseCampaignOptions {
  contractId: string;
  invoker: ContractInvoker;
}

export interface UseCampaignResult {
  campaign: CampaignContract;

  getCampaign(
    campaignId: CampaignIdInput,
  ): Promise<Campaign>;

  getActivationRule(
    campaignId: CampaignIdInput,
    milestone: string,
  ): Promise<ActivationRule>;

  isVerifier(
    campaignId: CampaignIdInput,
    verifier: string,
  ): Promise<boolean>;

  claimableReward(
    campaignId: CampaignIdInput,
    agent: string,
  ): Promise<bigint>;

  agentTotalEarned(
    campaignId: CampaignIdInput,
    agent: string,
  ): Promise<bigint>;

  availableUnusedFunds(
    campaignId: CampaignIdInput,
  ): Promise<bigint>;

  isInitialized(): Promise<boolean>;

  protocolAdmin(): Promise<string>;

  nextCampaignId(): Promise<bigint>;

  getCampaignSnapshot(
    campaignId: CampaignIdInput,
  ): Promise<CampaignSnapshot>;

  getAgentRewardSummary(
    campaignId: CampaignIdInput,
    agent: string,
  ): Promise<AgentRewardSummary>;
}

export function useCampaign(
  options: UseCampaignOptions,
): UseCampaignResult {
  const campaign = useMemo(
    () =>
      new CampaignContract({
        contractId: options.contractId,
        invoker: options.invoker
      }),
    [options.contractId, options.invoker]
  );

  const getCampaign = useCallback(
    (campaignId: CampaignIdInput) =>
      campaign.getCampaign(campaignId),
    [campaign]
  );

  const getActivationRule = useCallback(
    (
      campaignId: CampaignIdInput,
      milestone: string,
    ) =>
      campaign.getActivationRule(
        campaignId,
        milestone,
      ),
    [campaign]
  );

  const isVerifier = useCallback(
    (
      campaignId: CampaignIdInput,
      verifier: string,
    ) =>
      campaign.isVerifier(
        campaignId,
        verifier,
      ),
    [campaign]
  );

  const claimableReward = useCallback(
    (
      campaignId: CampaignIdInput,
      agent: string,
    ) =>
      campaign.claimableReward(
        campaignId,
        agent,
      ),
    [campaign]
  );

  const agentTotalEarned = useCallback(
    (
      campaignId: CampaignIdInput,
      agent: string,
    ) =>
      campaign.agentTotalEarned(
        campaignId,
        agent,
      ),
    [campaign]
  );

  const availableUnusedFunds = useCallback(
    (campaignId: CampaignIdInput) =>
      campaign.availableUnusedFunds(
        campaignId,
      ),
    [campaign]
  );

  const isInitialized = useCallback(
    () => campaign.isInitialized(),
    [campaign]
  );

  const protocolAdmin = useCallback(
    () => campaign.protocolAdmin(),
    [campaign]
  );

  const nextCampaignId = useCallback(
    () => campaign.nextCampaignId(),
    [campaign]
  );

  const getCampaignSnapshot = useCallback(
    (campaignId: CampaignIdInput) =>
      readCampaignSnapshot(
        campaign,
        campaignId,
      ),
    [campaign]
  );

  const getAgentRewardSummary = useCallback(
    (
      campaignId: CampaignIdInput,
      agent: string,
    ) =>
      readAgentRewardSummary(
        campaign,
        campaignId,
        agent,
      ),
    [campaign]
  );

  return {
    campaign,
    getCampaign,
    getActivationRule,
    isVerifier,
    claimableReward,
    agentTotalEarned,
    availableUnusedFunds,
    isInitialized,
    protocolAdmin,
    nextCampaignId,
    getCampaignSnapshot,
    getAgentRewardSummary
  };
}
