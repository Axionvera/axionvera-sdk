import { scValToNative, type xdr } from '@stellar/stellar-sdk';

export const CAMPAIGN_EVENT_TOPICS = {
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
} as const;

export type CampaignEventType =
  keyof typeof CAMPAIGN_EVENT_TOPICS;

interface CampaignEventBase {
  type: CampaignEventType;
  contractId: string;
  transactionHash?: string;
  ledger?: number;
  raw?: unknown;
}

export interface CampaignInitEvent
  extends CampaignEventBase {
  type: 'init';
  protocolAdmin: string;
}

export interface CampaignCreatedEvent
  extends CampaignEventBase {
  type: 'created';
  campaignId: bigint;
  admin: string;
  rewardToken: string;
}

export interface CampaignFundedEvent
  extends CampaignEventBase {
  type: 'funded';
  campaignId: bigint;
  admin: string;
  amount: bigint;
}

export interface CampaignRuleAddedEvent
  extends CampaignEventBase {
  type: 'rule_added';
  campaignId: bigint;
  milestone: string;
  rewardAmount: bigint;
}

export interface CampaignPausedEvent
  extends CampaignEventBase {
  type: 'paused';
  campaignId: bigint;
  admin: string;
}

export interface CampaignResumedEvent
  extends CampaignEventBase {
  type: 'resumed';
  campaignId: bigint;
  admin: string;
}

export interface CampaignClosedEvent
  extends CampaignEventBase {
  type: 'closed';
  campaignId: bigint;
  admin: string;
}

export interface CampaignUnusedWithdrawEvent
  extends CampaignEventBase {
  type: 'unused_withdraw';
  campaignId: bigint;
  admin: string;
  amount: bigint;
}

export interface CampaignVerifierAddedEvent
  extends CampaignEventBase {
  type: 'verifier_added';
  campaignId: bigint;
  verifier: string;
}

export interface CampaignVerifierRemovedEvent
  extends CampaignEventBase {
  type: 'verifier_removed';
  campaignId: bigint;
  verifier: string;
}

export interface CampaignRewardAllocatedEvent
  extends CampaignEventBase {
  type: 'reward_allocated';
  campaignId: bigint;
  verifier: string;
  agent: string;
  merchantRef: string;
  milestone: string;
  rewardAmount: bigint;
}

export interface CampaignRewardClaimedEvent
  extends CampaignEventBase {
  type: 'reward_claimed';
  campaignId: bigint;
  agent: string;
  claimable: bigint;
}

export type CampaignEvent =
  | CampaignInitEvent
  | CampaignCreatedEvent
  | CampaignFundedEvent
  | CampaignRuleAddedEvent
  | CampaignPausedEvent
  | CampaignResumedEvent
  | CampaignClosedEvent
  | CampaignUnusedWithdrawEvent
  | CampaignVerifierAddedEvent
  | CampaignVerifierRemovedEvent
  | CampaignRewardAllocatedEvent
  | CampaignRewardClaimedEvent;

export interface RawCampaignEvent {
  contractId: string;
  topics: readonly xdr.ScVal[];
  data: xdr.ScVal;
  transactionHash?: string;
  ledger?: number;
  raw?: unknown;
}

function decodeScVal(value: xdr.ScVal): unknown {
  try {
    return scValToNative(value);
  } catch {
    return undefined;
  }
}

function decodeTopics(
  topics: readonly xdr.ScVal[],
): string[] | undefined {
  const decoded = topics.map(decodeScVal);

  if (
    decoded.some(
      (value) => typeof value !== 'string',
    )
  ) {
    return undefined;
  }

  return decoded as string[];
}

function topicsMatch(
  actual: readonly string[],
  expected: readonly string[],
): boolean {
  return (
    actual.length === expected.length &&
    expected.every(
      (value, index) => actual[index] === value,
    )
  );
}

function isTuple(
  value: unknown,
  length: number,
): value is unknown[] {
  return Array.isArray(value) && value.length === length;
}

function isString(
  value: unknown,
): value is string {
  return typeof value === 'string';
}

function isBigInt(
  value: unknown,
): value is bigint {
  return typeof value === 'bigint';
}

function metadata(
  event: RawCampaignEvent,
): Omit<CampaignEventBase, 'type'> {
  return {
    contractId: event.contractId,
    ...(event.transactionHash !== undefined
      ? { transactionHash: event.transactionHash }
      : {}),
    ...(event.ledger !== undefined
      ? { ledger: event.ledger }
      : {}),
    ...(event.raw !== undefined
      ? { raw: event.raw }
      : {}),
  };
}

export function decodeCampaignEvent(
  event: RawCampaignEvent,
): CampaignEvent | undefined {
  const topics = decodeTopics(event.topics);

  if (!topics || topics[0] !== 'campaign') {
    return undefined;
  }

  const data = decodeScVal(event.data);
  const base = metadata(event);

  if (
    topicsMatch(
      topics,
      CAMPAIGN_EVENT_TOPICS.init,
    )
  ) {
    if (!isString(data)) {
      return undefined;
    }

    return {
      type: 'init',
      protocolAdmin: data,
      ...base,
    };
  }

  if (
    topicsMatch(
      topics,
      CAMPAIGN_EVENT_TOPICS.created,
    )
  ) {
    if (
      !isTuple(data, 3) ||
      !isBigInt(data[0]) ||
      !isString(data[1]) ||
      !isString(data[2])
    ) {
      return undefined;
    }

    return {
      type: 'created',
      campaignId: data[0],
      admin: data[1],
      rewardToken: data[2],
      ...base,
    };
  }

  if (
    topicsMatch(
      topics,
      CAMPAIGN_EVENT_TOPICS.funded,
    )
  ) {
    if (
      !isTuple(data, 3) ||
      !isBigInt(data[0]) ||
      !isString(data[1]) ||
      !isBigInt(data[2])
    ) {
      return undefined;
    }

    return {
      type: 'funded',
      campaignId: data[0],
      admin: data[1],
      amount: data[2],
      ...base,
    };
  }

  if (
    topicsMatch(
      topics,
      CAMPAIGN_EVENT_TOPICS.rule_added,
    )
  ) {
    if (
      !isTuple(data, 3) ||
      !isBigInt(data[0]) ||
      !isString(data[1]) ||
      !isBigInt(data[2])
    ) {
      return undefined;
    }

    return {
      type: 'rule_added',
      campaignId: data[0],
      milestone: data[1],
      rewardAmount: data[2],
      ...base,
    };
  }

  if (
    topicsMatch(
      topics,
      CAMPAIGN_EVENT_TOPICS.paused,
    ) ||
    topicsMatch(
      topics,
      CAMPAIGN_EVENT_TOPICS.resumed,
    ) ||
    topicsMatch(
      topics,
      CAMPAIGN_EVENT_TOPICS.closed,
    )
  ) {
    if (
      !isTuple(data, 2) ||
      !isBigInt(data[0]) ||
      !isString(data[1])
    ) {
      return undefined;
    }

    const type: 'paused' | 'resumed' | 'closed' =
      topics[1] === 'paused'
        ? 'paused'
        : topics[1] === 'resumed'
          ? 'resumed'
          : 'closed';

    return {
      type,
      campaignId: data[0],
      admin: data[1],
      ...base,
    };
  }

  if (
    topicsMatch(
      topics,
      CAMPAIGN_EVENT_TOPICS.unused_withdraw,
    )
  ) {
    if (
      !isTuple(data, 3) ||
      !isBigInt(data[0]) ||
      !isString(data[1]) ||
      !isBigInt(data[2])
    ) {
      return undefined;
    }

    return {
      type: 'unused_withdraw',
      campaignId: data[0],
      admin: data[1],
      amount: data[2],
      ...base,
    };
  }

  if (
    topicsMatch(
      topics,
      CAMPAIGN_EVENT_TOPICS.verifier_added,
    ) ||
    topicsMatch(
      topics,
      CAMPAIGN_EVENT_TOPICS.verifier_removed,
    )
  ) {
    if (
      !isTuple(data, 2) ||
      !isBigInt(data[0]) ||
      !isString(data[1])
    ) {
      return undefined;
    }

    return {
      type:
        topics[2] === 'added'
          ? 'verifier_added'
          : 'verifier_removed',
      campaignId: data[0],
      verifier: data[1],
      ...base,
    };
  }

  if (
    topicsMatch(
      topics,
      CAMPAIGN_EVENT_TOPICS.reward_allocated,
    )
  ) {
    if (
      !isTuple(data, 6) ||
      !isBigInt(data[0]) ||
      !isString(data[1]) ||
      !isString(data[2]) ||
      !isString(data[3]) ||
      !isString(data[4]) ||
      !isBigInt(data[5])
    ) {
      return undefined;
    }

    return {
      type: 'reward_allocated',
      campaignId: data[0],
      verifier: data[1],
      agent: data[2],
      merchantRef: data[3],
      milestone: data[4],
      rewardAmount: data[5],
      ...base,
    };
  }

  if (
    topicsMatch(
      topics,
      CAMPAIGN_EVENT_TOPICS.reward_claimed,
    )
  ) {
    if (
      !isTuple(data, 3) ||
      !isBigInt(data[0]) ||
      !isString(data[1]) ||
      !isBigInt(data[2])
    ) {
      return undefined;
    }

    return {
      type: 'reward_claimed',
      campaignId: data[0],
      agent: data[1],
      claimable: data[2],
      ...base,
    };
  }

  return undefined;
}

export function isCampaignEvent(
  value: unknown,
): value is CampaignEvent {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const candidate = value as {
    type?: unknown;
    contractId?: unknown;
  };

  return (
    typeof candidate.contractId === 'string' &&
    typeof candidate.type === 'string' &&
    Object.prototype.hasOwnProperty.call(
      CAMPAIGN_EVENT_TOPICS,
      candidate.type,
    )
  );
}
