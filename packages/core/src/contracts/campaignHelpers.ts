import {
  type Campaign,
  type CampaignContract,
  type CampaignIdInput,
  normalizeCampaignId,
} from './campaign';

export interface CampaignSnapshot {
  campaign: Campaign;
  availableUnusedFunds: bigint;
}

export interface AgentRewardSummary {
  campaignId: bigint;
  agent: string;
  claimableReward: bigint;
  totalEarned: bigint;
}

export async function getCampaignSnapshot(
  contract: CampaignContract,
  campaignId: CampaignIdInput,
): Promise<CampaignSnapshot> {
  const normalizedCampaignId =
    normalizeCampaignId(campaignId);

  const campaign = await contract.getCampaign(
    normalizedCampaignId,
  );

  const availableUnusedFunds =
    await contract.availableUnusedFunds(
      normalizedCampaignId,
    );

  return {
    campaign,
    availableUnusedFunds,
  };
}

export async function getAgentRewardSummary(
  contract: CampaignContract,
  campaignId: CampaignIdInput,
  agent: string,
): Promise<AgentRewardSummary> {
  const normalizedCampaignId =
    normalizeCampaignId(campaignId);

  const claimableReward =
    await contract.claimableReward(
      normalizedCampaignId,
      agent,
    );

  const totalEarned =
    await contract.agentTotalEarned(
      normalizedCampaignId,
      agent,
    );

  return {
    campaignId: normalizedCampaignId,
    agent,
    claimableReward,
    totalEarned,
  };
}
