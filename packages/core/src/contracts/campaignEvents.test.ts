import { nativeToScVal } from '@stellar/stellar-sdk';
import { describe, expect, it } from 'vitest';

import {
  CAMPAIGN_EVENT_TOPICS,
  decodeCampaignEvent,
  isCampaignEvent,
} from './campaignEvents';

const CONTRACT_ID =
  'CAAXCSTGNQ6S73XRXYSKAEEWZNVS7XWA4EF67DRWDPS2XFSXXA3AC2C6';

const ADMIN =
  'GDGOJ2KHXL3BSWHDFQYIOTCGBYP5SE4NGPUJY7XUVQX75SYKIMPJG7BO';

const REWARD_TOKEN =
  'CDLZFC3SYJYDZT7K67VZ75HPJVIEUVNIXF47ZG2FB2RMQQVU2HHGCYSC';

const VERIFIER =
  'GCMBWNQHCPUJVVGZFZ2XU5C7YTAPM4F7NF3KMYNIQ62UO36Y3D4EL4M4';

const AGENT =
  'GBAWZCQTJTOGKBGVYL6WYK2YUXPBYPVNPX4TJUXOZ2WNEVU235S3JUUG';

function symbol(value: string) {
  return nativeToScVal(value, { type: 'symbol' });
}

function event(
  topics: readonly string[],
  data: unknown,
) {
  return {
    contractId: CONTRACT_ID,
    topics: topics.map(symbol),
    data: nativeToScVal(data),
    transactionHash: 'abc123',
    ledger: 12345,
    raw: { source: 'test' },
  };
}

describe('Campaign event topics', () => {
  it('matches the deployed Campaign contract interface', () => {
    expect(CAMPAIGN_EVENT_TOPICS).toEqual({
      init: ['campaign', 'init'],
      created: ['campaign', 'created'],
      funded: ['campaign', 'funded'],
      rule_added: ['campaign', 'rule', 'added'],
      paused: ['campaign', 'paused'],
      resumed: ['campaign', 'resumed'],
      closed: ['campaign', 'closed'],
      unused_withdraw: [
        'campaign',
        'unused',
        'withdraw',
      ],
      verifier_added: [
        'campaign',
        'verifyr',
        'added',
      ],
      verifier_removed: [
        'campaign',
        'verifyr',
        'removed',
      ],
      reward_allocated: [
        'campaign',
        'activate',
        'reward',
      ],
      reward_claimed: [
        'campaign',
        'reward',
        'claim',
      ],
    });
  });
});

describe('decodeCampaignEvent', () => {
  it.each([
    [
      'init',
      ['campaign', 'init'],
      ADMIN,
      {
        type: 'init',
        protocolAdmin: ADMIN,
      },
    ],
    [
      'created',
      ['campaign', 'created'],
      [1n, ADMIN, REWARD_TOKEN],
      {
        type: 'created',
        campaignId: 1n,
        admin: ADMIN,
        rewardToken: REWARD_TOKEN,
      },
    ],
    [
      'funded',
      ['campaign', 'funded'],
      [1n, ADMIN, 100_000_000n],
      {
        type: 'funded',
        campaignId: 1n,
        admin: ADMIN,
        amount: 100_000_000n,
      },
    ],
    [
      'rule_added',
      ['campaign', 'rule', 'added'],
      [1n, 'purchase_verified', 10_000_000n],
      {
        type: 'rule_added',
        campaignId: 1n,
        milestone: 'purchase_verified',
        rewardAmount: 10_000_000n,
      },
    ],
    [
      'paused',
      ['campaign', 'paused'],
      [1n, ADMIN],
      {
        type: 'paused',
        campaignId: 1n,
        admin: ADMIN,
      },
    ],
    [
      'resumed',
      ['campaign', 'resumed'],
      [1n, ADMIN],
      {
        type: 'resumed',
        campaignId: 1n,
        admin: ADMIN,
      },
    ],
    [
      'closed',
      ['campaign', 'closed'],
      [1n, ADMIN],
      {
        type: 'closed',
        campaignId: 1n,
        admin: ADMIN,
      },
    ],
    [
      'unused_withdraw',
      ['campaign', 'unused', 'withdraw'],
      [1n, ADMIN, 90_000_000n],
      {
        type: 'unused_withdraw',
        campaignId: 1n,
        admin: ADMIN,
        amount: 90_000_000n,
      },
    ],
    [
      'verifier_added',
      ['campaign', 'verifyr', 'added'],
      [1n, VERIFIER],
      {
        type: 'verifier_added',
        campaignId: 1n,
        verifier: VERIFIER,
      },
    ],
    [
      'verifier_removed',
      ['campaign', 'verifyr', 'removed'],
      [1n, VERIFIER],
      {
        type: 'verifier_removed',
        campaignId: 1n,
        verifier: VERIFIER,
      },
    ],
    [
      'reward_allocated',
      ['campaign', 'activate', 'reward'],
      [
        1n,
        VERIFIER,
        AGENT,
        'order-123',
        'purchase_verified',
        10_000_000n,
      ],
      {
        type: 'reward_allocated',
        campaignId: 1n,
        verifier: VERIFIER,
        agent: AGENT,
        merchantRef: 'order-123',
        milestone: 'purchase_verified',
        rewardAmount: 10_000_000n,
      },
    ],
    [
      'reward_claimed',
      ['campaign', 'reward', 'claim'],
      [1n, AGENT, 10_000_000n],
      {
        type: 'reward_claimed',
        campaignId: 1n,
        agent: AGENT,
        claimable: 10_000_000n,
      },
    ],
  ])(
    'decodes %s with its exact Campaign payload',
    (_name, topics, data, expected) => {
      const raw = event(topics as string[], data);

      expect(decodeCampaignEvent(raw)).toMatchObject({
        ...expected,
        contractId: CONTRACT_ID,
        transactionHash: 'abc123',
        ledger: 12345,
        raw: { source: 'test' },
      });
    },
  );

  it('returns undefined for a non-Campaign event', () => {
    expect(
      decodeCampaignEvent(
        event(
          ['vault', 'deposit'],
          [ADMIN, 100n],
        ),
      ),
    ).toBeUndefined();
  });

  it('returns undefined for an unknown Campaign topic path', () => {
    expect(
      decodeCampaignEvent(
        event(
          ['campaign', 'unknown'],
          [1n],
        ),
      ),
    ).toBeUndefined();
  });

  it('returns undefined for malformed Campaign event data', () => {
    expect(
      decodeCampaignEvent(
        event(
          ['campaign', 'created'],
          [1n, ADMIN],
        ),
      ),
    ).toBeUndefined();
  });
});

describe('isCampaignEvent', () => {
  it('accepts decoded Campaign events', () => {
    const decoded = decodeCampaignEvent(
      event(
        ['campaign', 'funded'],
        [1n, ADMIN, 100n],
      ),
    );

    expect(isCampaignEvent(decoded)).toBe(true);
  });

  it('rejects unrelated values', () => {
    expect(isCampaignEvent(null)).toBe(false);
    expect(isCampaignEvent({ type: 'deposit' })).toBe(false);
    expect(isCampaignEvent({ type: 'unknown' })).toBe(false);
  });
});
