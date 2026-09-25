import { describe, expect, it } from 'vitest';

import {
  ContractError,
  ValidationError,
} from '../errors';
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

describe('CampaignContract write methods', () => {
  it('sends create_campaign with the exact ordered arguments', async () => {
    const invoker = new TestContractInvoker().setInvokeResponse(
      'create_campaign',
      1n,
    );

    const contract = createContract(invoker);

    const result = await contract.createCampaign({
      admin: ADMIN,
      rewardToken: 'CREWARD123',
      name: 'Merchant Rewards',
      startTime: 1000n,
      endTime: 2000n,
      perAgentCap: 30_000_000n,
    });

    expect(result).toBe(1n);

    expect(invoker.calls).toEqual([
      {
        kind: 'invoke',
        contractId: CONTRACT_ID,
        method: 'create_campaign',
        args: [
          ADMIN,
          'CREWARD123',
          'Merchant Rewards',
          1000n,
          2000n,
          30_000_000n,
        ],
      },
    ]);
  });

  it('normalizes create_campaign numeric inputs to bigint', async () => {
    const invoker = new TestContractInvoker().setInvokeResponse(
      'create_campaign',
      1n,
    );

    await createContract(invoker).createCampaign({
      admin: ADMIN,
      rewardToken: 'CREWARD123',
      name: 'Merchant Rewards',
      startTime: '1000',
      endTime: 2000,
      perAgentCap: '30000000',
    });

    expect(invoker.calls[0]?.args).toEqual([
      ADMIN,
      'CREWARD123',
      'Merchant Rewards',
      1000n,
      2000n,
      30_000_000n,
    ]);
  });

  it('rejects invalid campaign creation inputs before invocation', async () => {
    const invoker = new TestContractInvoker();
    const contract = createContract(invoker);

    await expect(
      contract.createCampaign({
        admin: ADMIN,
        rewardToken: 'CREWARD123',
        name: 'Merchant Rewards',
        startTime: 0,
        endTime: 2000,
        perAgentCap: 30_000_000,
      }),
    ).rejects.toThrow(ValidationError);

    await expect(
      contract.createCampaign({
        admin: ADMIN,
        rewardToken: 'CREWARD123',
        name: 'Merchant Rewards',
        startTime: 2000,
        endTime: 1000,
        perAgentCap: 30_000_000,
      }),
    ).rejects.toThrow(ValidationError);

    await expect(
      contract.createCampaign({
        admin: ADMIN,
        rewardToken: 'CREWARD123',
        name: 'Merchant Rewards',
        startTime: 1000,
        endTime: 2000,
        perAgentCap: 0,
      }),
    ).rejects.toThrow(ValidationError);

    expect(invoker.calls).toEqual([]);
  });

  it('sends fund_campaign with normalized campaign ID and amount', async () => {
    const invoker = new TestContractInvoker().setInvokeResponse(
      'fund_campaign',
      100_000_000n,
    );

    const result = await createContract(invoker).fundCampaign(
      1n,
      100_000_000n,
    );

    expect(result).toBe(100_000_000n);

    expect(invoker.calls).toEqual([
      {
        kind: 'invoke',
        contractId: CONTRACT_ID,
        method: 'fund_campaign',
        args: [1n, 100_000_000n],
      },
    ]);
  });

  it('rejects invalid funding amounts before invocation', async () => {
    const invoker = new TestContractInvoker();
    const contract = createContract(invoker);

    await expect(contract.fundCampaign(1n, 0)).rejects.toThrow(
      ValidationError,
    );

    await expect(contract.fundCampaign(1n, -1)).rejects.toThrow(
      ValidationError,
    );

    expect(invoker.calls).toEqual([]);
  });
});

describe('CampaignContract setup write methods', () => {
  it('sends add_activation_rule with exact ordered arguments', async () => {
    const invoker = new TestContractInvoker().setInvokeResponse(
      'add_activation_rule',
      undefined,
    );

    await createContract(invoker).addActivationRule({
      campaignId: 1n,
      milestone: 'purchase_verified',
      rewardAmount: 10_000_000n,
    });

    expect(invoker.calls).toEqual([
      {
        kind: 'invoke',
        contractId: CONTRACT_ID,
        method: 'add_activation_rule',
        args: [
          1n,
          'purchase_verified',
          10_000_000n,
        ],
      },
    ]);
  });

  it('normalizes add_activation_rule numeric inputs', async () => {
    const invoker = new TestContractInvoker().setInvokeResponse(
      'add_activation_rule',
      undefined,
    );

    await createContract(invoker).addActivationRule({
      campaignId: '2',
      milestone: 'purchase_verified',
      rewardAmount: '25000000',
    });

    expect(invoker.calls[0]?.args).toEqual([
      2n,
      'purchase_verified',
      25_000_000n,
    ]);
  });

  it('rejects invalid activation rule inputs before invocation', async () => {
    const invoker = new TestContractInvoker();
    const contract = createContract(invoker);

    await expect(
      contract.addActivationRule({
        campaignId: 1n,
        milestone: '',
        rewardAmount: 10_000_000n,
      }),
    ).rejects.toThrow(ValidationError);

    await expect(
      contract.addActivationRule({
        campaignId: 1n,
        milestone: 'purchase_verified',
        rewardAmount: 0,
      }),
    ).rejects.toThrow(ValidationError);

    expect(invoker.calls).toEqual([]);
  });

  it('sends add_verifier with exact ordered arguments', async () => {
    const invoker = new TestContractInvoker().setInvokeResponse(
      'add_verifier',
      undefined,
    );

    await createContract(invoker).addVerifier(1n, VERIFIER);

    expect(invoker.calls).toEqual([
      {
        kind: 'invoke',
        contractId: CONTRACT_ID,
        method: 'add_verifier',
        args: [1n, VERIFIER],
      },
    ]);
  });

  it('sends remove_verifier with exact ordered arguments', async () => {
    const invoker = new TestContractInvoker().setInvokeResponse(
      'remove_verifier',
      undefined,
    );

    await createContract(invoker).removeVerifier(1n, VERIFIER);

    expect(invoker.calls).toEqual([
      {
        kind: 'invoke',
        contractId: CONTRACT_ID,
        method: 'remove_verifier',
        args: [1n, VERIFIER],
      },
    ]);
  });

  it('rejects empty verifier addresses before invocation', async () => {
    const invoker = new TestContractInvoker();
    const contract = createContract(invoker);

    await expect(
      contract.addVerifier(1n, ''),
    ).rejects.toThrow(ValidationError);

    await expect(
      contract.removeVerifier(1n, '   '),
    ).rejects.toThrow(ValidationError);

    expect(invoker.calls).toEqual([]);
  });
});

describe('CampaignContract lifecycle write methods', () => {
  it('sends pause_campaign with the campaign ID', async () => {
    const invoker = new TestContractInvoker().setInvokeResponse(
      'pause_campaign',
      undefined,
    );

    await createContract(invoker).pauseCampaign('1');

    expect(invoker.calls).toEqual([
      {
        kind: 'invoke',
        contractId: CONTRACT_ID,
        method: 'pause_campaign',
        args: [1n],
      },
    ]);
  });

  it('sends resume_campaign with the campaign ID', async () => {
    const invoker = new TestContractInvoker().setInvokeResponse(
      'resume_campaign',
      undefined,
    );

    await createContract(invoker).resumeCampaign(1);

    expect(invoker.calls).toEqual([
      {
        kind: 'invoke',
        contractId: CONTRACT_ID,
        method: 'resume_campaign',
        args: [1n],
      },
    ]);
  });

  it('sends close_campaign with the campaign ID', async () => {
    const invoker = new TestContractInvoker().setInvokeResponse(
      'close_campaign',
      undefined,
    );

    await createContract(invoker).closeCampaign(1n);

    expect(invoker.calls).toEqual([
      {
        kind: 'invoke',
        contractId: CONTRACT_ID,
        method: 'close_campaign',
        args: [1n],
      },
    ]);
  });

  it('sends withdraw_unused_funds with campaign ID and amount', async () => {
    const invoker = new TestContractInvoker().setInvokeResponse(
      'withdraw_unused_funds',
      40_000_000n,
    );

    const result = await createContract(
      invoker,
    ).withdrawUnusedFunds(
      '1',
      '50000000',
    );

    expect(result).toBe(40_000_000n);

    expect(invoker.calls).toEqual([
      {
        kind: 'invoke',
        contractId: CONTRACT_ID,
        method: 'withdraw_unused_funds',
        args: [1n, 50_000_000n],
      },
    ]);
  });

  it('rejects invalid lifecycle campaign IDs before invocation', async () => {
    const invoker = new TestContractInvoker();
    const contract = createContract(invoker);

    await expect(
      contract.pauseCampaign(0),
    ).rejects.toThrow(ValidationError);

    await expect(
      contract.resumeCampaign(-1),
    ).rejects.toThrow(ValidationError);

    await expect(
      contract.closeCampaign('abc'),
    ).rejects.toThrow(ValidationError);

    expect(invoker.calls).toEqual([]);
  });

  it('rejects invalid unused-funds withdrawal amounts before invocation', async () => {
    const invoker = new TestContractInvoker();
    const contract = createContract(invoker);

    await expect(
      contract.withdrawUnusedFunds(1n, 0),
    ).rejects.toThrow(ValidationError);

    await expect(
      contract.withdrawUnusedFunds(1n, -1),
    ).rejects.toThrow(ValidationError);

    expect(invoker.calls).toEqual([]);
  });
});

describe('CampaignContract reward execution methods', () => {
  it('sends verify_and_allocate_reward with exact ordered arguments', async () => {
    const invoker = new TestContractInvoker().setInvokeResponse(
      'verify_and_allocate_reward',
      10_000_000n,
    );

    const result = await createContract(
      invoker,
    ).verifyAndAllocateReward({
      campaignId: 1n,
      verifier: VERIFIER,
      agent: AGENT,
      merchantRef: 'order-123',
      milestone: 'purchase_verified',
    });

    expect(result).toBe(10_000_000n);

    expect(invoker.calls).toEqual([
      {
        kind: 'invoke',
        contractId: CONTRACT_ID,
        method: 'verify_and_allocate_reward',
        args: [
          1n,
          VERIFIER,
          AGENT,
          'order-123',
          'purchase_verified',
        ],
      },
    ]);
  });

  it('normalizes verify_and_allocate_reward campaign ID', async () => {
    const invoker = new TestContractInvoker().setInvokeResponse(
      'verify_and_allocate_reward',
      10_000_000n,
    );

    await createContract(
      invoker,
    ).verifyAndAllocateReward({
      campaignId: '2',
      verifier: VERIFIER,
      agent: AGENT,
      merchantRef: 'order-456',
      milestone: 'purchase_verified',
    });

    expect(invoker.calls[0]?.args[0]).toBe(2n);
  });

  it('rejects invalid reward verification inputs before invocation', async () => {
    const invoker = new TestContractInvoker();
    const contract = createContract(invoker);

    await expect(
      contract.verifyAndAllocateReward({
        campaignId: 0,
        verifier: VERIFIER,
        agent: AGENT,
        merchantRef: 'order-123',
        milestone: 'purchase_verified',
      }),
    ).rejects.toThrow(ValidationError);

    await expect(
      contract.verifyAndAllocateReward({
        campaignId: 1n,
        verifier: '',
        agent: AGENT,
        merchantRef: 'order-123',
        milestone: 'purchase_verified',
      }),
    ).rejects.toThrow(ValidationError);

    await expect(
      contract.verifyAndAllocateReward({
        campaignId: 1n,
        verifier: VERIFIER,
        agent: '',
        merchantRef: 'order-123',
        milestone: 'purchase_verified',
      }),
    ).rejects.toThrow(ValidationError);

    await expect(
      contract.verifyAndAllocateReward({
        campaignId: 1n,
        verifier: VERIFIER,
        agent: AGENT,
        merchantRef: '',
        milestone: 'purchase_verified',
      }),
    ).rejects.toThrow(ValidationError);

    await expect(
      contract.verifyAndAllocateReward({
        campaignId: 1n,
        verifier: VERIFIER,
        agent: AGENT,
        merchantRef: 'order-123',
        milestone: '',
      }),
    ).rejects.toThrow(ValidationError);

    expect(invoker.calls).toEqual([]);
  });

  it('sends claim_reward with campaign ID and agent', async () => {
    const invoker = new TestContractInvoker().setInvokeResponse(
      'claim_reward',
      10_000_000n,
    );

    const result = await createContract(
      invoker,
    ).claimReward('1', AGENT);

    expect(result).toBe(10_000_000n);

    expect(invoker.calls).toEqual([
      {
        kind: 'invoke',
        contractId: CONTRACT_ID,
        method: 'claim_reward',
        args: [1n, AGENT],
      },
    ]);
  });

  it('rejects invalid claim inputs before invocation', async () => {
    const invoker = new TestContractInvoker();
    const contract = createContract(invoker);

    await expect(
      contract.claimReward(0, AGENT),
    ).rejects.toThrow(ValidationError);

    await expect(
      contract.claimReward(1n, ''),
    ).rejects.toThrow(ValidationError);

    expect(invoker.calls).toEqual([]);
  });
});

describe('CampaignContract initialization write method', () => {
  it('sends initialize with the protocol admin address', async () => {
    const invoker = new TestContractInvoker().setInvokeResponse(
      'initialize',
      undefined,
    );

    await createContract(invoker).initialize(ADMIN);

    expect(invoker.calls).toEqual([
      {
        kind: 'invoke',
        contractId: CONTRACT_ID,
        method: 'initialize',
        args: [ADMIN],
      },
    ]);
  });

  it('rejects an empty protocol admin before invocation', async () => {
    const invoker = new TestContractInvoker();
    const contract = createContract(invoker);

    await expect(
      contract.initialize(''),
    ).rejects.toThrow(ValidationError);

    await expect(
      contract.initialize('   '),
    ).rejects.toThrow(ValidationError);

    expect(invoker.calls).toEqual([]);
  });
});

describe('CampaignContract error normalization', () => {
  it('normalizes Campaign contract errors from reads', async () => {
    const invoker = new TestContractInvoker().failOnRead(
      new ContractError(
        'read failed: HostError: Error(Contract, #5)',
      ),
    );

    const contract = createContract(invoker);

    await expect(
      contract.getCampaign(1n),
    ).rejects.toMatchObject({
      name: 'CampaignContractError',
      contractCode: 5,
      contractErrorName: 'CampaignNotFound',
    });
  });

  it('normalizes Campaign contract errors from writes', async () => {
    const invoker = new TestContractInvoker().failOnInvoke(
      new ContractError(
        'invoke failed: HostError: Error(Contract, #17)',
      ),
    );

    const contract = createContract(invoker);

    await expect(
      contract.verifyAndAllocateReward({
        campaignId: 1n,
        verifier: VERIFIER,
        agent: AGENT,
        merchantRef: 'order-123',
        milestone: 'purchase_verified',
      }),
    ).rejects.toMatchObject({
      name: 'CampaignContractError',
      contractCode: 17,
      contractErrorName: 'DuplicateActivation',
    });
  });
});
