import {
  Account,
  nativeToScVal,
} from '@stellar/stellar-sdk';
import { describe, expect, it } from 'vitest';

import { ContractError } from './errors';

import type {
  ActivationRule,
  Campaign,
} from './contracts/campaign';
import {
  StellarCampaignReader,
  campaignIdToScVal,
  mapActivationRule,
  mapCampaign,
  type StellarSorobanReadServer,
} from './sorobanLiveRead';

const CONTRACT_ID =
  'CAAXCSTGNQ6S73XRXYSKAEEWZNVS7XWA4EF67DRWDPS2XFSXXA3AC2C6';

const PUBLIC_KEY =
  'GDGOJ2KHXL3BSWHDFQYIOTCGBYP5SE4NGPUJY7XUVQX75SYKIMPJG7BO';

class FakeReadServer implements StellarSorobanReadServer {
  readonly account = new Account(PUBLIC_KEY, '1');

  constructor(
    private readonly retval: ReturnType<typeof nativeToScVal>,
  ) {}

  async getAccount(): Promise<Account> {
    return this.account;
  }

  async simulateTransaction() {
    return {
      result: {
        retval: this.retval,
      },
    };
  }
}

describe('Campaign live Soroban reads', () => {
  it('encodes campaign IDs explicitly as Soroban u64', () => {
    const scVal = campaignIdToScVal(1n);

    expect(scVal.type).toBe('scvU64');
    expect(scVal.u64).toBe(1n);
  });

  it('maps a native Soroban campaign struct into the public SDK shape', () => {
    const native = {
      id: 1n,
      admin: PUBLIC_KEY,
      reward_token: 'CREWARD',
      name: 'Test Campaign',
      start_time: 1000n,
      end_time: 2000n,
      status: 'Active',
      funded_amount: 100_000_000n,
      allocated_amount: 10_000_000n,
      claimed_amount: 5_000_000n,
      withdrawn_amount: 0n,
      per_agent_cap: 30_000_000n,
    };

    const expected: Campaign = {
      id: 1n,
      admin: PUBLIC_KEY,
      rewardToken: 'CREWARD',
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

    expect(mapCampaign(native)).toEqual(expected);
  });

  it('maps a native Soroban activation rule into the public SDK shape', () => {
    const native = {
      campaign_id: 1n,
      milestone: 'purchase_verified',
      reward_amount: 10_000_000n,
      enabled: true,
    };

    const expected: ActivationRule = {
      campaignId: 1n,
      milestone: 'purchase_verified',
      rewardAmount: 10_000_000n,
      enabled: true,
    };

    expect(mapActivationRule(native)).toEqual(expected);
  });

  it('reads is_initialized from the live Soroban reader', async () => {
    const reader = new StellarCampaignReader({
      contractId: CONTRACT_ID,
      sourcePublicKey: PUBLIC_KEY,
      server: new FakeReadServer(nativeToScVal(true)),
    });

    await expect(reader.isInitialized()).resolves.toBe(true);
  });

  it('reads next_campaign_id as bigint', async () => {
    const reader = new StellarCampaignReader({
      contractId: CONTRACT_ID,
      sourcePublicKey: PUBLIC_KEY,
      server: new FakeReadServer(
        nativeToScVal(2n, { type: 'u64' }),
      ),
    });

    await expect(reader.nextCampaignId()).resolves.toBe(2n);
  });

  it('reads claimable_reward as bigint', async () => {
    const reader = new StellarCampaignReader({
      contractId: CONTRACT_ID,
      sourcePublicKey: PUBLIC_KEY,
      server: new FakeReadServer(
        nativeToScVal(10_000_000n, { type: 'i128' }),
      ),
    });

    await expect(
      reader.claimableReward(1n, PUBLIC_KEY),
    ).resolves.toBe(10_000_000n);
  });
});

describe('Campaign live Soroban read coverage', () => {
  it('reads and maps get_campaign', async () => {
    const reader = new StellarCampaignReader({
      contractId: CONTRACT_ID,
      sourcePublicKey: PUBLIC_KEY,
      server: new FakeReadServer(
        nativeToScVal(
          {
            id: 1n,
            admin: PUBLIC_KEY,
            reward_token: 'CREWARD',
            name: 'Test Campaign',
            start_time: 1000n,
            end_time: 2000n,
            status: ['Active'],
            funded_amount: 100_000_000n,
            allocated_amount: 10_000_000n,
            claimed_amount: 5_000_000n,
            withdrawn_amount: 0n,
            per_agent_cap: 30_000_000n,
          },
          { type: 'map' },
        ),
      ),
    });

    await expect(reader.getCampaign(1n)).resolves.toEqual({
      id: 1n,
      admin: PUBLIC_KEY,
      rewardToken: 'CREWARD',
      name: 'Test Campaign',
      startTime: 1000n,
      endTime: 2000n,
      status: 'Active',
      fundedAmount: 100_000_000n,
      allocatedAmount: 10_000_000n,
      claimedAmount: 5_000_000n,
      withdrawnAmount: 0n,
      perAgentCap: 30_000_000n,
    });
  });

  it('reads and maps get_activation_rule', async () => {
    const reader = new StellarCampaignReader({
      contractId: CONTRACT_ID,
      sourcePublicKey: PUBLIC_KEY,
      server: new FakeReadServer(
        nativeToScVal(
          {
            campaign_id: 1n,
            milestone: 'purchase_verified',
            reward_amount: 10_000_000n,
            enabled: true,
          },
          { type: 'map' },
        ),
      ),
    });

    await expect(
      reader.getActivationRule(1n, 'purchase_verified'),
    ).resolves.toEqual({
      campaignId: 1n,
      milestone: 'purchase_verified',
      rewardAmount: 10_000_000n,
      enabled: true,
    });
  });

  it('reads is_verifier', async () => {
    const reader = new StellarCampaignReader({
      contractId: CONTRACT_ID,
      sourcePublicKey: PUBLIC_KEY,
      server: new FakeReadServer(nativeToScVal(true)),
    });

    await expect(
      reader.isVerifier(1n, PUBLIC_KEY),
    ).resolves.toBe(true);
  });

  it('reads agent_total_earned', async () => {
    const reader = new StellarCampaignReader({
      contractId: CONTRACT_ID,
      sourcePublicKey: PUBLIC_KEY,
      server: new FakeReadServer(
        nativeToScVal(20_000_000n, { type: 'i128' }),
      ),
    });

    await expect(
      reader.agentTotalEarned(1n, PUBLIC_KEY),
    ).resolves.toBe(20_000_000n);
  });

  it('reads available_unused_funds', async () => {
    const reader = new StellarCampaignReader({
      contractId: CONTRACT_ID,
      sourcePublicKey: PUBLIC_KEY,
      server: new FakeReadServer(
        nativeToScVal(90_000_000n, { type: 'i128' }),
      ),
    });

    await expect(
      reader.availableUnusedFunds(1n),
    ).resolves.toBe(90_000_000n);
  });

  it('reads protocol_admin', async () => {
    const reader = new StellarCampaignReader({
      contractId: CONTRACT_ID,
      sourcePublicKey: PUBLIC_KEY,
      server: new FakeReadServer(
        nativeToScVal(PUBLIC_KEY),
      ),
    });

    await expect(
      reader.protocolAdmin(),
    ).resolves.toBe(PUBLIC_KEY);
  });
});

describe('Campaign live read error normalization', () => {
  it('upgrades Campaign contract failures from live reads', async () => {
    const server = {
      async getAccount() {
        return new Account(PUBLIC_KEY, '1');
      },

      async simulateTransaction() {
        throw new ContractError(
          'read failed: HostError: Error(Contract, #5)',
        );
      },
    };

    const reader = new StellarCampaignReader({
      contractId: CONTRACT_ID,
      sourcePublicKey: PUBLIC_KEY,
      server,
    });

    await expect(
      reader.getCampaign(1n),
    ).rejects.toMatchObject({
      name: 'CampaignContractError',
      contractCode: 5,
      contractErrorName: 'CampaignNotFound',
    });
  });
});
