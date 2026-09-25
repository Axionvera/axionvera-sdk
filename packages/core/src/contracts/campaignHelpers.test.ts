import { describe, expect, it } from 'vitest';

import { ContractError } from '../errors';
import { TestContractInvoker } from '../testing/testInvoker';
import {
  CampaignContract,
  type Campaign,
} from './campaign';
import {
  getAgentRewardSummary,
  getCampaignSnapshot,
} from './campaignHelpers';

const CONTRACT_ID = 'campaign-contract-id';
const ADMIN = 'GADMIN123';
const AGENT = 'GAGENT123';

const CAMPAIGN: Campaign = {
  id: 1n,
  admin: ADMIN,
  rewardToken: 'CREWARD123',
  name: 'Test Campaign',
  startTime: 1000n,
  endTime: 2000n,
  status: 'Active',
  fundedAmount: 100_000_000n,
  allocatedAmount: 10_000_000n,
  claimedAmount: 5_000_000n,
  withdrawnAmount: 0n,
  perAgentCap: 30_000_000n,
};

function createContract(
  invoker: TestContractInvoker,
): CampaignContract {
  return new CampaignContract({
    contractId: CONTRACT_ID,
    invoker,
  });
}

describe('getCampaignSnapshot', () => {
  it('combines campaign state and available unused funds', async () => {
    const invoker = new TestContractInvoker()
      .setReadResponse(
        'get_campaign',
        CAMPAIGN,
      )
      .setReadResponse(
        'available_unused_funds',
        90_000_000n,
      );

    const result = await getCampaignSnapshot(
      createContract(invoker),
      1n,
    );

    expect(result).toEqual({
      campaign: CAMPAIGN,
      availableUnusedFunds: 90_000_000n,
    });

    expect(invoker.calls).toEqual([
      {
        kind: 'read',
        contractId: CONTRACT_ID,
        method: 'get_campaign',
        args: [1n],
      },
      {
        kind: 'read',
        contractId: CONTRACT_ID,
        method: 'available_unused_funds',
        args: [1n],
      },
    ]);
  });

  it('supports CampaignIdInput through the CampaignContract boundary', async () => {
    const invoker = new TestContractInvoker()
      .setReadResponse(
        'get_campaign',
        CAMPAIGN,
      )
      .setReadResponse(
        'available_unused_funds',
        90_000_000n,
      );

    await getCampaignSnapshot(
      createContract(invoker),
      '7',
    );

    expect(
      invoker.calls.map((call) => call.args),
    ).toEqual([
      [7n],
      [7n],
    ]);
  });

  it('preserves Campaign contract errors', async () => {
    const invoker = new TestContractInvoker()
      .failOnRead(
        new ContractError(
          'read failed: HostError: Error(Contract, #5)',
        ),
      );

    await expect(
      getCampaignSnapshot(
        createContract(invoker),
        1n,
      ),
    ).rejects.toMatchObject({
      name: 'CampaignContractError',
      contractCode: 5,
      contractErrorName: 'CampaignNotFound',
    });
  });
});

describe('getAgentRewardSummary', () => {
  it('combines claimable and lifetime earned rewards', async () => {
    const invoker = new TestContractInvoker()
      .setReadResponse(
        'claimable_reward',
        10_000_000n,
      )
      .setReadResponse(
        'agent_total_earned',
        25_000_000n,
      );

    const result = await getAgentRewardSummary(
      createContract(invoker),
      1n,
      AGENT,
    );

    expect(result).toEqual({
      campaignId: 1n,
      agent: AGENT,
      claimableReward: 10_000_000n,
      totalEarned: 25_000_000n,
    });

    expect(invoker.calls).toEqual([
      {
        kind: 'read',
        contractId: CONTRACT_ID,
        method: 'claimable_reward',
        args: [1n, AGENT],
      },
      {
        kind: 'read',
        contractId: CONTRACT_ID,
        method: 'agent_total_earned',
        args: [1n, AGENT],
      },
    ]);
  });

  it('normalizes the campaign ID in the returned summary', async () => {
    const invoker = new TestContractInvoker()
      .setReadResponse(
        'claimable_reward',
        0n,
      )
      .setReadResponse(
        'agent_total_earned',
        10_000_000n,
      );

    const result = await getAgentRewardSummary(
      createContract(invoker),
      '3',
      AGENT,
    );

    expect(result.campaignId).toBe(3n);
  });
});
