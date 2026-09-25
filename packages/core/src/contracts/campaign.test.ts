import { describe, expect, it } from 'vitest';

import { ValidationError } from '../errors';
import { TestContractInvoker } from '../testing/testInvoker';
import {
  CampaignContract,
  type ActivationRule,
  type Campaign,
} from './campaign';

const CONTRACT_ID = 'campaign-contract-id';
const ADMIN = 'GADMIN123';
const VERIFIER = 'GVERIFIER123';
const AGENT = 'GAGENT123';

function createContract(invoker: TestContractInvoker): CampaignContract {
  return new CampaignContract({
    contractId: CONTRACT_ID,
    invoker,
  });
}

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

const RULE: ActivationRule = {
  campaignId: 1n,
  milestone: 'purchase_verified',
  rewardAmount: 10_000_000n,
  enabled: true,
};

describe('CampaignContract read methods', () => {
  it('reads a campaign using the exact get_campaign call', async () => {
    const invoker = new TestContractInvoker().setReadResponse(
      'get_campaign',
      CAMPAIGN,
    );

    const result = await createContract(invoker).getCampaign(1n);

    expect(result).toBe(CAMPAIGN);
    expect(invoker.calls).toEqual([
      {
        kind: 'read',
        contractId: CONTRACT_ID,
        method: 'get_campaign',
        args: [1n],
      },
    ]);
  });

  it('normalizes supported campaign ID inputs to bigint', async () => {
    const invoker = new TestContractInvoker({
      defaultReadResponse: CAMPAIGN,
    });
    const contract = createContract(invoker);

    await contract.getCampaign(1n);
    await contract.getCampaign(2);
    await contract.getCampaign('3');

    expect(invoker.calls.map((call) => call.args)).toEqual([
      [1n],
      [2n],
      [3n],
    ]);
  });

  it('rejects invalid campaign IDs before calling the invoker', async () => {
    const invoker = new TestContractInvoker();
    const contract = createContract(invoker);

    await expect(contract.getCampaign(0)).rejects.toThrow(ValidationError);
    await expect(contract.getCampaign(-1)).rejects.toThrow(ValidationError);
    await expect(contract.getCampaign(1.5)).rejects.toThrow(ValidationError);
    await expect(contract.getCampaign('')).rejects.toThrow(ValidationError);
    await expect(contract.getCampaign('abc')).rejects.toThrow(ValidationError);

    expect(invoker.calls).toEqual([]);
  });

  it('reads an activation rule with ordered campaign ID and milestone arguments', async () => {
    const invoker = new TestContractInvoker().setReadResponse(
      'get_activation_rule',
      RULE,
    );

    const result = await createContract(invoker).getActivationRule(
      1n,
      'purchase_verified',
    );

    expect(result).toBe(RULE);
    expect(invoker.calls).toEqual([
      {
        kind: 'read',
        contractId: CONTRACT_ID,
        method: 'get_activation_rule',
        args: [1n, 'purchase_verified'],
      },
    ]);
  });

  it('checks verifier authorization', async () => {
    const invoker = new TestContractInvoker().setReadResponse(
      'is_verifier',
      true,
    );

    await expect(
      createContract(invoker).isVerifier(1n, VERIFIER),
    ).resolves.toBe(true);

    expect(invoker.calls[0]).toEqual({
      kind: 'read',
      contractId: CONTRACT_ID,
      method: 'is_verifier',
      args: [1n, VERIFIER],
    });
  });

  it('reads claimable reward for an agent', async () => {
    const invoker = new TestContractInvoker().setReadResponse(
      'claimable_reward',
      10_000_000n,
    );

    await expect(
      createContract(invoker).claimableReward(1n, AGENT),
    ).resolves.toBe(10_000_000n);

    expect(invoker.calls[0]).toEqual({
      kind: 'read',
      contractId: CONTRACT_ID,
      method: 'claimable_reward',
      args: [1n, AGENT],
    });
  });

  it('reads total earned reward for an agent', async () => {
    const invoker = new TestContractInvoker().setReadResponse(
      'agent_total_earned',
      20_000_000n,
    );

    await expect(
      createContract(invoker).agentTotalEarned(1n, AGENT),
    ).resolves.toBe(20_000_000n);

    expect(invoker.calls[0]).toEqual({
      kind: 'read',
      contractId: CONTRACT_ID,
      method: 'agent_total_earned',
      args: [1n, AGENT],
    });
  });

  it('reads available unused campaign funds', async () => {
    const invoker = new TestContractInvoker().setReadResponse(
      'available_unused_funds',
      90_000_000n,
    );

    await expect(
      createContract(invoker).availableUnusedFunds(1n),
    ).resolves.toBe(90_000_000n);

    expect(invoker.calls[0]).toEqual({
      kind: 'read',
      contractId: CONTRACT_ID,
      method: 'available_unused_funds',
      args: [1n],
    });
  });

  it('reads initialization state', async () => {
    const invoker = new TestContractInvoker().setReadResponse(
      'is_initialized',
      true,
    );

    await expect(
      createContract(invoker).isInitialized(),
    ).resolves.toBe(true);

    expect(invoker.calls[0]).toEqual({
      kind: 'read',
      contractId: CONTRACT_ID,
      method: 'is_initialized',
      args: [],
    });
  });

  it('reads protocol admin', async () => {
    const invoker = new TestContractInvoker().setReadResponse(
      'protocol_admin',
      ADMIN,
    );

    await expect(
      createContract(invoker).protocolAdmin(),
    ).resolves.toBe(ADMIN);

    expect(invoker.calls[0]).toEqual({
      kind: 'read',
      contractId: CONTRACT_ID,
      method: 'protocol_admin',
      args: [],
    });
  });

  it('reads the next campaign ID', async () => {
    const invoker = new TestContractInvoker().setReadResponse(
      'next_campaign_id',
      2n,
    );

    await expect(
      createContract(invoker).nextCampaignId(),
    ).resolves.toBe(2n);

    expect(invoker.calls[0]).toEqual({
      kind: 'read',
      contractId: CONTRACT_ID,
      method: 'next_campaign_id',
      args: [],
    });
  });
});
