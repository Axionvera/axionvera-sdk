// @vitest-environment jsdom

import {
  act,
  cleanup,
  renderHook,
} from '@testing-library/react';
import {
  CampaignContract,
  TestContractInvoker,
  type Campaign,
} from '@axionvera/core';
import {
  afterEach,
  describe,
  expect,
  it,
} from 'vitest';

import { useCampaign } from './useCampaign';

const CONTRACT_ID = 'campaign-contract-id';
const ADMIN = 'GADMIN123';
const VERIFIER = 'GVERIFIER123';
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

afterEach(() => {
  cleanup();
});

describe('useCampaign', () => {
  it('exposes a CampaignContract instance', () => {
    const invoker = new TestContractInvoker();

    const { result } = renderHook(() =>
      useCampaign({
        contractId: CONTRACT_ID,
        invoker,
      }),
    );

    expect(
      result.current.campaign,
    ).toBeInstanceOf(CampaignContract);

    expect(
      result.current.campaign.contractId,
    ).toBe(CONTRACT_ID);
  });

  it('reads a campaign', async () => {
    const invoker =
      new TestContractInvoker().setReadResponse(
        'get_campaign',
        CAMPAIGN,
      );

    const { result } = renderHook(() =>
      useCampaign({
        contractId: CONTRACT_ID,
        invoker,
      }),
    );

    await act(async () => {
      await expect(
        result.current.getCampaign(1n),
      ).resolves.toBe(CAMPAIGN);
    });

    expect(invoker.calls).toEqual([
      {
        kind: 'read',
        contractId: CONTRACT_ID,
        method: 'get_campaign',
        args: [1n],
      },
    ]);
  });

  it('checks verifier status', async () => {
    const invoker =
      new TestContractInvoker().setReadResponse(
        'is_verifier',
        true,
      );

    const { result } = renderHook(() =>
      useCampaign({
        contractId: CONTRACT_ID,
        invoker,
      }),
    );

    await act(async () => {
      await expect(
        result.current.isVerifier(
          1n,
          VERIFIER,
        ),
      ).resolves.toBe(true);
    });
  });

  it('reads initialization and protocol state', async () => {
    const invoker = new TestContractInvoker()
      .setReadResponse(
        'is_initialized',
        true,
      )
      .setReadResponse(
        'protocol_admin',
        ADMIN,
      )
      .setReadResponse(
        'next_campaign_id',
        2n,
      );

    const { result } = renderHook(() =>
      useCampaign({
        contractId: CONTRACT_ID,
        invoker,
      }),
    );

    await act(async () => {
      await expect(
        result.current.isInitialized(),
      ).resolves.toBe(true);

      await expect(
        result.current.protocolAdmin(),
      ).resolves.toBe(ADMIN);

      await expect(
        result.current.nextCampaignId(),
      ).resolves.toBe(2n);
    });
  });

  it('returns a campaign snapshot', async () => {
    const invoker = new TestContractInvoker()
      .setReadResponse(
        'get_campaign',
        CAMPAIGN,
      )
      .setReadResponse(
        'available_unused_funds',
        90_000_000n,
      );

    const { result } = renderHook(() =>
      useCampaign({
        contractId: CONTRACT_ID,
        invoker,
      }),
    );

    await act(async () => {
      await expect(
        result.current.getCampaignSnapshot(
          1n,
        ),
      ).resolves.toEqual({
        campaign: CAMPAIGN,
        availableUnusedFunds: 90_000_000n,
      });
    });
  });

  it('returns an agent reward summary', async () => {
    const invoker = new TestContractInvoker()
      .setReadResponse(
        'claimable_reward',
        10_000_000n,
      )
      .setReadResponse(
        'agent_total_earned',
        25_000_000n,
      );

    const { result } = renderHook(() =>
      useCampaign({
        contractId: CONTRACT_ID,
        invoker,
      }),
    );

    await act(async () => {
      await expect(
        result.current.getAgentRewardSummary(
          1n,
          AGENT,
        ),
      ).resolves.toEqual({
        campaignId: 1n,
        agent: AGENT,
        claimableReward: 10_000_000n,
        totalEarned: 25_000_000n,
      });
    });
  });
});
