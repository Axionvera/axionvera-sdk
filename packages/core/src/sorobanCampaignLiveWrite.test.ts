import {
  Account,
  scValToNative,
} from '@stellar/stellar-sdk';
import { describe, expect, it } from 'vitest';

import { ContractError } from './errors';

import {
  StellarCampaignWriter,
  campaignI128ToScVal,
  campaignU64ToScVal,
  type StellarSorobanWriteServer,
} from './sorobanLiveWrite';

const CONTRACT_ID =
  'CAAXCSTGNQ6S73XRXYSKAEEWZNVS7XWA4EF67DRWDPS2XFSXXA3AC2C6';

const ADMIN =
  'GDGOJ2KHXL3BSWHDFQYIOTCGBYP5SE4NGPUJY7XUVQX75SYKIMPJG7BO';

const REWARD_TOKEN =
  'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';

class FakeWriteServer implements StellarSorobanWriteServer {
  readonly calls: string[] = [];

  async getAccount(publicKey: string): Promise<Account> {
    this.calls.push('getAccount');
    return new Account(publicKey, '1');
  }

  async prepareTransaction(
    transaction: unknown,
  ): Promise<{ toXDR(): string }> {
    this.calls.push('prepareTransaction');
    return transaction as { toXDR(): string };
  }

  async sendTransaction(): Promise<Record<string, unknown>> {
    throw new Error('not used');
  }

  async getTransaction(): Promise<Record<string, unknown>> {
    throw new Error('not used');
  }
}

describe('Campaign live Soroban write helpers', () => {
  it('encodes Campaign u64 values explicitly', () => {
    const value = campaignU64ToScVal(1n);

    expect(value.type).toBe('scvU64');
    expect(scValToNative(value)).toBe(1n);
  });

  it('encodes Campaign i128 values explicitly', () => {
    const value = campaignI128ToScVal(30_000_000n, 'amount');

    expect(value.type).toBe('scvI128');
    expect(scValToNative(value)).toBe(30_000_000n);
  });

  it('prepares create_campaign for wallet signing', async () => {
    const server = new FakeWriteServer();

    const writer = new StellarCampaignWriter({
      contractId: CONTRACT_ID,
      sourcePublicKey: ADMIN,
      server,
    });

    const prepared = await writer.prepareCreateCampaign({
      admin: ADMIN,
      rewardToken: REWARD_TOKEN,
      name: 'SDK Test Campaign',
      startTime: 1_800_000_000n,
      endTime: 1_800_086_400n,
      perAgentCap: 30_000_000n,
    });

    expect(prepared.method).toBe('create_campaign');
    expect(prepared.contractId).toBe(CONTRACT_ID);
    expect(prepared.accountToSign).toBe(ADMIN);
    expect(prepared.args).toHaveLength(6);

    expect(scValToNative(prepared.args[2] as never)).toBe(
      'SDK Test Campaign',
    );
    expect(scValToNative(prepared.args[3] as never)).toBe(
      1_800_000_000n,
    );
    expect(scValToNative(prepared.args[4] as never)).toBe(
      1_800_086_400n,
    );
    expect(scValToNative(prepared.args[5] as never)).toBe(
      30_000_000n,
    );

    expect(server.calls).toEqual([
      'getAccount',
      'prepareTransaction',
    ]);
  });

  it('prepares fund_campaign with u64 campaign ID and i128 amount', async () => {
    const writer = new StellarCampaignWriter({
      contractId: CONTRACT_ID,
      sourcePublicKey: ADMIN,
      server: new FakeWriteServer(),
    });

    const prepared = await writer.prepareFundCampaign({
      campaignId: 1n,
      amount: 100_000_000n,
    });

    expect(prepared.method).toBe('fund_campaign');
    expect(prepared.args).toHaveLength(2);

    expect(scValToNative(prepared.args[0] as never)).toBe(1n);
    expect(scValToNative(prepared.args[1] as never)).toBe(
      100_000_000n,
    );
  });
});

describe('Campaign live Soroban setup writes', () => {
  it('prepares add_activation_rule with exact Soroban types', async () => {
    const writer = new StellarCampaignWriter({
      contractId: CONTRACT_ID,
      sourcePublicKey: ADMIN,
      server: new FakeWriteServer(),
    });

    const prepared = await writer.prepareAddActivationRule({
      campaignId: 1n,
      milestone: 'purchase_verified',
      rewardAmount: 10_000_000n,
    });

    expect(prepared.method).toBe('add_activation_rule');
    expect(prepared.args).toHaveLength(3);

    expect(scValToNative(prepared.args[0] as never)).toBe(1n);
    expect(scValToNative(prepared.args[1] as never)).toBe(
      'purchase_verified',
    );
    expect(scValToNative(prepared.args[2] as never)).toBe(
      10_000_000n,
    );

    expect((prepared.args[0] as { type: string }).type).toBe(
      'scvU64',
    );
    expect((prepared.args[2] as { type: string }).type).toBe(
      'scvI128',
    );
  });

  it('prepares add_verifier with campaign ID and verifier address', async () => {
    const writer = new StellarCampaignWriter({
      contractId: CONTRACT_ID,
      sourcePublicKey: ADMIN,
      server: new FakeWriteServer(),
    });

    const prepared = await writer.prepareAddVerifier({
      campaignId: 1n,
      verifier: ADMIN,
    });

    expect(prepared.method).toBe('add_verifier');
    expect(prepared.args).toHaveLength(2);

    expect(scValToNative(prepared.args[0] as never)).toBe(1n);
    expect(scValToNative(prepared.args[1] as never)).toBe(ADMIN);

    expect((prepared.args[0] as { type: string }).type).toBe(
      'scvU64',
    );
    expect((prepared.args[1] as { type: string }).type).toBe(
      'scvAddress',
    );
  });

  it('prepares remove_verifier with campaign ID and verifier address', async () => {
    const writer = new StellarCampaignWriter({
      contractId: CONTRACT_ID,
      sourcePublicKey: ADMIN,
      server: new FakeWriteServer(),
    });

    const prepared = await writer.prepareRemoveVerifier({
      campaignId: 1n,
      verifier: ADMIN,
    });

    expect(prepared.method).toBe('remove_verifier');
    expect(prepared.args).toHaveLength(2);

    expect(scValToNative(prepared.args[0] as never)).toBe(1n);
    expect(scValToNative(prepared.args[1] as never)).toBe(ADMIN);
  });
});

describe('Campaign live Soroban lifecycle writes', () => {
  it('prepares pause_campaign with a u64 campaign ID', async () => {
    const writer = new StellarCampaignWriter({
      contractId: CONTRACT_ID,
      sourcePublicKey: ADMIN,
      server: new FakeWriteServer(),
    });

    const prepared = await writer.preparePauseCampaign({
      campaignId: 1n,
    });

    expect(prepared.method).toBe('pause_campaign');
    expect(prepared.args).toHaveLength(1);
    expect(scValToNative(prepared.args[0] as never)).toBe(1n);
    expect((prepared.args[0] as { type: string }).type).toBe(
      'scvU64',
    );
  });

  it('prepares resume_campaign with a u64 campaign ID', async () => {
    const writer = new StellarCampaignWriter({
      contractId: CONTRACT_ID,
      sourcePublicKey: ADMIN,
      server: new FakeWriteServer(),
    });

    const prepared = await writer.prepareResumeCampaign({
      campaignId: '1',
    });

    expect(prepared.method).toBe('resume_campaign');
    expect(prepared.args).toHaveLength(1);
    expect(scValToNative(prepared.args[0] as never)).toBe(1n);
  });

  it('prepares close_campaign with a u64 campaign ID', async () => {
    const writer = new StellarCampaignWriter({
      contractId: CONTRACT_ID,
      sourcePublicKey: ADMIN,
      server: new FakeWriteServer(),
    });

    const prepared = await writer.prepareCloseCampaign({
      campaignId: 1,
    });

    expect(prepared.method).toBe('close_campaign');
    expect(prepared.args).toHaveLength(1);
    expect(scValToNative(prepared.args[0] as never)).toBe(1n);
  });

  it('prepares withdraw_unused_funds with u64 ID and i128 amount', async () => {
    const writer = new StellarCampaignWriter({
      contractId: CONTRACT_ID,
      sourcePublicKey: ADMIN,
      server: new FakeWriteServer(),
    });

    const prepared = await writer.prepareWithdrawUnusedFunds({
      campaignId: 1n,
      amount: 50_000_000n,
    });

    expect(prepared.method).toBe('withdraw_unused_funds');
    expect(prepared.args).toHaveLength(2);

    expect(scValToNative(prepared.args[0] as never)).toBe(1n);
    expect(scValToNative(prepared.args[1] as never)).toBe(
      50_000_000n,
    );

    expect((prepared.args[0] as { type: string }).type).toBe(
      'scvU64',
    );
    expect((prepared.args[1] as { type: string }).type).toBe(
      'scvI128',
    );
  });
});

describe('Campaign live Soroban reward execution writes', () => {
  it('prepares verify_and_allocate_reward with exact Soroban argument types', async () => {
    const writer = new StellarCampaignWriter({
      contractId: CONTRACT_ID,
      sourcePublicKey: ADMIN,
      server: new FakeWriteServer(),
    });

    const prepared = await writer.prepareVerifyAndAllocateReward({
      campaignId: 1n,
      verifier: ADMIN,
      agent: ADMIN,
      merchantRef: 'order-123',
      milestone: 'purchase_verified',
    });

    expect(prepared.method).toBe(
      'verify_and_allocate_reward',
    );
    expect(prepared.args).toHaveLength(5);

    expect(scValToNative(prepared.args[0] as never)).toBe(1n);
    expect(scValToNative(prepared.args[1] as never)).toBe(ADMIN);
    expect(scValToNative(prepared.args[2] as never)).toBe(ADMIN);
    expect(scValToNative(prepared.args[3] as never)).toBe(
      'order-123',
    );
    expect(scValToNative(prepared.args[4] as never)).toBe(
      'purchase_verified',
    );

    expect((prepared.args[0] as { type: string }).type).toBe(
      'scvU64',
    );
    expect((prepared.args[1] as { type: string }).type).toBe(
      'scvAddress',
    );
    expect((prepared.args[2] as { type: string }).type).toBe(
      'scvAddress',
    );
  });

  it('prepares claim_reward with u64 campaign ID and agent address', async () => {
    const writer = new StellarCampaignWriter({
      contractId: CONTRACT_ID,
      sourcePublicKey: ADMIN,
      server: new FakeWriteServer(),
    });

    const prepared = await writer.prepareClaimReward({
      campaignId: '1',
      agent: ADMIN,
    });

    expect(prepared.method).toBe('claim_reward');
    expect(prepared.args).toHaveLength(2);

    expect(scValToNative(prepared.args[0] as never)).toBe(1n);
    expect(scValToNative(prepared.args[1] as never)).toBe(ADMIN);

    expect((prepared.args[0] as { type: string }).type).toBe(
      'scvU64',
    );
    expect((prepared.args[1] as { type: string }).type).toBe(
      'scvAddress',
    );
  });
});

describe('Campaign live Soroban initialization write', () => {
  it('prepares initialize with the protocol admin address', async () => {
    const writer = new StellarCampaignWriter({
      contractId: CONTRACT_ID,
      sourcePublicKey: ADMIN,
      server: new FakeWriteServer(),
    });

    const prepared = await writer.prepareInitialize({
      protocolAdmin: ADMIN,
    });

    expect(prepared.method).toBe('initialize');
    expect(prepared.args).toHaveLength(1);

    expect(scValToNative(prepared.args[0] as never)).toBe(
      ADMIN,
    );

    expect((prepared.args[0] as { type: string }).type).toBe(
      'scvAddress',
    );
  });
});

describe('Campaign live write error normalization', () => {
  it('upgrades Campaign contract failures during preparation', async () => {
    class FailingWriteServer extends FakeWriteServer {
      override async prepareTransaction(): Promise<never> {
        throw new ContractError(
          'invoke failed: HostError: Error(Contract, #17)',
        );
      }
    }

    const writer = new StellarCampaignWriter({
      contractId: CONTRACT_ID,
      sourcePublicKey: ADMIN,
      server: new FailingWriteServer(),
    });

    await expect(
      writer.prepareVerifyAndAllocateReward({
        campaignId: 1n,
        verifier: ADMIN,
        agent: ADMIN,
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
