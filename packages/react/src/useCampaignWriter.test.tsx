// @vitest-environment jsdom

import {
  act,
  cleanup,
  renderHook,
} from '@testing-library/react';
import React from 'react';
import {
  StellarCampaignWriter,
  type StellarPreparedWriteTransaction,
  type TransactionActionResult,
  type WalletConnector,
} from '@axionvera/core';
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest';

import { AxionveraProvider } from './provider';
import { useCampaignWriter } from './useCampaignWriter';
import { useWallet } from './useWallet';

const CONTRACT_ID = 'campaign-contract-id';
const WALLET_ADDRESS = 'GTESTCAMPAIGNWRITER';
const UNSIGNED_XDR = 'AAAAAAAAAA==';
const SIGNED_XDR = 'BBBBBBBBBB==';
const PASSPHRASE =
  'Test SDF Network ; September 2015';

const PREPARED: StellarPreparedWriteTransaction = {
  unsignedXdr: UNSIGNED_XDR,
  networkPassphrase: PASSPHRASE,
  accountToSign: WALLET_ADDRESS,
  signerPublicKey: WALLET_ADDRESS,
  contractId: CONTRACT_ID,
  method: 'fund_campaign',
  args: [],
};

const SUCCESS: TransactionActionResult = {
  hash: 'tx-hash',
  status: 'success',
  ledger: 123,
};

function createWallet() {
  const signTransaction = vi
    .fn()
    .mockResolvedValue(SIGNED_XDR);

  const wallet: WalletConnector = {
    id: 'test-wallet',
    name: 'Test Wallet',

    connect: async () => ({
      publicKey: WALLET_ADDRESS,
      network: 'testnet',
    }),

    signTransaction,
  };

  return {
    wallet,
    signTransaction,
  };
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('useCampaignWriter', () => {
  it('has no writer until the wallet is connected', () => {
    const { wallet } = createWallet();

    const wrapper = ({
      children,
    }: {
      children: React.ReactNode;
    }) => (
      <AxionveraProvider wallet={wallet}>
        {children}
      </AxionveraProvider>
    );

    const { result } = renderHook(
      () =>
        useCampaignWriter({
          contractId: CONTRACT_ID,
        }),
      { wrapper },
    );

    expect(result.current.writer).toBeNull();
  });

  it('creates a StellarCampaignWriter from the connected wallet', async () => {
    const { wallet } = createWallet();

    const wrapper = ({
      children,
    }: {
      children: React.ReactNode;
    }) => (
      <AxionveraProvider wallet={wallet}>
        {children}
      </AxionveraProvider>
    );

    const { result } = renderHook(
      () => ({
        wallet: useWallet(),
        campaign: useCampaignWriter({
          contractId: CONTRACT_ID,
        }),
      }),
      { wrapper },
    );

    await act(async () => {
      await result.current.wallet.connect();
    });

    expect(
      result.current.campaign.writer,
    ).toBeInstanceOf(
      StellarCampaignWriter,
    );
  });

  it('prepares, signs and submits a Campaign write', async () => {
    const {
      wallet,
      signTransaction,
    } = createWallet();

    const prepare = vi
      .spyOn(
        StellarCampaignWriter.prototype,
        'prepareFundCampaign',
      )
      .mockResolvedValue(PREPARED);

    const submit = vi
      .spyOn(
        StellarCampaignWriter.prototype,
        'submitSignedTransaction',
      )
      .mockResolvedValue(SUCCESS);

    const wrapper = ({
      children,
    }: {
      children: React.ReactNode;
    }) => (
      <AxionveraProvider wallet={wallet}>
        {children}
      </AxionveraProvider>
    );

    const { result } = renderHook(
      () => ({
        wallet: useWallet(),
        campaign: useCampaignWriter({
          contractId: CONTRACT_ID,
        }),
      }),
      { wrapper },
    );

    await act(async () => {
      await result.current.wallet.connect();
    });

    const input = {
      campaignId: 1n,
      amount: 100_000_000n,
    };

    await act(async () => {
      await expect(
        result.current.campaign.fundCampaign(
          input,
        ),
      ).resolves.toBe(SUCCESS);
    });

    expect(prepare).toHaveBeenCalledWith(
      input,
    );

    expect(
      signTransaction,
    ).toHaveBeenCalledWith(
      UNSIGNED_XDR,
      {
        networkPassphrase: PASSPHRASE,
        accountToSign: WALLET_ADDRESS,
      },
    );

    expect(submit).toHaveBeenCalledWith(
      SIGNED_XDR,
      undefined,
    );
  });

  it('passes submission options to the Campaign writer', async () => {
    const { wallet } = createWallet();

    vi.spyOn(
      StellarCampaignWriter.prototype,
      'preparePauseCampaign',
    ).mockResolvedValue({
      ...PREPARED,
      method: 'pause_campaign',
    });

    const submit = vi
      .spyOn(
        StellarCampaignWriter.prototype,
        'submitSignedTransaction',
      )
      .mockResolvedValue(SUCCESS);

    const submitOptions = {
      poll: false,
      pollIntervalMs: 250,
      maxPollAttempts: 5,
    };

    const wrapper = ({
      children,
    }: {
      children: React.ReactNode;
    }) => (
      <AxionveraProvider wallet={wallet}>
        {children}
      </AxionveraProvider>
    );

    const { result } = renderHook(
      () => ({
        wallet: useWallet(),
        campaign: useCampaignWriter({
          contractId: CONTRACT_ID,
          submitOptions,
        }),
      }),
      { wrapper },
    );

    await act(async () => {
      await result.current.wallet.connect();
    });

    await act(async () => {
      await result.current.campaign.pauseCampaign({
        campaignId: 1n,
      });
    });

    expect(submit).toHaveBeenCalledWith(
      SIGNED_XDR,
      submitOptions,
    );
  });

  it('requires a connected wallet before write actions', async () => {
    const { wallet, signTransaction } =
      createWallet();

    const prepare = vi.spyOn(
      StellarCampaignWriter.prototype,
      'prepareFundCampaign',
    );

    const wrapper = ({
      children,
    }: {
      children: React.ReactNode;
    }) => (
      <AxionveraProvider wallet={wallet}>
        {children}
      </AxionveraProvider>
    );

    const { result } = renderHook(
      () =>
        useCampaignWriter({
          contractId: CONTRACT_ID,
        }),
      { wrapper },
    );

    await act(async () => {
      await expect(
        result.current.fundCampaign({
          campaignId: 1n,
          amount: 100n,
        }),
      ).rejects.toThrow(
        'Connect a wallet before using Campaign write actions',
      );
    });

    expect(prepare).not.toHaveBeenCalled();
    expect(
      signTransaction,
    ).not.toHaveBeenCalled();
  });

  it('tracks submitting state for the full write flow', async () => {
    const { wallet } = createWallet();

    vi.spyOn(
      StellarCampaignWriter.prototype,
      'prepareFundCampaign',
    ).mockResolvedValue(PREPARED);

    let resolveSubmission!: (
      value: TransactionActionResult,
    ) => void;

    vi.spyOn(
      StellarCampaignWriter.prototype,
      'submitSignedTransaction',
    ).mockReturnValue(
      new Promise<TransactionActionResult>(
        (resolve) => {
          resolveSubmission = resolve;
        },
      ),
    );

    const wrapper = ({
      children,
    }: {
      children: React.ReactNode;
    }) => (
      <AxionveraProvider wallet={wallet}>
        {children}
      </AxionveraProvider>
    );

    const { result } = renderHook(
      () => ({
        wallet: useWallet(),
        campaign: useCampaignWriter({
          contractId: CONTRACT_ID,
        }),
      }),
      { wrapper },
    );

    await act(async () => {
      await result.current.wallet.connect();
    });

    let promise!: Promise<TransactionActionResult>;

    act(() => {
      promise =
        result.current.campaign.fundCampaign({
          campaignId: 1n,
          amount: 100n,
        });
    });

    expect(
      result.current.campaign.isSubmitting,
    ).toBe(true);

    await act(async () => {
      resolveSubmission(SUCCESS);
      await promise;
    });

    expect(
      result.current.campaign.isSubmitting,
    ).toBe(false);

    expect(
      result.current.campaign.result,
    ).toBe(SUCCESS);
  });

  it('stores write errors and clears them', async () => {
    const { wallet } = createWallet();

    const failure = new Error(
      'Campaign preparation failed',
    );

    vi.spyOn(
      StellarCampaignWriter.prototype,
      'prepareFundCampaign',
    ).mockRejectedValue(failure);

    const wrapper = ({
      children,
    }: {
      children: React.ReactNode;
    }) => (
      <AxionveraProvider wallet={wallet}>
        {children}
      </AxionveraProvider>
    );

    const { result } = renderHook(
      () => ({
        wallet: useWallet(),
        campaign: useCampaignWriter({
          contractId: CONTRACT_ID,
        }),
      }),
      { wrapper },
    );

    await act(async () => {
      await result.current.wallet.connect();
    });

    await act(async () => {
      await expect(
        result.current.campaign.fundCampaign({
          campaignId: 1n,
          amount: 100n,
        }),
      ).rejects.toBe(failure);
    });

    expect(
      result.current.campaign.error,
    ).toBe(failure);

    act(() => {
      result.current.campaign.resetError();
    });

    expect(
      result.current.campaign.error,
    ).toBeNull();
  });
});

describe('useCampaignWriter write method mappings', () => {
  it.each([
    {
      name: 'initialize',
      prepareMethod: 'prepareInitialize',
      action: (
        result: ReturnType<typeof useCampaignWriter>,
      ) =>
        result.initialize({
          protocolAdmin: 'GADMIN123',
        }),
      expectedInput: {
        protocolAdmin: 'GADMIN123',
      },
    },
    {
      name: 'createCampaign',
      prepareMethod: 'prepareCreateCampaign',
      action: (
        result: ReturnType<typeof useCampaignWriter>,
      ) =>
        result.createCampaign({
          admin: 'GADMIN123',
          rewardToken: 'CREWARD123',
          name: 'Campaign',
          startTime: 1000n,
          endTime: 2000n,
          perAgentCap: 30_000_000n,
        }),
      expectedInput: {
        admin: 'GADMIN123',
        rewardToken: 'CREWARD123',
        name: 'Campaign',
        startTime: 1000n,
        endTime: 2000n,
        perAgentCap: 30_000_000n,
      },
    },
    {
      name: 'fundCampaign',
      prepareMethod: 'prepareFundCampaign',
      action: (
        result: ReturnType<typeof useCampaignWriter>,
      ) =>
        result.fundCampaign({
          campaignId: 1n,
          amount: 100n,
        }),
      expectedInput: {
        campaignId: 1n,
        amount: 100n,
      },
    },
    {
      name: 'addActivationRule',
      prepareMethod: 'prepareAddActivationRule',
      action: (
        result: ReturnType<typeof useCampaignWriter>,
      ) =>
        result.addActivationRule({
          campaignId: 1n,
          milestone: 'purchase_verified',
          rewardAmount: 10n,
        }),
      expectedInput: {
        campaignId: 1n,
        milestone: 'purchase_verified',
        rewardAmount: 10n,
      },
    },
    {
      name: 'addVerifier',
      prepareMethod: 'prepareAddVerifier',
      action: (
        result: ReturnType<typeof useCampaignWriter>,
      ) =>
        result.addVerifier({
          campaignId: 1n,
          verifier: 'GVERIFIER123',
        }),
      expectedInput: {
        campaignId: 1n,
        verifier: 'GVERIFIER123',
      },
    },
    {
      name: 'removeVerifier',
      prepareMethod: 'prepareRemoveVerifier',
      action: (
        result: ReturnType<typeof useCampaignWriter>,
      ) =>
        result.removeVerifier({
          campaignId: 1n,
          verifier: 'GVERIFIER123',
        }),
      expectedInput: {
        campaignId: 1n,
        verifier: 'GVERIFIER123',
      },
    },
    {
      name: 'pauseCampaign',
      prepareMethod: 'preparePauseCampaign',
      action: (
        result: ReturnType<typeof useCampaignWriter>,
      ) =>
        result.pauseCampaign({
          campaignId: 1n,
        }),
      expectedInput: {
        campaignId: 1n,
      },
    },
    {
      name: 'resumeCampaign',
      prepareMethod: 'prepareResumeCampaign',
      action: (
        result: ReturnType<typeof useCampaignWriter>,
      ) =>
        result.resumeCampaign({
          campaignId: 1n,
        }),
      expectedInput: {
        campaignId: 1n,
      },
    },
    {
      name: 'closeCampaign',
      prepareMethod: 'prepareCloseCampaign',
      action: (
        result: ReturnType<typeof useCampaignWriter>,
      ) =>
        result.closeCampaign({
          campaignId: 1n,
        }),
      expectedInput: {
        campaignId: 1n,
      },
    },
    {
      name: 'withdrawUnusedFunds',
      prepareMethod: 'prepareWithdrawUnusedFunds',
      action: (
        result: ReturnType<typeof useCampaignWriter>,
      ) =>
        result.withdrawUnusedFunds({
          campaignId: 1n,
          amount: 50n,
        }),
      expectedInput: {
        campaignId: 1n,
        amount: 50n,
      },
    },
    {
      name: 'verifyAndAllocateReward',
      prepareMethod:
        'prepareVerifyAndAllocateReward',
      action: (
        result: ReturnType<typeof useCampaignWriter>,
      ) =>
        result.verifyAndAllocateReward({
          campaignId: 1n,
          verifier: 'GVERIFIER123',
          agent: 'GAGENT123',
          merchantRef: 'order-123',
          milestone: 'purchase_verified',
        }),
      expectedInput: {
        campaignId: 1n,
        verifier: 'GVERIFIER123',
        agent: 'GAGENT123',
        merchantRef: 'order-123',
        milestone: 'purchase_verified',
      },
    },
    {
      name: 'claimReward',
      prepareMethod: 'prepareClaimReward',
      action: (
        result: ReturnType<typeof useCampaignWriter>,
      ) =>
        result.claimReward({
          campaignId: 1n,
          agent: 'GAGENT123',
        }),
      expectedInput: {
        campaignId: 1n,
        agent: 'GAGENT123',
      },
    },
  ])(
    '$name delegates to the corresponding Campaign writer method',
    async ({
      prepareMethod,
      action,
      expectedInput,
    }) => {
      const { wallet } = createWallet();

      const prepare = vi
        .spyOn(
          StellarCampaignWriter.prototype,
          prepareMethod as keyof StellarCampaignWriter,
        )
        .mockResolvedValue(
          PREPARED as never,
        );

      vi.spyOn(
        StellarCampaignWriter.prototype,
        'submitSignedTransaction',
      ).mockResolvedValue(SUCCESS);

      const wrapper = ({
        children,
      }: {
        children: React.ReactNode;
      }) => (
        <AxionveraProvider wallet={wallet}>
          {children}
        </AxionveraProvider>
      );

      const { result } = renderHook(
        () => ({
          wallet: useWallet(),
          campaign: useCampaignWriter({
            contractId: CONTRACT_ID,
          }),
        }),
        { wrapper },
      );

      await act(async () => {
        await result.current.wallet.connect();
      });

      await act(async () => {
        await action(result.current.campaign);
      });

      expect(prepare).toHaveBeenCalledWith(
        expectedInput,
      );
    },
  );
});
